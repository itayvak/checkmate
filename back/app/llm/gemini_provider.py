"""Google Gemini REST API implementation of LLMProvider."""

from __future__ import annotations

import json
import os
from typing import Any

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
SUPPORTED_MODELS = frozenset(
    {
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.5-flash-lite",
        "gemini-3-flash-preview",
        "gemini-3.1-pro-preview",
    }
)
DEFAULT_MODEL = "gemini-2.5-flash-lite"


def _env_float(primary: str, fallback: str, default: str) -> float:
    v = os.environ.get(primary)
    if v is None or v == "":
        v = os.environ.get(fallback, default)
    return float(v)


def _env_int(primary: str, fallback: str, default: str) -> int:
    v = os.environ.get(primary)
    if v is None or v == "":
        v = os.environ.get(fallback, default)
    return int(v)


CONNECT_TIMEOUT_SEC = _env_float("LLM_CONNECT_TIMEOUT_SEC", "GEMINI_CONNECT_TIMEOUT_SEC", "15")
READ_TIMEOUT_SEC = _env_float("LLM_READ_TIMEOUT_SEC", "GEMINI_READ_TIMEOUT_SEC", "300")
MAX_TOKENS_STANDARD = _env_int("LLM_MAX_TOKENS_STANDARD", "GEMINI_MAX_TOKENS_STANDARD", "16384")
MAX_TOKENS_LARGE = _env_int("LLM_MAX_TOKENS_LARGE", "GEMINI_MAX_TOKENS_LARGE", "32768")


def _extract_response_text(data: dict) -> str:
    if not isinstance(data, dict):
        raise ValueError("Gemini returned invalid JSON (expected an object).")

    if "error" in data:
        err = data["error"]
        if isinstance(err, dict):
            msg = err.get("message", json.dumps(err, ensure_ascii=False))
        else:
            msg = str(err)
        raise ValueError(f"Gemini API error: {msg}")

    feedback = data.get("promptFeedback")
    if isinstance(feedback, dict):
        br = feedback.get("blockReason")
        if br:
            raise ValueError(f"Prompt was blocked by Gemini ({br}).")

    candidates = data.get("candidates")
    if not candidates:
        raise ValueError(
            "Gemini returned no candidates (empty response). "
            "Try another model, check your API key, or retry."
        )

    cand0 = candidates[0]
    if not isinstance(cand0, dict):
        raise ValueError("Gemini candidate format was unexpected.")

    finish = cand0.get("finishReason")
    if finish in ("SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT"):
        raise ValueError(f"Gemini stopped for policy reasons ({finish}).")
    if finish == "MAX_TOKENS":
        raise ValueError(
            "Gemini hit the output token limit and returned a truncated response. "
            "Try a model with a larger output window (e.g. gemini-2.5-pro) or simplify the assignment."
        )

    content = cand0.get("content")
    if not isinstance(content, dict):
        raise ValueError(
            "Gemini response had no content. "
            f"finishReason={finish!r}."
        )

    parts = content.get("parts")
    if not parts or not isinstance(parts, list):
        raise ValueError(
            "Gemini returned no text parts (missing 'parts'). "
            f"finishReason={finish!r}. Try another model or a shorter assignment."
        )

    chunks = []
    for part in parts:
        if isinstance(part, dict) and part.get("text") is not None:
            chunks.append(part["text"])
    if not chunks:
        raise ValueError("Gemini parts contained no text.")

    return "".join(chunks)


def _format_http_error(resp: Any) -> str:
    try:
        data = resp.json()
    except Exception:
        text = (getattr(resp, "text", None) or "").strip()
        return text[:800] if text else getattr(resp, "reason", None) or "Unknown error"

    err = data.get("error")
    if isinstance(err, dict):
        msg = err.get("message") or json.dumps(err, ensure_ascii=False)
        code = err.get("code")
        status = err.get("status")
        extra = []
        if code is not None:
            extra.append(f"code={code}")
        if status:
            extra.append(str(status))
        if extra:
            return f"{msg} ({', '.join(extra)})"
        return str(msg)
    if err is not None:
        return str(err)
    text = (getattr(resp, "text", None) or "").strip()
    return text[:800] if text else str(getattr(resp, "status_code", "?"))


class GeminiProvider:
    provider_id = "gemini"
    label = "Google Gemini"

    def __init__(self) -> None:
        self.default_model = DEFAULT_MODEL
        self.supported_models = SUPPORTED_MODELS

    def max_output_tokens(self, model: str) -> int:
        name = (model or "").lower()
        if "pro" in name or "preview" in name:
            return MAX_TOKENS_LARGE
        return MAX_TOKENS_STANDARD

    def complete(
        self,
        api_key: str,
        prompt: str,
        *,
        model: str,
        max_tokens: int,
        json_schema: dict[str, Any] | None = None,
    ) -> str:
        import requests as req

        url = f"{GEMINI_API_BASE}/{model}:generateContent?key={api_key}"

        gen_config: dict[str, Any] = {"temperature": 0.2, "maxOutputTokens": max_tokens}
        if json_schema:
            gen_config["responseMimeType"] = "application/json"
            gen_config["responseJsonSchema"] = json_schema

        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": gen_config,
        }

        try:
            resp = req.post(
                url,
                json=body,
                timeout=(CONNECT_TIMEOUT_SEC, READ_TIMEOUT_SEC),
            )
        except req.exceptions.ReadTimeout as e:
            raise ValueError(
                "Gemini request timed out while waiting for a response. "
                "Try again, switch to a faster model, or increase LLM_READ_TIMEOUT_SEC / GEMINI_READ_TIMEOUT_SEC."
            ) from e

        if not resp.ok:
            detail = _format_http_error(resp)
            raise ValueError(f"Gemini API HTTP {resp.status_code}: {detail}")

        data = resp.json()
        return _extract_response_text(data)

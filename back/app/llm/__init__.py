"""Pluggable LLM layer: providers, review flow, checker prompts."""

from __future__ import annotations

from typing import Any

from .checker_prompt import generate_auto_checker_prompt, normalize_checker_script_response
from .factory import get_llm_provider
from .gemini_provider import GeminiProvider
from .protocol import LLMProvider
from .review import review_student_code
from .review_schema import REVIEW_SCHEMA


def call_gemini(
    api_key: str,
    prompt: str,
    model_name: str | None = None,
    max_tokens: int = 8192,
    response_schema: dict[str, Any] | None = None,
) -> str:
    """Backward-compatible name: delegates to the active `LLMProvider`."""
    p = get_llm_provider()
    model = (model_name or p.default_model).strip()
    return p.complete(
        api_key,
        prompt,
        model=model,
        max_tokens=max_tokens,
        json_schema=response_schema,
    )


def max_tokens_for_model(model_name: str) -> int:
    return get_llm_provider().max_output_tokens(model_name)


__all__ = [
    "LLMProvider",
    "GeminiProvider",
    "REVIEW_SCHEMA",
    "call_gemini",
    "generate_auto_checker_prompt",
    "get_llm_provider",
    "max_tokens_for_model",
    "normalize_checker_script_response",
    "review_student_code",
]

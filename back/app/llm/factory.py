"""Select LLM provider from environment."""

import os

from .gemini_provider import GeminiProvider
from .protocol import LLMProvider

_PROVIDER_CACHE: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    global _PROVIDER_CACHE
    if _PROVIDER_CACHE is not None:
        return _PROVIDER_CACHE

    name = (os.environ.get("CHECKMATE_LLM_PROVIDER") or "gemini").strip().lower()
    if name == "gemini":
        _PROVIDER_CACHE = GeminiProvider()
    else:
        raise ValueError(
            f"Unknown CHECKMATE_LLM_PROVIDER={name!r}. Supported: gemini."
        )
    return _PROVIDER_CACHE

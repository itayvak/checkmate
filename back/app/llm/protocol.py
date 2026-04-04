"""Abstract LLM completion API for swapping vendors (Gemini, OpenAI, etc.)."""

from typing import Any, Protocol


class LLMProvider(Protocol):
    """Structural interface implemented by concrete providers."""

    provider_id: str
    label: str
    default_model: str
    supported_models: frozenset[str]

    def complete(
        self,
        api_key: str,
        prompt: str,
        *,
        model: str,
        max_tokens: int,
        json_schema: dict[str, Any] | None = None,
    ) -> str:
        """Return model text output (plain text or JSON string if json_schema is set)."""
        ...

    def max_output_tokens(self, model: str) -> int:
        """Upper bound for max output tokens for this model on this provider."""
        ...

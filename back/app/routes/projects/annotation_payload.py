"""Shape grading-session item fields into workspace API `annotation` objects."""

from __future__ import annotations

from typing import Any


def annotation_dict_for_api(item: dict[str, Any]) -> dict[str, Any]:
    """Map a grading `results` item to the `annotation` field on workspace students."""
    out: dict[str, Any] = {
        "annotations": item.get("annotations") or [],
        "ai_improvement": item.get("ai_improvement") or "",
    }
    err = item.get("annotation_error")
    if err:
        out["annotation_error"] = err
    return out

"""JSON Schema for structured student code review responses."""

REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "improvement": {
            "type": "string",
            "description": (
                "Hebrew guidance for the student about what to improve next time. "
                "1-2 short sentences. Prefer general advice, but you MAY reference a short code snippet (1-2 lines) "
                "if it makes the guidance clearer. "
                "Do NOT mention pass/fail. Do NOT mention line numbers. "
                "You MAY mention a module/function ONLY if it directly caused the failure. "
                "Do NOT start with 'חניך יקר,'. You MAY start with 'להבא,' but it's optional."
            ),
        },
        "annotations": {
            "type": "array",
            "description": "One entry per flagged line",
            "items": {
                "type": "object",
                "properties": {
                    "line": {"type": "integer", "description": "1-based line number"},
                    "comment_id": {"type": "string", "description": "ID of a comment from the provided comment library"},
                    "new_comment": {
                        "type": "object",
                        "description": "Create a new comment in the project's comment library when none match",
                        "properties": {
                            "message": {"type": "string", "description": "Hebrew comment text to store in the library"},
                            "teacher_text": {
                                "type": "string",
                                "description": (
                                    "Optional Hebrew notes for teachers only (not shown to students). "
                                    "Must be generic and reusable like the message: when to pick this comment, "
                                    "typical mistake pattern. Do NOT name files, lines, variables, or specifics of one submission."
                                ),
                            },
                            "points": {
                                "type": "integer",
                                "description": (
                                    "Point deduction for this mistake (0–30). "
                                    "Use existing library comments' points as calibration: "
                                    "minor style/clarity issues ~5, moderate requirement gaps ~10–15, "
                                    "critical/missing core requirement ~20–30. Default to 10 if unsure."
                                ),
                            },
                        },
                        "required": ["message", "points"],
                    },
                },
                "required": ["line"],
                "oneOf": [
                    {"required": ["comment_id"]},
                    {"required": ["new_comment"]},
                ],
            },
        },
    },
    "required": ["improvement", "annotations"],
}

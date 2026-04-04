"""Build review prompts, call the LLM, parse and validate annotations."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from .review_postprocess import (
    compose_student_summary,
    grade_from_review_annotations,
    normalize_student_improvement,
)
from .review_schema import REVIEW_SCHEMA

if TYPE_CHECKING:
    from .protocol import LLMProvider


def review_student_code(
    api_key,
    student_code,
    model_solution,
    assignment_md,
    student_id="?",
    model_name: str | None = None,
    *,
    student_filename: str | None = None,
    auto_check_output: str | None = None,
    extra_instructions: str | None = None,
    comment_library: list[dict[str, Any]] | None = None,
    provider: LLMProvider | None = None,
):
    from .factory import get_llm_provider

    llm = provider or get_llm_provider()
    resolved_model = (model_name or "").strip() or llm.default_model

    lines = student_code.split("\n")

    numbered = "\n".join(f"{i+1:>3}: {line}" for i, line in enumerate(lines))

    auto_block = ""
    ac = (auto_check_output or "").strip()
    if ac:
        auto_block = f"""
PRIOR AUTOMATED CHECKER OUTPUT

The teacher previously ran an automated checker on a batch of student files. Below is the
captured output (stdout/stderr / errors) for the batch row whose filename matches this submission.
Use it as supplementary signal for behaviour, I/O, and pass/fail hints.

The assignment description and model solution above remain authoritative for what is required.
If anything in the checker output conflicts with the written assignment, follow the assignment.

```
{ac}
```

"""

    extra = (extra_instructions or "").strip()
    extra_block = f"""
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
IMPORTANT — TEACHER'S CUSTOM INSTRUCTIONS (highest priority):
These instructions override your default evaluation and annotation choices.
You MUST follow them exactly when grading and writing comments.

{extra}

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
""" if extra else ""

    lib = comment_library if isinstance(comment_library, list) else []
    lib_rows: list[dict] = []
    for c in lib:
        if not isinstance(c, dict):
            continue
        cid = str(c.get("id") or "").strip()
        msg = str(c.get("message") or "").strip()
        if not cid or not msg:
            continue
        lib_rows.append(
            {
                "id": cid,
                "message": msg,
                "points": int(c.get("points") or 0),
            }
        )
    library_block = ""
    lib_points_by_id: dict[str, int] = {}
    if lib_rows:
        lib_points_by_id = {str(row["id"]): int(row["points"]) for row in lib_rows}
        library_block = f"""
COMMENT LIBRARY (use these predefined comments when possible):
The following list is a set of allowed comments. Each entry includes its point deduction value.
Prefer referencing an existing comment by its ID.
Only create a new comment when none match the requirement you need to flag.
When creating a new comment, calibrate its `points` deduction against the existing library entries above.

{json.dumps(lib_rows, ensure_ascii=False)}
"""

    prompt = f"""You are a **strict Python assignment evaluator** reviewing a single student submission.

Your role is **not** to teach, refactor, optimize, or suggest improvements.
Your role is ONLY to determine whether the student correctly implemented the assignment requirements.
{extra_block}
{library_block}
I will provide you with:
    * The assignment description, a text given to the students describing what the student should implement in their code.
    * The model solution, the correct solution written by the class proffesor.

EVALUATION PRINCIPLES:


1. The **assignment description is the authoritative specification**.
2. The model solution exists ONLY to clarify intended behavior when the assignment text is ambiguous.
3. The student may implement the solution differently from the model solution — this is allowed if the observable behavior matches the assignment requirements.
4. Judge **functional correctness only**.

Your single question is:

Does the student's program fully satisfy every explicit requirement stated in the assignment description?


GRADING:
The student's grade is computed automatically from the point deductions of all applied annotations.
Grade = 100 − (sum of all annotation point deductions), clamped to [0, 100].
A grade ≥ 70 is a pass; below 70 is a fail.
You do NOT decide pass/fail directly — your job is to annotate violations accurately with correct point deductions.

HOW TO EVALUATE:

Follow this reasoning process internally:

1. Extract explicit requirements from the assignment description.
2. Determine expected observable behavior.
3. Compare student behavior against those requirements.
4. Identify ONLY requirement violations.
5. Ignore all non-required aspects.

Do NOT assume requirements that are not written.

ANNOTATION RULES:

Each annotation MUST:

* Refer ONLY to violations of explicit assignment requirements.
* Point to the FIRST line where the problem originates.
* Avoid duplicate annotations for the same root issue.
* Avoid annotating downstream consequences caused by an earlier mistake.

Annotate ONLY when:

* A requirement is missing
* A requirement is implemented incorrectly
* The behavior differs from what the assignment requires

DO NOT COMMENT ON:

* Code style or readability
* Pythonic conventions
* Naming choices
* Refactoring opportunities
* Performance or complexity
* Error handling or edge cases UNLESS explicitly required
* Differences from the model solution that still satisfy requirements
* Anything not explicitly stated in the assignment

COMMENT WRITING RULES:

All comment messages MUST be written in **Hebrew only**.

When you need to annotate a problem, you MUST do ONE of:

1) Use an existing library entry by returning `comment_id` (preferred).
2) If no library entry matches, return `new_comment` so the system can add it to the library, then reference it.

If you create a new comment:
- Keep it reusable across students in this project.
- Avoid including student-specific names/values.

Language requirements:
- `new_comment.message` MUST be Hebrew.
- If you provide `new_comment.teacher_text`, it MUST be Hebrew.

`new_comment.teacher_text` (private notes for teachers / reuse hints):
- Write **only** in Hebrew.
- Must be **as reusable** as `message`: describe the *kind* of issue and when this library line applies (e.g. typical mistake pattern), not this student's work.
- Do **NOT** mention: filenames, submission names, line numbers, specific variable/function/class names from the student's code, concrete I/O or test data from one submission, or phrases that tie the note to "this code", "here", "this file", or "this case".
- Do **NOT** restate details that belong in the annotation context; keep notes short and library-oriented.

The comment message must:

• Describe what MUST be done (instructional phrasing)
• NOT describe what the student did wrong
• Follow EXACT format:

"<תיאור קצר של הבעיה> - <הסבר מעט יותר מפורט>"

Rules:

* First part: 2–5 words.
* Then a dash ("-").
* Then a short clarification.
* Maximum 1–2 short sentences total.
* Be precise and concrete.
* Do not praise correct code.
* Do not add comments when no real problem exists.

Example:
"המרת קלט מוקדמת - יש לבדוק תחילה האם הוזן 'exit' לפני המרה ל־int כדי למנוע קריסה."

LINE NUMBER RULES:
* Line numbers MUST be integers.
* Valid range: 1–{len(lines)}.
* Each annotation must reference an existing line.
* Prefer the earliest responsible line.

OUTPUT REQUIREMENT:
Return ONLY the required structured JSON output.

Do NOT include explanations outside the JSON.
Do NOT include reasoning steps.
Do NOT include additional commentary.

STUDENT IMPROVEMENT RULES (field: "improvement"):
Return 1–2 short sentences in Hebrew that tell the student what to focus on next time.

How to choose what to say:
- Look at whether the student's code actually ran (use the PRIOR AUTOMATED CHECKER OUTPUT if present: SyntaxError/tracebacks/timeouts are strong signals).
- Look at the specific issues you are about to annotate (your own annotations in this same response).
- Pick the 1-2 highest-impact actions that would most likely turn this into a pass next time.

Constraints:
- Do not mention pass/fail.
- Do not mention line numbers.
- Prefer general advice, but you MAY reference a short snippet (1–2 lines) from the student's code if it makes the guidance clearer.
- You MAY mention a specific module/function ONLY if it is directly relevant to the failure (e.g., code doesn't run due to a SyntaxError or a missing import).
- Do not mention the model solution.
- Keep it friendly, short, and actionable.
- If you start with "להבא," that's fine but not required.

{auto_block}
----- START ASSIGNMENT DESCRIPTION --------------
```md
{assignment_md}
```
----- END ASSIGNMENT DESCRIPTION ----------------

----- START MODEL SOLUTION ----------------------
```python
{model_solution}
```
----- END MODEL SOLUTION ------------------------

----- START STUDENT CODE ------------------------
```
{numbered}
```
----- END STUDENT CODE --------------------------
"""

    raw = llm.complete(
        api_key,
        prompt,
        model=resolved_model,
        max_tokens=llm.max_output_tokens(resolved_model),
        json_schema=REVIEW_SCHEMA,
    )

    try:
        obj = json.loads(raw)
    except json.JSONDecodeError as e:
        preview = (raw or "").strip().replace("\n", "\\n")
        if len(preview) > 1200:
            preview = preview[:1200] + "...<truncated>"
        print(
            f"[checkmate][{llm.provider_id}][json-parse-error] student={student_id} "
            f"model={resolved_model} error={e} raw_preview={preview}"
        )
        obj = {}

    improvement = normalize_student_improvement(obj.get("improvement", ""))

    raw_anns = obj.get("annotations", [])

    valid_anns = []
    for ann in raw_anns if isinstance(raw_anns, list) else []:
        if not isinstance(ann, dict):
            continue
        line_ok = isinstance(ann.get("line"), int) and 1 <= ann.get("line", 0) <= len(lines)
        if not line_ok:
            continue

        cid = ann.get("comment_id")
        if isinstance(cid, str) and cid.strip():
            valid_anns.append({"line": ann.get("line"), "comment_id": cid.strip()})
            continue

        nc = ann.get("new_comment")
        if isinstance(nc, dict):
            msg = nc.get("message")
            if isinstance(msg, str) and msg.strip():
                try:
                    pts = max(0, int(nc.get("points") or 0))
                except (TypeError, ValueError):
                    pts = 0
                valid_anns.append(
                    {
                        "line": ann.get("line"),
                        "new_comment": {
                            "message": msg.strip(),
                            "teacher_text": str(nc.get("teacher_text") or "").strip(),
                            "points": pts,
                        },
                    }
                )

    score, passed = grade_from_review_annotations(valid_anns, lib_points_by_id)
    summary = compose_student_summary(improvement, score=score, passed=passed)

    return {
        "summary": summary,
        "annotations": valid_anns,
    }

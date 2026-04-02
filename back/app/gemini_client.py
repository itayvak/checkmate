"""Google Gemini API: schemas, HTTP calls, grading review, auto-checker prompt."""

import json
import re
from typing import Any

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
SUPPORTED_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
}
DEFAULT_MODEL = "gemini-2.5-flash-lite"

REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "grade": {
            "type": "string",
            "enum": ["pass", "fail"],
            "description": (
                'Binary grade as ASCII only: "pass" if all explicit assignment requirements are met, '
                '"fail" otherwise.'
            ),
        },
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
                            "teacher_text": {"type": "string", "description": "Optional teacher-only explanation in Hebrew (not shown to students)"},
                        },
                        "required": ["message"],
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
    "required": ["grade", "improvement", "annotations"],
}

def _normalize_student_improvement(improvement: Any) -> str:
    if not isinstance(improvement, str):
        return ""
    s = improvement.strip()
    # Keep it compact, but allow a snippet on a new line if provided.
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    # Collapse excessive internal whitespace (without destroying intentional newlines).
    s = re.sub(r"[ \t]{2,}", " ", s)
    # Soft length cap to keep the UI readable.
    if len(s) > 420:
        s = s[:420].rstrip() + "…"
    return s


def _compose_student_summary(grade: str, improvement: str) -> str:
    """
    Compose the UI-facing, two-paragraph Hebrew format:
    1) Pass/Fail statement (rigid)
    2) Blank line
    3) One general 'next time' suggestion (from AI or fallback)
    """
    base1 = (
        "חניך יקר, הפתרון שלך עומד בדרישות המטלה."
        if grade == "pass"
        else "חניך יקר, הפתרון שלך לא עובר את דרישות המטלה."
    )
    base2 = "להבא, קרא שוב את דרישות המטלה, הרץ את הקוד ובדוק שהוא עומד בכל הדרישות לפני ההגשה."

    imp = (improvement or "").strip()
    if not imp:
        return f"{base1}\n\n{base2}"
    if not imp.startswith("להבא"):
        imp = f"להבא, {imp.lstrip(' ,')}"
    return f"{base1}\n\n{imp}"

def normalize_checker_script_response(raw: str) -> str:
    """
    Gemini returns plain Python for auto-checkers; strip optional markdown fences or leading prose.
    Handles truncated responses where the closing fence is missing.
    """
    text = (raw or "").strip()
    if not text:
        return ""

    # Fully-fenced block (opening + closing ```)
    m = re.match(r"^```(?:python|py)?\s*\r?\n(.*)```\s*$", text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()

    m = re.search(r"```(?:python|py)\s*\r?\n(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()

    m = re.search(r"```\s*\r?\n(.*?)```", text, re.DOTALL)
    if m:
        inner = m.group(1).strip()
        if any(
            inner.startswith(p)
            for p in ("import ", "from ", "#", '"""', "'''")
        ) or "def " in inner[:800]:
            return inner

    # Truncated fence — opening ``` present but no closing ``` (response was cut off)
    m = re.match(r"^```(?:python|py)?\s*\r?\n(.*)", text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()

    lines = text.splitlines()
    for i, line in enumerate(lines):
        s = line.strip()
        if not s:
            continue
        if (
            s.startswith(("import ", "from ", "#", "@", "def ", "class "))
            or s.startswith(('"""', "'''"))
        ):
            return "\n".join(lines[i:]).strip()

    return text


def generate_auto_checker_prompt(
    assignment_md: str,
    model_solution_py: str,
    extra_instructions: str,
) -> str:
    extra = extra_instructions.strip()
    extra_block = f"""
IMPORTANT — TEACHER'S CUSTOM INSTRUCTIONS:
These instructions override your default test-design choices.
You MUST follow them exactly when deciding which tests to write.

{extra}

""" if extra else ""
    return f"""You are an expert Python programming instructor and automation engineer.

I will give you the following:

1. The OFFICIAL SOLUTION CODE for a programming assignment.
2. A MARKDOWN file that describes the assignment instructions given to students.
3. IMPORTANT custom instructions from the teacher (if provided) that you must follow exactly.

Your task is to create a Python script that checks whether ONE student's submission works correctly.
{extra_block}
GOAL
Create a script named `check_student.py` that tests a single student's Python file against the assignment requirements.

GENERAL REQUIREMENTS
1. The script must test ONLY ONE student submission at a time.
2. The student's file path must be provided as a command-line argument:
   `python check_student.py student_solution.py`
3. The checker must:
   * run the student's program
   * automatically provide inputs when `input()` is called
   * capture program output
   * verify correctness using test cases derived from BOTH:
     1. the assignment markdown
     2. the official solution behavior

TEST DESIGN
4. Infer realistic test scenarios from the assignment description.
5. Use multiple test cases when appropriate.
6. Validate behavior logically, not only exact printed formatting.
7. Allow reasonable formatting differences unless formatting is explicitly required by the assignment.
8. Clearly display which tests passed or failed.

EXECUTION REQUIREMENTS
9. Use Python's `subprocess` module to run the student's program.
10. Provide inputs via stdin.
11. Capture stdout and stderr.
12. Detect and report:
    * runtime errors
    * crashes
    * programs that never terminate (use a timeout).

CHECK MATE REPORTER — include this block VERBATIM at the very top of your checker script (after any module docstring):

```python
# ── Check Mate reporter (do not modify) ──────────────────────────────────────
import json as _json, sys as _sys

class _Reporter:
    def __init__(self): self._checks = []
    def check(self, name: str, passed: bool, message: str = ""):
        self._checks.append({{"name": name, "passed": passed, "message": message}})
    def finish(self):
        _p = sum(1 for t in self._checks if t["passed"])
        print(_json.dumps({{
            "checkmate_result": True,
            "checks": self._checks,
            "passed": _p,
            "total": len(self._checks),
        }}, ensure_ascii=False))
        _sys.exit(0 if _p == len(self._checks) else 1)

reporter = _Reporter()
# ── End Check Mate reporter ───────────────────────────────────────────────────
```

OUTPUT FORMAT
* For each check case call: `reporter.check("descriptive check name", passed=True/False, message="reason on failure")`
* At the very end of the script call: `reporter.finish()` — this prints the structured JSON result and exits.
* NEVER call `print()` to stdout for anything else — all debug output must go to stderr (`print(..., file=sys.stderr)`).
* NEVER call `sys.exit()` directly — always use `reporter.finish()`.
* The `message` field should be empty string `""` on pass, and a short human-readable explanation on fail.

CODE QUALITY

* Produce clean, readable, well-commented Python code.
* The script should be easy for a teacher to modify later.
* Avoid unnecessary complexity or external dependencies.

RESPONSE FORMAT

Output ONLY the complete Python source code for the checker script.
Do not wrap it in JSON. Do not add explanations, headings, or markdown code fences before or after the code.
If you use a module docstring at the top, that docstring is part of the script (allowed).

Put example usage in the module docstring. Put a brief note on how tests were derived in comments
near the top or above the test list.

--- START ASSIGNMENT MARKDOWN -----------------------
```markdown
{assignment_md}
```
--- END ASSIGNMENT MARKDOWN -----------------------

--- START OFFICIAL SOLUTION CODE -----------------------
```python
{model_solution_py}
```
--- END OFFICIAL SOLUTION CODE -----------------------
"""


def _extract_gemini_response_text(data: dict) -> str:
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


def _format_gemini_http_error(resp: Any) -> str:
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


def call_gemini(
    api_key: str,
    prompt: str,
    model_name: str = DEFAULT_MODEL,
    max_tokens: int = 8192,
    response_schema: dict = None,
) -> str:
    import requests as req

    url = f"{GEMINI_API_BASE}/{model_name}:generateContent?key={api_key}"

    gen_config = {"temperature": 0.2, "maxOutputTokens": max_tokens}
    if response_schema:
        gen_config["responseMimeType"] = "application/json"
        gen_config["responseJsonSchema"] = response_schema

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": gen_config,
    }

    resp = req.post(url, json=body, timeout=120)
    if not resp.ok:
        detail = _format_gemini_http_error(resp)
        raise ValueError(f"Gemini API HTTP {resp.status_code}: {detail}")

    data = resp.json()
    return _extract_gemini_response_text(data)


def review_student_code(
    api_key,
    student_code,
    model_solution,
    assignment_md,
    student_id="?",
    model_name=DEFAULT_MODEL,
    *,
    student_filename: str | None = None,
    auto_check_output: str | None = None,
    extra_instructions: str | None = None,
    comment_library: list[dict[str, Any]] | None = None,
):
    lines = student_code.split("\n")

    numbered = "\n".join(f"{i+1:>3}: {line}" for i, line in enumerate(lines))

    auto_block = ""
    ac = (auto_check_output or "").strip()
    if ac:
        fn_label = (student_filename or "").strip() or "(filename unknown)"
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
    lib_rows: list[dict[str, str]] = []
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
            }
        )
    library_block = ""
    if lib_rows:
        library_block = f"""
COMMENT LIBRARY (use these predefined comments when possible):
The following list is a set of allowed comments. Prefer referencing an existing comment by its ID.
Only create a new comment when none match the requirement you need to flag.

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

➡️ Does the student's program fully satisfy every explicit requirement stated in the assignment description?


GRADING RULE (BINARY ONLY):
The JSON field `"grade"` MUST be exactly one of:

* `"pass"` — ONLY if ALL explicit requirements are fully satisfied.
* `"fail"` — if ANY requirement is missing, incorrect, or produces different required behavior.

There is NO partial credit.

Even a small missing required behavior ⇒ `"fail"`.

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
- If you provide `new_comment.teacher_text`, it MUST also be Hebrew.

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

    raw = call_gemini(
        api_key,
        prompt,
        model_name=model_name,
        max_tokens=6500,
        response_schema=REVIEW_SCHEMA,
    )

    try:
        obj = json.loads(raw)
    except json.JSONDecodeError as e:
        preview = (raw or "").strip().replace("\n", "\\n")
        if len(preview) > 1200:
            preview = preview[:1200] + "...<truncated>"
        print(
            f"[checkmate][gemini][json-parse-error] student={student_id} "
            f"model={model_name} error={e} raw_preview={preview}"
        )
        obj = {}

    raw_grade = obj.get("grade", "fail")
    if isinstance(raw_grade, str):
        g = raw_grade.strip().lower()
        if g in ("pass", "עבר"):
            grade = "pass"
        elif g in ("fail", "נכשל", "חלקי"):
            grade = "fail"
        else:
            grade = "fail"
    else:
        grade = "fail"
    improvement = _normalize_student_improvement(obj.get("improvement", ""))
    summary = _compose_student_summary(grade, improvement)

    raw_anns = obj.get("annotations", [])

    valid_anns = []
    for i, ann in enumerate(raw_anns if isinstance(raw_anns, list) else []):
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
                valid_anns.append(
                    {
                        "line": ann.get("line"),
                        "new_comment": {
                            "message": msg.strip(),
                            "teacher_text": str(nc.get("teacher_text") or "").strip(),
                        },
                    }
                )

    return {
        "grade": grade,
        "summary": summary,
        "annotations": valid_anns,
    }

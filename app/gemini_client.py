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
                '"fail" otherwise (maps to Hebrew עבר / נכשל in the app).'
            ),
        },
        "summary": {
            "type": "string",
            "description": "1-2 sentences in Hebrew summarising student performance",
        },
        "annotations": {
            "type": "array",
            "description": "One entry per flagged line",
            "items": {
                "type": "object",
                "properties": {
                    "line": {"type": "integer", "description": "1-based line number"},
                    "comment": {"type": "string", "description": "Hebrew comment text"},
                },
                "required": ["line", "comment"],
            },
        },
    },
    "required": ["grade", "summary", "annotations"],
}

def normalize_checker_script_response(raw: str) -> str:
    """
    Gemini returns plain Python for auto-checkers; strip optional markdown fences or leading prose.
    """
    text = (raw or "").strip()
    if not text:
        return ""

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
    extra_block = f"\n\nADDITIONAL USER INSTRUCTIONS:\n{extra}\n" if extra else ""
    return f"""You are an expert Python programming instructor and automation engineer.

I will give you TWO things:

1. The OFFICIAL SOLUTION CODE for a programming assignment.
2. A MARKDOWN file that describes the assignment instructions given to students.

Your task is to create a Python script that checks whether ONE student's submission works correctly.

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

OUTPUT FORMAT
The checker must print:
* Each test name
* PASS or FAIL
* Explanation when a test fails
* Final summary result

Example output:
```
Running tests for student_solution.py

Test 1 — Create registry value: PASS
Test 2 — Modify value: PASS
Test 3 — Delete value: FAIL
Reason: value still exists after delete operation

FINAL RESULT: 2/3 tests passed
```
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

    prompt = f"""You are a **strict Python assignment evaluator** reviewing a single student submission.

Your role is **not** to teach, refactor, optimize, or suggest improvements.
Your role is ONLY to determine whether the student correctly implemented the assignment requirements.

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

All comments MUST be written in **Hebrew only**.

Each comment must:

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
            grade = "עבר"
        elif g in ("fail", "נכשל", "חלקי"):
            grade = "נכשל"
        else:
            grade = "נכשל"
    else:
        grade = "נכשל"
    summary = obj.get("summary", "")

    raw_anns = obj.get("annotations", [])

    valid_anns = []
    for i, ann in enumerate(raw_anns if isinstance(raw_anns, list) else []):
        line_ok = isinstance(ann.get("line"), int) and 1 <= ann.get("line", 0) <= len(lines)
        comment_ok = isinstance(ann.get("comment"), str) and len(ann.get("comment", "")) > 0
        if line_ok and comment_ok:
            valid_anns.append(
                {
                    "line": ann.get("line"),
                    "comment": ann.get("comment"),
                }
            )

    return {
        "grade": grade,
        "summary": summary,
        "annotations": valid_anns,
    }

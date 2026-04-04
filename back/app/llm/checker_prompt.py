"""Prompts and response cleanup for auto-checker script generation."""

import re


def normalize_checker_script_response(raw: str) -> str:
    """
    Models return plain Python for auto-checkers; strip optional markdown fences or leading prose.
    Handles truncated responses where the closing fence is missing.
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

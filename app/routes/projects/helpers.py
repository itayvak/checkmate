import json
import os
import uuid
from datetime import datetime
from typing import Any, Optional

from ...db import save_batch_run_session


_MAX_BATCH_FILES = 80
_PER_STUDENT_TIMEOUT_SEC = 90


def _checker_subprocess_env() -> dict[str, str]:
    """Force UTF-8 stdio so checker scripts can print non-ASCII safely on Windows."""
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    return env


def _decode_upload(f) -> str:
    try:
        return f.read().decode("utf-8")
    except UnicodeDecodeError:
        f.seek(0)
        return f.read().decode("latin-1")


def _normalize_title(raw: Any) -> str:
    if not isinstance(raw, str):
        return ""
    t = raw.strip()
    return t[:200] if len(t) > 200 else t


def _normalize_source_filename(raw: Any) -> str:
    fn = os.path.basename(str(raw or "submission.py")) or "submission.py"
    if not fn.endswith(".py"):
        fn = f"{fn}.py"
    return fn


def _try_parse_checkmate_result(stdout: str) -> Optional[dict[str, Any]]:
    """Return parsed Check Mate JSON result if stdout matches the protocol, else None."""
    if not stdout:
        return None
    try:
        data = json.loads(stdout.strip())
        if isinstance(data, dict) and data.get("checkmate_result") is True:
            return data
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def _format_checker_run_output(r: dict[str, Any]) -> str:
    """Return raw checker process output with no additional formatting."""
    out = str(r.get("stdout") or "")
    se = str(r.get("stderr") or "")
    err = str(r.get("error") or "")

    if out and se:
        sep = "" if out.endswith("\n") else "\n"
        return out + sep + se
    if out:
        return out
    if se:
        return se
    if err:
        return err
    return "(no output)"


def _persist_batch_run(
    project_id: str,
    project_name: str,
    checker_script: str,
    raw_results: list[dict[str, Any]],
    assignment_name: str,
) -> str:
    normalized: list[dict[str, Any]] = []
    for item in raw_results:
        if not isinstance(item, dict):
            continue
        fn = os.path.basename(str(item.get("filename") or "submission.py")) or "submission.py"
        if not fn.endswith(".py"):
            fn = f"{fn}.py"
        row: dict[str, Any] = {
            "filename": fn,
            "exit_code": item.get("exit_code"),
            "stdout": item.get("stdout") if isinstance(item.get("stdout"), str) else "",
            "stderr": item.get("stderr") if isinstance(item.get("stderr"), str) else "",
            "error": item.get("error") if item.get("error") else None,
        }
        parsed = _try_parse_checkmate_result(row["stdout"])
        if parsed:
            row["check_cases"] = parsed.get("checks") or []
            row["passed"] = parsed.get("passed")
            row["total"] = parsed.get("total")
        row["output"] = _format_checker_run_output(row)
        normalized.append(row)
    if not normalized:
        raise ValueError("No valid result entries.")

    batch_id = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "project_id": project_id,
        "checker_script": checker_script.strip(),
        "results": normalized,
        "assignment_name": assignment_name,
        "session_title": f"{project_name} ({datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')})",
    }
    save_batch_run_session(batch_id, payload)
    return batch_id


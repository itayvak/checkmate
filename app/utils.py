import os
from typing import Any, Optional


def parse_student_identity(filename: str) -> tuple[str, str]:
    basename_no_ext = os.path.splitext(filename)[0]
    parts = basename_no_ext.rsplit("_", 1)
    student_id = parts[-1] if len(parts) > 1 else basename_no_ext
    test_name = parts[0] if len(parts) > 1 else "test"
    return student_id, test_name


def _row_checker_text(r: dict[str, Any]) -> Optional[str]:
    out = r.get("output")
    if isinstance(out, str) and out.strip():
        return out.strip()
    chunks: list[str] = []
    err = r.get("error")
    if err:
        chunks.append(f"ERROR: {err}")
    so = r.get("stdout") or ""
    if so:
        chunks.append("STDOUT:\n" + so)
    se = r.get("stderr") or ""
    if se:
        chunks.append("STDERR:\n" + se)
    s = "\n\n".join(chunks).strip()
    return s if s else None


def batch_output_for_matching_filename(
    batch_payload: dict[str, Any],
    student_upload_basename: str,
) -> Optional[str]:
    """
    Return stored checker output for the batch row whose filename matches the student's .py basename
    (exact match, then case-insensitive on basename).
    """
    results = batch_payload.get("results")
    if not isinstance(results, list):
        return None
    target = os.path.basename((student_upload_basename or "").strip())
    if not target:
        return None

    def names_equal(fn: str) -> bool:
        return os.path.basename(fn) == target or fn == target

    for r in results:
        if isinstance(r, dict):
            fn = r.get("filename")
            if isinstance(fn, str) and names_equal(fn):
                t = _row_checker_text(r)
                if t:
                    return t

    tl = target.lower()
    for r in results:
        if isinstance(r, dict):
            fn = r.get("filename")
            if isinstance(fn, str):
                if os.path.basename(fn).lower() == tl or fn.lower() == tl:
                    t = _row_checker_text(r)
                    if t:
                        return t
    return None

"""Normalize model review output and compute grades / student-facing summary."""

import re
from typing import Any


def normalize_student_improvement(improvement: Any) -> str:
    if not isinstance(improvement, str):
        return ""
    s = improvement.strip()
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    s = re.sub(r"[ \t]{2,}", " ", s)
    if len(s) > 420:
        s = s[:420].rstrip() + "…"
    return s


def grade_from_review_annotations(
    valid_anns: list[dict[str, Any]],
    lib_points_by_id: dict[str, int],
) -> tuple[int, bool]:
    """
    Match front-end checkRunStats.computeAnnotationGrade: 100 − sum(deductions), pass if ≥ 70.
    For library comments use project library points; for new_comment use the model's points field.
    """
    if not valid_anns:
        return 100, True
    deduction = 0
    for ann in valid_anns:
        cid = ann.get("comment_id")
        if isinstance(cid, str) and cid.strip():
            deduction += max(0, int(lib_points_by_id.get(cid.strip(), 0)))
            continue
        nc = ann.get("new_comment")
        if isinstance(nc, dict):
            try:
                deduction += max(0, int(nc.get("points") or 0))
            except (TypeError, ValueError):
                pass
    score = max(0, 100 - deduction)
    return score, score >= 70


def compose_student_summary(improvement: str, *, score: int, passed: bool) -> str:
    grade_line = (
        "חניך יקר, הפתרון שלך עובר את דרישות המטלה."
        if passed
        else "חניך יקר, הפתרון שלך לא עובר את דרישות המטלה."
    )
    if score >= 100:
        return f"{grade_line}\n\nכל הכבוד!"
    fallback = "להבא, קרא שוב את דרישות המטלה, הרץ את הקוד ובדוק שהוא עומד בכל הדרישות לפני ההגשה."
    imp = (improvement or "").strip()
    if not imp:
        imp_body = fallback
    elif not imp.startswith("להבא"):
        imp_body = f"להבא, {imp.lstrip(' ,')}"
    else:
        imp_body = imp
    return f"{grade_line}\n\n{imp_body}"

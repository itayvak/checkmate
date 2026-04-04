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
    lib_points_and_max_by_id: dict[str, tuple[int, int]],
) -> tuple[int, bool]:
    """
    Match front-end checkRunStats.computeAnnotationGrade: 100 − capped sum of deductions, pass if ≥ 70.
    lib_points_and_max_by_id maps comment_id -> (per-annotation points, max total for that id).
    Unresolved new_comment entries share a cap of 100 per distinct (title, details) pair (same as AI-created library rows).
    """
    if not valid_anns:
        return 100, True
    used: dict[str, int] = {}
    deduction = 0
    for ann in valid_anns:
        cid = ann.get("comment_id")
        if isinstance(cid, str) and cid.strip():
            k = cid.strip()
            pts, cap = lib_points_and_max_by_id.get(k, (0, 0))
            u = used.get(k, 0)
            room = max(0, cap - u)
            d = min(max(0, pts), room)
            used[k] = u + d
            deduction += d
            continue
        nc = ann.get("new_comment")
        if isinstance(nc, dict):
            try:
                pts = max(0, int(nc.get("points") or 0))
            except (TypeError, ValueError):
                pts = 0
            title = str(nc.get("title") or nc.get("message") or "").strip()
            det = str(nc.get("details") or "").strip()
            k = f"__new__:{title}\n{det}"
            cap = 100
            u = used.get(k, 0)
            room = max(0, cap - u)
            step = min(pts, room)
            used[k] = u + step
            deduction += step
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

import os
from typing import Any, Optional

from flask import jsonify, request

from ...db import (
    list_project_comments,
    load_grading_session,
    load_project,
    save_grading_session,
)
from . import bp


@bp.post("/projects/<project_id>/annotations/delete")
def delete_one_annotation(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    grading_id = (project.get("last_grading_session_id") or "").strip()
    if not grading_id:
        return jsonify({"ok": False, "error": "No grading session found for this project."}), 400

    only_fn = (request.form.get("only_filename") or "").strip()
    line_raw = (request.form.get("line") or "").strip()
    if not only_fn or not line_raw:
        return jsonify({"ok": False, "error": "Missing only_filename or line."}), 400

    try:
        line = int(line_raw)
    except ValueError:
        return jsonify({"ok": False, "error": "Invalid line (must be an integer)."}), 400
    if line <= 0:
        return jsonify({"ok": False, "error": "Invalid line (must be > 0)."}), 400

    target_fn = os.path.basename(only_fn)
    gs = load_grading_session(grading_id) or {}
    results = gs.get("results")
    if not isinstance(results, dict) or not results:
        return jsonify({"ok": False, "error": "No grading results found."}), 400

    changed = False
    updated_item: Optional[dict[str, Any]] = None
    for sid, item in results.items():
        if not isinstance(item, dict):
            continue
        fn = os.path.basename(str(item.get("filename") or ""))
        if fn != target_fn:
            continue

        anns = item.get("annotations")
        if not isinstance(anns, list):
            anns = []
        before = len(anns)
        kept: list[Any] = []
        for a in anns:
            if isinstance(a, dict) and a.get("line") == line:
                continue
            kept.append(a)

        if len(kept) != before:
            item["annotations"] = kept
            results[sid] = item
            changed = True

        updated_item = item
        break

    if not changed:
        return jsonify({"ok": False, "error": "Annotation not found for that file/line."}), 404

    gs["results"] = results
    try:
        save_grading_session(grading_id, gs)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Could not save grading session: {e}"}), 500

    out = {
        "grade": (updated_item or {}).get("grade") or "",
        "summary": (updated_item or {}).get("summary") or "",
        "annotations": (updated_item or {}).get("annotations") or [],
    }
    return jsonify({"ok": True, "annotation": out})


@bp.post("/projects/<project_id>/annotations/add")
def add_one_annotation(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    grading_id = (project.get("last_grading_session_id") or "").strip()
    if not grading_id:
        return jsonify({"ok": False, "error": "No grading session found for this project."}), 400

    only_fn = (request.form.get("only_filename") or "").strip()
    line_raw = (request.form.get("line") or "").strip()
    comment_id = (request.form.get("comment_id") or "").strip()
    if not only_fn or not line_raw or not comment_id:
        return jsonify({"ok": False, "error": "Missing only_filename, line, or comment_id."}), 400

    try:
        line = int(line_raw)
    except ValueError:
        return jsonify({"ok": False, "error": "Invalid line (must be an integer)."}), 400
    if line <= 0:
        return jsonify({"ok": False, "error": "Invalid line (must be > 0)."}), 400

    # Validate the comment id exists in this project's library
    lib = list_project_comments(project_id)
    if not any(isinstance(c, dict) and str(c.get("id") or "") == comment_id for c in lib):
        return jsonify({"ok": False, "error": "Unknown comment_id for this project."}), 400

    target_fn = os.path.basename(only_fn)
    gs = load_grading_session(grading_id) or {}
    results = gs.get("results")
    if not isinstance(results, dict) or not results:
        return jsonify({"ok": False, "error": "No grading results found."}), 400

    changed = False
    updated_item: Optional[dict[str, Any]] = None
    for sid, item in results.items():
        if not isinstance(item, dict):
            continue
        fn = os.path.basename(str(item.get("filename") or ""))
        if fn != target_fn:
            continue

        anns = item.get("annotations")
        if not isinstance(anns, list):
            anns = []

        # Replace any existing annotation on that line (keeps 1 annotation per line)
        kept: list[Any] = []
        for a in anns:
            if isinstance(a, dict) and a.get("line") == line:
                continue
            kept.append(a)
        kept.append({"line": line, "comment_id": comment_id})
        kept.sort(key=lambda x: x.get("line") if isinstance(x, dict) else 10**9)

        item["annotations"] = kept
        results[sid] = item
        changed = True
        updated_item = item
        break

    if not changed:
        return jsonify({"ok": False, "error": "Student not found in grading results."}), 404

    gs["results"] = results
    try:
        save_grading_session(grading_id, gs)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Could not save grading session: {e}"}), 500

    out = {
        "grade": (updated_item or {}).get("grade") or "",
        "summary": (updated_item or {}).get("summary") or "",
        "annotations": (updated_item or {}).get("annotations") or [],
    }
    return jsonify({"ok": True, "annotation": out})


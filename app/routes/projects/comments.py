from flask import jsonify, request

from ...db import (
    create_project_comment,
    delete_project_comment,
    list_project_comments,
    load_project,
    update_project_comment,
)
from . import bp


@bp.get("/projects/<project_id>/comments")
def project_comments_list(project_id: str):
    if not load_project(project_id):
        return jsonify({"ok": False, "error": "Unknown project id."}), 404
    return jsonify({"ok": True, "comments": list_project_comments(project_id)})


@bp.post("/projects/<project_id>/comments")
def project_comments_create(project_id: str):
    if not load_project(project_id):
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    body = request.get_json(silent=True) if request.is_json else None
    message = (request.form.get("message") or (body.get("message") if isinstance(body, dict) else "") or "").strip()
    teacher_text = (request.form.get("teacher_text") or (body.get("teacher_text") if isinstance(body, dict) else "") or "").strip()

    try:
        created = create_project_comment(project_id, message=message, teacher_text=teacher_text, key=None)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    return jsonify({"ok": True, "comment": created})


@bp.post("/projects/<project_id>/comments/<comment_id>")
def project_comments_update(project_id: str, comment_id: str):
    if not load_project(project_id):
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    body = request.get_json(silent=True) if request.is_json else None
    message = request.form.get("message")
    teacher_text = request.form.get("teacher_text")

    if isinstance(body, dict):
        if message is None and "message" in body:
            message = body.get("message")
        if teacher_text is None and "teacher_text" in body:
            teacher_text = body.get("teacher_text")

    try:
        updated = update_project_comment(
            comment_id,
            message=message if message is None else str(message),
            teacher_text=teacher_text if teacher_text is None else str(teacher_text),
            key=None,
        )
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    if not updated or updated.get("project_id") != project_id:
        return jsonify({"ok": False, "error": "Comment not found for this project."}), 404
    return jsonify({"ok": True, "comment": updated})


@bp.post("/projects/<project_id>/comments/<comment_id>/delete")
def project_comments_delete(project_id: str, comment_id: str):
    if not load_project(project_id):
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    # Ensure the comment belongs to this project before deleting
    lib = list_project_comments(project_id)
    if not any(isinstance(c, dict) and str(c.get("id") or "") == comment_id for c in lib):
        return jsonify({"ok": False, "error": "Comment not found for this project."}), 404

    ok = delete_project_comment(comment_id)
    if not ok:
        return jsonify({"ok": False, "error": "Comment could not be deleted."}), 400
    return jsonify({"ok": True})


import io

from flask import jsonify, request, send_file

from ...comment_library_export import build_comment_library_xlsx_bytes, comment_library_export_filename
from ...comment_library_import import parse_comment_library_xlsx
from ...db import (
    create_project_comment,
    delete_project_comment,
    list_project_comments,
    load_project,
    update_project_comment,
)
from . import bp


@bp.get("/projects/<project_id>/comments/export")
def project_comments_export(project_id: str):
    proj = load_project(project_id)
    if not proj:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    comments = list_project_comments(project_id)
    project_name = str(proj.get("name") or "").strip() or "project"
    data = build_comment_library_xlsx_bytes(
        comments,
        sheet_title=f"{project_name}_comments",
    )
    return send_file(
        io.BytesIO(data),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=comment_library_export_filename(project_name),
    )


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
    title = (request.form.get("title") or (body.get("title") if isinstance(body, dict) else "") or "").strip()
    details = (request.form.get("details") or (body.get("details") if isinstance(body, dict) else "") or "").strip()
    legacy_msg = (request.form.get("message") or (body.get("message") if isinstance(body, dict) else "") or "").strip()
    if not title and legacy_msg:
        title = legacy_msg
    teacher_text = (request.form.get("teacher_text") or (body.get("teacher_text") if isinstance(body, dict) else "") or "").strip()
    _points_raw = request.form.get("points") or (body.get("points") if isinstance(body, dict) else None)
    try:
        points = int(_points_raw) if _points_raw is not None else 0
    except (TypeError, ValueError):
        points = 0
    _max_raw = request.form.get("max_points") or (body.get("max_points") if isinstance(body, dict) else None)
    try:
        max_points = int(_max_raw) if _max_raw is not None else 100
    except (TypeError, ValueError):
        max_points = 100

    try:
        created = create_project_comment(
            project_id,
            title=title,
            details=details,
            teacher_text=teacher_text,
            points=points,
            max_points=max_points,
            key=None,
        )
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    return jsonify({"ok": True, "comment": created})


@bp.post("/projects/<project_id>/comments/import/preview")
def project_comments_import_preview(project_id: str):
    if not load_project(project_id):
        return jsonify({"ok": False, "error": "Unknown project id."}), 404
    upload = request.files.get("file")
    if not upload or not upload.filename:
        return jsonify({"ok": False, "error": "No file uploaded."}), 400
    try:
        raw = upload.read()
        rows, skipped = parse_comment_library_xlsx(raw)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Could not read spreadsheet: {e}"}), 400
    if not rows:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "No comments to import (each row needs a non-empty title in column B).",
                    "skipped": skipped,
                }
            ),
            400,
        )
    return jsonify({"ok": True, "rows": rows, "skipped": skipped})


@bp.post("/projects/<project_id>/comments/import")
def project_comments_import_apply(project_id: str):
    if not load_project(project_id):
        return jsonify({"ok": False, "error": "Unknown project id."}), 404
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"ok": False, "error": "Expected JSON body."}), 400
    raw_rows = body.get("rows")
    if not isinstance(raw_rows, list) or len(raw_rows) == 0:
        return jsonify({"ok": False, "error": "No rows to import."}), 400

    created: list[dict] = []
    errors: list[dict[str, int | str]] = []
    for i, raw in enumerate(raw_rows):
        if not isinstance(raw, dict):
            errors.append({"index": i, "error": "invalid row"})
            continue
        title = str(raw.get("title") or "").strip()
        if not title:
            errors.append({"index": i, "error": "empty title"})
            continue
        details = str(raw.get("details") or "").strip()
        teacher_text = str(raw.get("teacher_text") or "").strip()
        try:
            points = int(raw.get("points") if raw.get("points") is not None else 0)
        except (TypeError, ValueError):
            points = 0
        try:
            max_points = int(raw.get("max_points") if raw.get("max_points") is not None else 100)
        except (TypeError, ValueError):
            max_points = 100
        points = max(0, points)
        max_points = max(0, max_points)
        try:
            row = create_project_comment(
                project_id,
                title=title,
                details=details,
                teacher_text=teacher_text,
                points=points,
                max_points=max_points,
                key=None,
            )
            created.append(row)
        except Exception as e:
            errors.append({"index": i, "error": str(e)})

    return jsonify(
        {
            "ok": True,
            "comments": created,
            "errors": errors or None,
        }
    )


@bp.post("/projects/<project_id>/comments/<comment_id>")
def project_comments_update(project_id: str, comment_id: str):
    if not load_project(project_id):
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    body = request.get_json(silent=True) if request.is_json else None
    title = request.form.get("title")
    details = request.form.get("details")
    teacher_text = request.form.get("teacher_text")
    points_raw = request.form.get("points")
    max_points_raw = request.form.get("max_points")

    if isinstance(body, dict):
        if title is None and "title" in body:
            title = body.get("title")
        if title is None and "message" in body:
            title = body.get("message")
        if details is None and "details" in body:
            details = body.get("details")
        if teacher_text is None and "teacher_text" in body:
            teacher_text = body.get("teacher_text")
        if points_raw is None and "points" in body:
            points_raw = body.get("points")
        if max_points_raw is None and "max_points" in body:
            max_points_raw = body.get("max_points")

    points: int | None = None
    if points_raw is not None:
        try:
            points = int(points_raw)
        except (TypeError, ValueError):
            points = 0

    max_points: int | None = None
    if max_points_raw is not None:
        try:
            max_points = int(max_points_raw)
        except (TypeError, ValueError):
            max_points = 0

    try:
        updated = update_project_comment(
            comment_id,
            title=title if title is None else str(title),
            details=details if details is None else str(details),
            teacher_text=teacher_text if teacher_text is None else str(teacher_text),
            points=points,
            max_points=max_points,
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


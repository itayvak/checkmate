import os
from datetime import datetime
from typing import Any

from flask import jsonify, request

from ...db import (
    load_batch_run_session,
    load_grading_session,
    load_project,
    load_project_source_set,
    save_batch_run_session,
    save_grading_session,
    save_project_source_set,
)
from . import bp
from .helpers import _MAX_BATCH_FILES, _decode_upload, _normalize_source_filename


@bp.post("/projects/<project_id>/sources/upload")
def upload_sources(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    uploads = request.files.getlist("student_files")
    files = [f for f in uploads if f and f.filename]
    if not files:
        return jsonify({"ok": False, "error": "Upload at least one student .py file."}), 400
    if len(files) > _MAX_BATCH_FILES:
        return jsonify({"ok": False, "error": f"Too many files (max {_MAX_BATCH_FILES})."}), 400

    rows: list[dict[str, str]] = []
    for f in files:
        filename = _normalize_source_filename(f.filename)
        try:
            code = _decode_upload(f)
        except Exception as e:
            return jsonify({"ok": False, "error": f"Could not read {filename}: {e}"}), 400
        rows.append({"filename": filename, "code": code})

    # Merge uploads into the existing set by filename so new uploads append,
    # while re-uploading an existing filename updates that specific source.
    existing_set = load_project_source_set(project_id) or {}
    existing_rows = existing_set.get("files")
    merged_by_filename: dict[str, dict[str, str]] = {}
    if isinstance(existing_rows, list):
        for row in existing_rows:
            if not isinstance(row, dict):
                continue
            fn = os.path.basename(str(row.get("filename") or "submission.py")) or "submission.py"
            if not fn.endswith(".py"):
                fn = f"{fn}.py"
            merged_by_filename[fn] = {"filename": fn, "code": str(row.get("code") or "")}
    for row in rows:
        merged_by_filename[row["filename"]] = row

    save_project_source_set(
        project_id,
        {
            "uploaded_at": datetime.utcnow().isoformat(),
            "files": list(merged_by_filename.values()),
        },
    )
    return jsonify({"ok": True, "count": len(rows)})


@bp.post("/projects/<project_id>/sources/delete")
def delete_source(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    only_fn = (request.form.get("only_filename") or "").strip()
    if not only_fn and request.is_json:
        body = request.get_json(silent=True) or {}
        only_fn = str(body.get("only_filename") or "").strip()
    if not only_fn:
        return jsonify({"ok": False, "error": "Missing only_filename."}), 400
    target_fn = _normalize_source_filename(only_fn)

    student_set = load_project_source_set(project_id) or {}
    rows = student_set.get("files")
    if not isinstance(rows, list) or not rows:
        return jsonify({"ok": False, "error": "No source files uploaded for this project."}), 400

    remaining_rows: list[dict[str, str]] = []
    removed_source = False
    for row in rows:
        if not isinstance(row, dict):
            continue
        row_fn = _normalize_source_filename(row.get("filename"))
        if row_fn == target_fn:
            removed_source = True
            continue
        remaining_rows.append({"filename": row_fn, "code": str(row.get("code") or "")})

    if not removed_source:
        return jsonify({"ok": False, "error": f"Source '{target_fn}' not found in this project."}), 404

    save_project_source_set(
        project_id,
        {
            "uploaded_at": datetime.utcnow().isoformat(),
            "files": remaining_rows,
        },
    )

    removed_check_rows = 0
    batch_id = (project.get("last_batch_id") or "").strip()
    if batch_id:
        batch = load_batch_run_session(batch_id) or {}
        b_results = batch.get("results")
        if isinstance(b_results, list):
            kept_results: list[Any] = []
            for item in b_results:
                if not isinstance(item, dict):
                    kept_results.append(item)
                    continue
                item_fn = _normalize_source_filename(item.get("filename"))
                if item_fn == target_fn:
                    removed_check_rows += 1
                    continue
                kept_results.append(item)
            if removed_check_rows:
                batch["results"] = kept_results
                save_batch_run_session(batch_id, batch)

    removed_annotation_rows = 0
    grading_id = (project.get("last_grading_session_id") or "").strip()
    if grading_id:
        grading = load_grading_session(grading_id) or {}
        g_results = grading.get("results")
        if isinstance(g_results, dict):
            kept_results_by_id: dict[str, Any] = {}
            for sid, item in g_results.items():
                if not isinstance(item, dict):
                    kept_results_by_id[sid] = item
                    continue
                item_fn = _normalize_source_filename(item.get("filename"))
                if item_fn == target_fn:
                    removed_annotation_rows += 1
                    continue
                kept_results_by_id[sid] = item
            if removed_annotation_rows:
                grading["results"] = kept_results_by_id
                grading["student_count"] = len(kept_results_by_id)
                existing_sd = grading.get("students_data")
                if isinstance(existing_sd, list):
                    grading["students_data"] = [
                        sd
                        for sd in existing_sd
                        if (not isinstance(sd, dict))
                        or _normalize_source_filename(sd.get("filename")) != target_fn
                    ]
                save_grading_session(grading_id, grading)

    return jsonify(
        {
            "ok": True,
            "deleted_filename": target_fn,
            "remaining_sources": len(remaining_rows),
            "removed_check_rows": removed_check_rows,
            "removed_annotation_rows": removed_annotation_rows,
        }
    )


import os
import uuid
from typing import Any, Optional

from flask import jsonify, redirect, render_template, request, url_for

from ...db import (
    list_projects,
    load_batch_run_session,
    load_grading_session,
    load_project,
    load_project_source_set,
    save_project,
    list_project_comments,
    delete_project,
)
from . import bp
from .helpers import _decode_upload, _format_checker_run_output, _normalize_title


@bp.get("/projects")
def projects_page():
    rows = list_projects()
    # React frontend consumes this as JSON.
    return jsonify({"ok": True, "projects": rows})


@bp.post("/projects/<project_id>/delete")
def delete_project_route(project_id: str):
    ok = delete_project(project_id)
    if not ok:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404
    return jsonify({"ok": True})


@bp.post("/projects")
def create_project():
    project_name = _normalize_title(request.form.get("project_name", ""))
    if not project_name:
        return jsonify({"ok": False, "errors": ["Project name is required."]}), 400

    assignment_file = request.files.get("assignment")
    model_file = request.files.get("model_solution")
    if not assignment_file or not assignment_file.filename:
        return jsonify({"ok": False, "errors": ["Please upload the assignment Markdown file."]}), 400
    if not model_file or not model_file.filename:
        return jsonify({"ok": False, "errors": ["Please upload the model solution Python file."]}), 400

    try:
        assignment_md = _decode_upload(assignment_file)
        model_solution_py = _decode_upload(model_file)
    except Exception as e:
        return jsonify({"ok": False, "errors": [f"Failed reading uploaded files: {e}"]}), 400

    project_id = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "name": project_name,
        "assignment_name": assignment_file.filename,
        "assignment_md": assignment_md,
        "model_solution_name": model_file.filename,
        "model_solution_py": model_solution_py,
        "checker_script": "",
        "extra_instructions": "",
        "last_batch_id": "",
        "last_grading_session_id": "",
    }
    try:
        save_project(project_id, payload)
    except Exception as e:
        return jsonify({"ok": False, "errors": [f"Could not save project: {e}"]}), 500

    return jsonify(
        {
            "ok": True,
            "project_id": project_id,
            "redirect_url": url_for("projects.project_workspace", project_id=project_id),
        }
    )


@bp.get("/projects/<project_id>")
def project_workspace(project_id: str):
    project = load_project(project_id)
    if not project:
        # `/projects` is JSON now (for React), so redirect to the app root.
        return redirect(url_for("main.index"))

    student_set = load_project_source_set(project_id) or {"files": []}
    files = student_set.get("files")
    if not isinstance(files, list):
        files = []

    last_batch_id = (project.get("last_batch_id") or "").strip()
    last_grading_session_id = (project.get("last_grading_session_id") or "").strip()
    return render_template(
        "project_workspace.html",
        project_id=project_id,
        project_name=project.get("name") or "Untitled project",
        assignment_name=project.get("assignment_name") or "",
        model_solution_name=project.get("model_solution_name") or "",
        checker_script=project.get("checker_script") or "",
        students_count=len(files),
        last_batch_id=last_batch_id,
        last_batch_exists=bool(last_batch_id and load_batch_run_session(last_batch_id)),
        last_grading_session_id=last_grading_session_id,
        last_grading_exists=bool(
            last_grading_session_id and load_grading_session(last_grading_session_id)
        ),
    )


@bp.get("/projects/<project_id>/data")
def project_workspace_data(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    student_set = load_project_source_set(project_id) or {}
    file_rows = student_set.get("files")
    if not isinstance(file_rows, list):
        file_rows = []

    # Check results indexed by filename
    check_by_fn: dict[str, Any] = {}
    last_batch_id = (project.get("last_batch_id") or "").strip()
    if last_batch_id:
        batch = load_batch_run_session(last_batch_id) or {}
        for r in batch.get("results") or []:
            if isinstance(r, dict):
                fn = os.path.basename(str(r.get("filename") or ""))
                if fn:
                    r_out = dict(r)
                    r_out["output"] = r_out.get("output") or _format_checker_run_output(r_out)
                    check_by_fn[fn] = r_out

    # Annotation results indexed by filename
    ann_by_fn: dict[str, Any] = {}
    last_grading_id = (project.get("last_grading_session_id") or "").strip()
    if last_grading_id:
        grading = load_grading_session(last_grading_id) or {}
        gr = grading.get("results") or {}
        if isinstance(gr, dict):
            for _sid, item in gr.items():
                if isinstance(item, dict):
                    fn = os.path.basename(str(item.get("filename") or ""))
                    if fn:
                        ann_by_fn[fn] = item

    students: list[dict[str, Any]] = []
    for row in file_rows:
        if not isinstance(row, dict):
            continue

        filename = os.path.basename(str(row.get("filename") or "submission.py")) or "submission.py"
        chk = check_by_fn.get(filename)
        check_d: Optional[dict[str, Any]] = (
            {
                "exit_code": chk.get("exit_code"),
                "output": chk.get("output") or "",
                "check_cases": chk.get("check_cases"),
                "passed": chk.get("passed"),
                "total": chk.get("total"),
            }
            if chk
            else None
        )

        ann = ann_by_fn.get(filename)
        ann_d: Optional[dict[str, Any]] = (
            {
                "summary": ann.get("summary") or "",
                "annotations": ann.get("annotations") or [],
            }
            if ann
            else None
        )

        students.append(
            {
                "filename": filename,
                "code": str(row.get("code") or ""),
                "check": check_d,
                "annotation": ann_d,
            }
        )

    return jsonify(
        {
            "ok": True,
            "project": {
                "name": project.get("name") or "",
                "assignment_name": project.get("assignment_name") or "",
                "model_solution_name": project.get("model_solution_name") or "",
                "checker_script": project.get("checker_script") or "",
                "comment_library": list_project_comments(project_id),
            },
            "students": students,
        }
    )


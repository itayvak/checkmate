import json
import os
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime
from typing import Any, Optional

from flask import Blueprint, jsonify, redirect, render_template, request, url_for

from .db import (
    create_project_comment,
    delete_project_comment,
    list_project_comments,
    load_batch_run_session,
    load_grading_session,
    load_project,
    load_project_source_set,
    save_batch_run_session,
    save_grading_session,
    save_project,
    save_project_source_set,
    list_projects,
    update_project_comment,
    update_project_checker,
)
from .gemini_client import (
    DEFAULT_MODEL,
    SUPPORTED_MODELS,
    call_gemini,
    generate_auto_checker_prompt,
    normalize_checker_script_response,
    review_student_code,
)
from .utils import batch_output_for_matching_filename, parse_student_identity

bp = Blueprint("projects", __name__)

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
            row["passed"]     = parsed.get("passed")
            row["total"]      = parsed.get("total")
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


@bp.get("/projects")
def projects_page():
    rows = list_projects()
    return render_template("projects.html", projects=rows)


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
    return jsonify({"ok": True, "project_id": project_id, "redirect_url": url_for("projects.project_workspace", project_id=project_id)})


@bp.get("/projects/<project_id>")
def project_workspace(project_id: str):
    project = load_project(project_id)
    if not project:
        return redirect(url_for("projects.projects_page"))
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
        last_grading_exists=bool(last_grading_session_id and load_grading_session(last_grading_session_id)),
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
        for r in (batch.get("results") or []):
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
                "exit_code":  chk.get("exit_code"),
                "output":     chk.get("output") or "",
                "check_cases": chk.get("check_cases"),
                "passed":     chk.get("passed"),
                "total":      chk.get("total"),
            }
            if chk else None
        )
        ann = ann_by_fn.get(filename)
        ann_d: Optional[dict[str, Any]] = (
            {
                "grade": ann.get("grade") or "",
                "summary": ann.get("summary") or "",
                "annotations": ann.get("annotations") or [],
            }
            if ann else None
        )
        students.append({
            "filename": filename,
            "code": str(row.get("code") or ""),
            "check": check_d,
            "annotation": ann_d,
        })

    return jsonify({
        "ok": True,
        "project": {
            "name": project.get("name") or "",
            "assignment_name": project.get("assignment_name") or "",
            "model_solution_name": project.get("model_solution_name") or "",
            "checker_script": project.get("checker_script") or "",
            "comment_library": list_project_comments(project_id),
        },
        "students": students,
    })


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
                        sd for sd in existing_sd
                        if (not isinstance(sd, dict)) or _normalize_source_filename(sd.get("filename")) != target_fn
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


@bp.post("/projects/<project_id>/checker/generate")
def generate_checker(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "errors": ["Unknown project id."]}), 404
    api_key = (request.form.get("api_key") or "").strip()
    if not api_key:
        return jsonify({"ok": False, "errors": ["A Gemini API key is required."]}), 400

    selected_model = (request.form.get("model_name") or DEFAULT_MODEL).strip()
    if selected_model not in SUPPORTED_MODELS:
        return jsonify({"ok": False, "errors": ["Please choose a supported Gemini model."]}), 400

    extra_instructions = (request.form.get("extra_instructions") or "").strip()
    prompt = generate_auto_checker_prompt(
        assignment_md=project.get("assignment_md") or "",
        model_solution_py=project.get("model_solution_py") or "",
        extra_instructions=extra_instructions,
    )
    try:
        max_tokens = 32768 if ("pro" in selected_model or "preview" in selected_model) else 16384
        raw = call_gemini(
            api_key=api_key,
            prompt=prompt,
            model_name=selected_model,
            max_tokens=max_tokens,
            response_schema=None,
        )
        checker_script = normalize_checker_script_response(raw)
    except Exception as e:
        return jsonify({"ok": False, "errors": [f"Failed to generate checker script: {e}"]}), 500

    project["checker_script"] = checker_script
    project["extra_instructions"] = extra_instructions
    save_project(project_id, project)
    return jsonify({"ok": True, "checker_script": checker_script})


@bp.post("/projects/<project_id>/checker/run")
def run_checker_on_model(project_id: str):
    """Run the supplied checker script against the project's own model solution."""
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404
    checker_script = (request.form.get("checker_script") or "").strip()
    if not checker_script:
        return jsonify({"ok": False, "error": "No checker script provided."}), 400
    model_solution = (project.get("model_solution_py") or "").strip()
    if not model_solution:
        return jsonify({"ok": False, "error": "This project has no model solution stored."}), 400

    model_filename = (project.get("model_solution_name") or "model_solution.py")
    if not model_filename.endswith(".py"):
        model_filename += ".py"

    try:
        with tempfile.TemporaryDirectory(prefix="checkmate_checker_test_") as td:
            checker_path = os.path.join(td, "checker.py")
            model_path   = os.path.join(td, model_filename)
            with open(checker_path, "w", encoding="utf-8") as f:
                f.write(checker_script)
            with open(model_path, "w", encoding="utf-8") as f:
                f.write(model_solution)
            proc = subprocess.run(
                [sys.executable, checker_path, model_path],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=_PER_STUDENT_TIMEOUT_SEC,
                env=_checker_subprocess_env(),
            )
    except subprocess.TimeoutExpired:
        return jsonify({
            "ok": True,
            "exit_code": None,
            "output": f"Checker timed out after {_PER_STUDENT_TIMEOUT_SEC}s.",
            "check_cases": None,
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

    raw = {
        "filename": model_filename,
        "exit_code": proc.returncode,
        "stdout": proc.stdout or "",
        "stderr": proc.stderr or "",
        "error": None,
    }
    parsed = _try_parse_checkmate_result(raw["stdout"])
    result: dict[str, Any] = {
        "ok":        True,
        "exit_code": proc.returncode,
        "output":    _format_checker_run_output(raw),
    }
    if parsed:
        result["check_cases"] = parsed.get("checks") or []
        result["passed"]     = parsed.get("passed")
        result["total"]      = parsed.get("total")
    return jsonify(result)


@bp.post("/projects/<project_id>/checker/save")
def save_checker(project_id: str):
    if not load_project(project_id):
        return jsonify({"ok": False, "error": "Unknown project id."}), 404
    checker_script = (request.form.get("checker_script") or "").strip()
    if not checker_script and request.is_json:
        body = request.get_json(silent=True) or {}
        checker_script = (body.get("checker_script") or "").strip()
    if not checker_script:
        return jsonify({"ok": False, "error": "Missing checker_script."}), 400
    update_project_checker(project_id, checker_script)
    return jsonify({"ok": True})


@bp.post("/projects/<project_id>/files/update")
def update_project_files(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    assignment_file = request.files.get("assignment")
    model_file = request.files.get("model_solution")
    has_assignment = bool(assignment_file and assignment_file.filename)
    has_model = bool(model_file and model_file.filename)
    if not has_assignment and not has_model:
        return jsonify({"ok": False, "error": "Upload at least one file to update."}), 400

    if has_assignment:
        try:
            project["assignment_md"] = _decode_upload(assignment_file)
            project["assignment_name"] = assignment_file.filename
        except Exception as e:
            return jsonify({"ok": False, "error": f"Could not read assignment file: {e}"}), 400

    if has_model:
        try:
            project["model_solution_py"] = _decode_upload(model_file)
            project["model_solution_name"] = model_file.filename
        except Exception as e:
            return jsonify({"ok": False, "error": f"Could not read model solution file: {e}"}), 400

    save_project(project_id, project)
    return jsonify(
        {
            "ok": True,
            "assignment_name": project.get("assignment_name") or "",
            "model_solution_name": project.get("model_solution_name") or "",
        }
    )


@bp.post("/projects/<project_id>/rename")
def rename_project(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    project_name = _normalize_title(request.form.get("project_name", ""))
    if not project_name:
        return jsonify({"ok": False, "error": "Project name is required."}), 400

    project["name"] = project_name
    save_project(project_id, project)
    return jsonify({"ok": True, "project_name": project_name})


@bp.post("/projects/<project_id>/run/check")
def run_auto_check(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404
    checker_script = (request.form.get("checker_script") or "").strip() or (project.get("checker_script") or "").strip()
    if not checker_script:
        return jsonify({"ok": False, "error": "Missing checker script."}), 400

    student_set = load_project_source_set(project_id) or {}
    rows = student_set.get("files")
    if not isinstance(rows, list) or not rows:
        return jsonify({"ok": False, "error": "No source files uploaded for this project."}), 400

    only_fn = (request.form.get("only_filename") or "").strip()
    if only_fn:
        rows_to_run = [r for r in rows if isinstance(r, dict) and os.path.basename(str(r.get("filename") or "")) == only_fn]
        if not rows_to_run:
            return jsonify({"ok": False, "error": f"Student '{only_fn}' not found in uploaded set."}), 400
    else:
        rows_to_run = rows

    results: list[dict[str, Any]] = []
    for row in rows_to_run:
        if not isinstance(row, dict):
            continue
        filename = os.path.basename(str(row.get("filename") or "submission.py")) or "submission.py"
        content = str(row.get("code") or "")
        try:
            with tempfile.TemporaryDirectory(prefix="checkmate_test_batch_") as td:
                checker_path = os.path.join(td, "checker.py")
                student_path = os.path.join(td, filename)
                with open(checker_path, "w", encoding="utf-8") as cf:
                    cf.write(checker_script)
                with open(student_path, "w", encoding="utf-8") as sf:
                    sf.write(content)
                cmd = [sys.executable, checker_path, student_path]
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=_PER_STUDENT_TIMEOUT_SEC,
                    env=_checker_subprocess_env(),
                )
                results.append(
                    {
                        "filename": filename,
                        "exit_code": proc.returncode,
                        "stdout": proc.stdout or "",
                        "stderr": proc.stderr or "",
                    }
                )
        except subprocess.TimeoutExpired:
            results.append(
                {
                    "filename": filename,
                    "exit_code": None,
                    "stdout": "",
                    "stderr": "",
                    "error": f"Checker timed out after {_PER_STUDENT_TIMEOUT_SEC}s.",
                }
            )
        except Exception as e:
            results.append(
                {
                    "filename": filename,
                    "exit_code": None,
                    "stdout": "",
                    "stderr": "",
                    "error": str(e),
                }
            )
    existing_batch_id = (project.get("last_batch_id") or "").strip()
    if only_fn and existing_batch_id:
        # Merge this one student's result into the existing batch
        existing_batch = load_batch_run_session(existing_batch_id) or {}
        b_results = existing_batch.get("results")
        if not isinstance(b_results, list):
            b_results = []
        b_results = [r for r in b_results if isinstance(r, dict) and os.path.basename(str(r.get("filename") or "")) != only_fn]
        for r in results:
            r_norm = dict(r)
            p = _try_parse_checkmate_result(r_norm.get("stdout") or "")
            if p:
                r_norm["check_cases"] = p.get("checks") or []
                r_norm["passed"]     = p.get("passed")
                r_norm["total"]      = p.get("total")
            r_norm["output"] = r_norm.get("output") or _format_checker_run_output(r_norm)
            b_results.append(r_norm)
        existing_batch["results"] = b_results
        try:
            save_batch_run_session(existing_batch_id, existing_batch)
            batch_id = existing_batch_id
        except Exception as e:
            return jsonify({"ok": False, "error": f"Could not update batch session: {e}"}), 500
    else:
        try:
            batch_id = _persist_batch_run(
                project_id=project_id,
                project_name=project.get("name") or "Project",
                checker_script=checker_script,
                raw_results=results,
                assignment_name=project.get("assignment_name") or "",
            )
        except Exception as e:
            return jsonify({"ok": False, "error": f"Could not save batch session: {e}"}), 500
    project["checker_script"] = checker_script
    project["last_batch_id"] = batch_id
    save_project(project_id, project)

    # Build inline student response from fresh results
    check_by_fn: dict[str, Any] = {}
    for r in results:
        if isinstance(r, dict):
            fn = os.path.basename(str(r.get("filename") or ""))
            if fn:
                r_out = dict(r)
                p = _try_parse_checkmate_result(r_out.get("stdout") or "")
                if p:
                    r_out["check_cases"] = p.get("checks") or []
                    r_out["passed"]     = p.get("passed")
                    r_out["total"]      = p.get("total")
                r_out["output"] = r_out.get("output") or _format_checker_run_output(r_out)
                check_by_fn[fn] = r_out

    ann_by_fn: dict[str, Any] = {}
    gs_id = (project.get("last_grading_session_id") or "").strip()
    if gs_id:
        gs = load_grading_session(gs_id) or {}
        gr = gs.get("results") or {}
        if isinstance(gr, dict):
            for _sid, item in gr.items():
                if isinstance(item, dict):
                    fn = os.path.basename(str(item.get("filename") or ""))
                    if fn:
                        ann_by_fn[fn] = item

    students_out: list[dict[str, Any]] = []
    for row in rows_to_run:
        if not isinstance(row, dict):
            continue
        fn = os.path.basename(str(row.get("filename") or "submission.py")) or "submission.py"
        chk = check_by_fn.get(fn)
        check_d: Optional[dict[str, Any]] = (
            {
                "exit_code":  chk.get("exit_code"),
                "output":     chk.get("output") or "",
                "check_cases": chk.get("check_cases"),
                "passed":     chk.get("passed"),
                "total":      chk.get("total"),
            }
            if chk else None
        )
        ann = ann_by_fn.get(fn)
        ann_d: Optional[dict[str, Any]] = (
            {"grade": ann.get("grade") or "", "summary": ann.get("summary") or "", "annotations": ann.get("annotations") or []}
            if ann else None
        )
        students_out.append({"filename": fn, "code": str(row.get("code") or ""), "check": check_d, "annotation": ann_d})

    return jsonify({"ok": True, "students": students_out})


@bp.post("/projects/<project_id>/run/annotate")
def run_auto_annotate(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404
    api_key = (request.form.get("api_key") or "").strip()
    if not api_key:
        return jsonify({"ok": False, "error": "A Gemini API key is required."}), 400

    model_name = (request.form.get("model_name") or DEFAULT_MODEL).strip()
    if model_name not in SUPPORTED_MODELS:
        return jsonify({"ok": False, "error": "Please choose a supported Gemini model."}), 400

    student_set = load_project_source_set(project_id) or {}
    rows = student_set.get("files")
    if not isinstance(rows, list) or not rows:
        return jsonify({"ok": False, "error": "No source files uploaded for this project."}), 400

    only_fn = (request.form.get("only_filename") or "").strip()
    extra_instructions = (request.form.get("extra_instructions") or "").strip()
    if only_fn:
        rows_to_run = [r for r in rows if isinstance(r, dict) and os.path.basename(str(r.get("filename") or "")) == only_fn]
        if not rows_to_run:
            return jsonify({"ok": False, "error": f"Student '{only_fn}' not found in uploaded set."}), 400
    else:
        rows_to_run = rows

    session_id = str(uuid.uuid4())
    results: dict[str, Any] = {}
    students_data: list[dict[str, Any]] = []
    last_batch_id = (project.get("last_batch_id") or "").strip()
    batch_payload = load_batch_run_session(last_batch_id) if last_batch_id else None

    # Load per-project comment library
    comment_library = list_project_comments(project_id)
    lib_by_id: dict[str, dict[str, Any]] = {str(c.get("id")): c for c in comment_library if isinstance(c, dict) and c.get("id")}
    # Index by normalized message for quick reuse/dedupe
    lib_id_by_message: dict[str, str] = {}
    for c in comment_library:
        if not isinstance(c, dict):
            continue
        cid = str(c.get("id") or "").strip()
        msg = str(c.get("message") or "").strip()
        if cid and msg:
            lib_id_by_message[msg] = cid

    for row in rows_to_run:
        if not isinstance(row, dict):
            continue
        filename = os.path.basename(str(row.get("filename") or "submission.py"))
        student_code = str(row.get("code") or "")
        student_id, project_name = parse_student_identity(filename)
        auto_check_output = None
        if batch_payload:
            auto_check_output = batch_output_for_matching_filename(batch_payload, filename)
        try:
            review = review_student_code(
                api_key,
                student_code,
                project.get("model_solution_py") or "",
                project.get("assignment_md") or "",
                student_id,
                model_name=model_name,
                student_filename=filename,
                auto_check_output=auto_check_output,
                extra_instructions=extra_instructions,
                comment_library=comment_library,
            )
        except Exception as e:
            review = {"grade": "fail", "summary": f"Processing error: {e}", "annotations": []}

        # Resolve annotations to comment_id references only (creating new library entries if needed)
        resolved_annotations: list[dict[str, Any]] = []
        for ann in (review.get("annotations") or []):
            if not isinstance(ann, dict):
                continue
            line = ann.get("line")
            if not isinstance(line, int) or line <= 0:
                continue

            cid = ann.get("comment_id")
            if isinstance(cid, str) and cid.strip():
                cid = cid.strip()
                if cid in lib_by_id:
                    resolved_annotations.append({"line": line, "comment_id": cid})
                continue

            nc = ann.get("new_comment")
            if isinstance(nc, dict):
                msg = str(nc.get("message") or "").strip()
                if not msg:
                    continue
                # If an identical message already exists, reuse it
                existing_id = lib_id_by_message.get(msg)
                if existing_id:
                    resolved_annotations.append({"line": line, "comment_id": existing_id})
                    continue
                teacher_text = str(nc.get("teacher_text") or "").strip()
                try:
                    created = create_project_comment(project_id, message=msg, teacher_text=teacher_text, key=None)
                except Exception:
                    # If key uniqueness fails or insert fails, fallback to message-only dedupe on refresh
                    created = create_project_comment(project_id, message=msg, teacher_text=teacher_text, key=None)
                new_id = str(created.get("id") or "").strip()
                if new_id:
                    comment_library.append(created)
                    lib_by_id[new_id] = created
                    lib_id_by_message[msg] = new_id
                    resolved_annotations.append({"line": line, "comment_id": new_id})

        review["annotations"] = resolved_annotations

        item = {
            "filename": filename,
            "student_id": student_id,
            "project_name": project_name,
            "code": student_code,
            "code_lines": student_code.split("\n"),
            "grade": review["grade"],
            "summary": review["summary"],
            "annotations": review["annotations"],
        }
        if auto_check_output:
            item["auto_check_output"] = auto_check_output
        results[student_id] = item
        students_data.append(
            {
                "filename": filename,
                "student_id": student_id,
                "project_name": project_name,
                "code": student_code,
            }
        )

    payload: dict[str, Any] = {
        "results": results,
        "session_title": project.get("name") or "",
        "assignment_name": project.get("assignment_name") or "",
        "student_count": len(results),
        "assignment_md": project.get("assignment_md") or "",
        "model_solution": project.get("model_solution_py") or "",
        "students_data": students_data,
        "api_key": api_key,
        "model_name": model_name,
        "batch_run_id": last_batch_id,
        "project_id": project_id,
    }
    existing_session_id = (project.get("last_grading_session_id") or "").strip()
    if only_fn and existing_session_id:
        # Merge this one student's result into the existing grading session
        existing_gs = load_grading_session(existing_session_id) or {}
        existing_results = existing_gs.get("results") or {}
        if not isinstance(existing_results, dict):
            existing_results = {}
        for s_id, item in results.items():
            existing_results[s_id] = item
        existing_sd = existing_gs.get("students_data") or []
        if not isinstance(existing_sd, list):
            existing_sd = []
        existing_sd = [sd for sd in existing_sd if sd.get("filename") != only_fn]
        existing_sd.extend(students_data)
        existing_gs["results"] = existing_results
        existing_gs["students_data"] = existing_sd
        existing_gs["student_count"] = len(existing_results)
        try:
            save_grading_session(existing_session_id, existing_gs)
            final_session_id = existing_session_id
        except Exception as e:
            return jsonify({"ok": False, "error": f"Could not update grading session: {e}"}), 500
    else:
        try:
            save_grading_session(session_id, payload)
            final_session_id = session_id
        except Exception as e:
            return jsonify({"ok": False, "error": f"Could not save grading session: {e}"}), 500

    project["last_grading_session_id"] = final_session_id
    save_project(project_id, project)

    # Build inline student response from fresh annotation results
    check_by_fn_a: dict[str, Any] = {}
    if batch_payload:
        for r in (batch_payload.get("results") or []):
            if isinstance(r, dict):
                fn = os.path.basename(str(r.get("filename") or ""))
                if fn:
                    r_out = dict(r)
                    r_out["output"] = r_out.get("output") or _format_checker_run_output(r_out)
                    check_by_fn_a[fn] = r_out

    students_out_a: list[dict[str, Any]] = []
    for row in rows_to_run:
        if not isinstance(row, dict):
            continue
        fn_a = os.path.basename(str(row.get("filename") or "submission.py"))
        s_id_a, _ = parse_student_identity(fn_a)
        chk_a = check_by_fn_a.get(fn_a)
        check_d_a: Optional[dict[str, Any]] = (
            {
                "exit_code":  chk_a.get("exit_code"),
                "output":     chk_a.get("output") or "",
                "check_cases": chk_a.get("check_cases"),
                "passed":     chk_a.get("passed"),
                "total":      chk_a.get("total"),
            }
            if chk_a else None
        )
        item_a = results.get(s_id_a)
        ann_d_a: Optional[dict[str, Any]] = (
            {"grade": item_a.get("grade") or "", "summary": item_a.get("summary") or "", "annotations": item_a.get("annotations") or []}
            if item_a else None
        )
        students_out_a.append({"filename": fn_a, "code": str(row.get("code") or ""), "check": check_d_a, "annotation": ann_d_a})

    return jsonify({"ok": True, "students": students_out_a})

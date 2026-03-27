import os
import uuid
from typing import Any

from flask import Blueprint, jsonify, request

from .db import (
    load_batch_run_session,
    load_grading_session,
    list_batch_run_sessions,
    save_grading_session,
)
from .gemini_client import DEFAULT_MODEL, SUPPORTED_MODELS, review_student_code
from .utils import batch_output_for_matching_filename, parse_student_identity

bp = Blueprint("grading", __name__)


@bp.get("/grade/batch-runs")
def grade_batch_runs_list():
    """JSON list of saved auto-check batches for optional pairing with comment grading."""
    rows = list_batch_run_sessions()
    return jsonify(
        {
            "ok": True,
            "batches": [
                {
                    "id": r["id"],
                    "session_title": r.get("session_title") or "",
                    "assignment_name": r.get("assignment_name") or "",
                    "created_at": r.get("created_at") or "",
                    "submission_count": int(r.get("submission_count") or 0),
                }
                for r in rows
            ],
        }
    )


def _normalize_session_title(raw: Any) -> str:
    if not isinstance(raw, str):
        return ""
    t = raw.strip()
    if len(t) > 200:
        t = t[:200]
    return t


def _validate_grade_init_files() -> tuple[list[str], Any, Any]:
    errors: list[str] = []
    assignment_file = request.files.get("assignment")
    model_file = request.files.get("model_solution")
    if not assignment_file or not assignment_file.filename:
        errors.append("Please upload the assignment Markdown file.")
    if not model_file or not model_file.filename:
        errors.append("Please upload the model solution file.")
    return errors, assignment_file, model_file


@bp.post("/grade/init")
def grade_init():
    api_key = request.form.get("api_key", "").strip()
    selected_model = request.form.get("model_name", DEFAULT_MODEL).strip()
    session_title = _normalize_session_title(request.form.get("session_title", ""))

    errors = []
    if not api_key:
        errors.append("A Gemini API key is required.")
    if selected_model not in SUPPORTED_MODELS:
        errors.append("Please choose a supported Gemini model.")

    fe, assignment_file, model_file = _validate_grade_init_files()
    errors.extend(fe)
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    try:
        assignment_md = assignment_file.read().decode("utf-8")
        model_solution = model_file.read().decode("utf-8")
    except UnicodeDecodeError:
        return jsonify({"ok": False, "errors": ["Could not read assignment or model file as UTF-8."]}), 400
    except Exception as e:
        return jsonify({"ok": False, "errors": [str(e)]}), 500

    batch_run_id = (request.form.get("batch_run_id") or "").strip()
    if batch_run_id and not load_batch_run_session(batch_run_id):
        return jsonify(
            {"ok": False, "errors": ["Selected past auto-check batch was not found."]},
        ), 400

    session_id = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "results": {},
        "session_title": session_title,
        "assignment_name": assignment_file.filename,
        "student_count": 0,
        "assignment_md": assignment_md,
        "model_solution": model_solution,
        "students_data": [],
        "api_key": api_key,
        "model_name": selected_model,
        "batch_run_id": batch_run_id,
    }
    try:
        save_grading_session(session_id, payload)
    except Exception as e:
        return jsonify({"ok": False, "errors": [f"Could not save session: {e}"]}), 500

    return jsonify({"ok": True, "session_id": session_id})


@bp.post("/grade/<session_id>/student")
def grade_one_student(session_id: str):
    data = load_grading_session(session_id)
    if not data:
        return jsonify({"ok": False, "error": "Unknown or expired session id."}), 404

    sf = request.files.get("student_file")
    if not sf or not sf.filename:
        return jsonify({"ok": False, "error": "Missing student_file upload."}), 400

    filename = os.path.basename(sf.filename)
    student_id, test_name = parse_student_identity(filename)
    try:
        try:
            student_code = sf.read().decode("utf-8")
        except UnicodeDecodeError:
            sf.seek(0)
            student_code = sf.read().decode("latin-1")
    except Exception as e:
        return jsonify({"ok": False, "error": f"Could not read file: {e}"}), 400

    results = data.get("results")
    if not isinstance(results, dict):
        results = {}
        data["results"] = results

    api_key = (data.get("api_key") or "").strip()
    assignment_md = data.get("assignment_md") or ""
    model_solution = data.get("model_solution") or ""
    model_name = (data.get("model_name") or DEFAULT_MODEL).strip()
    if not api_key or not assignment_md or not model_solution:
        return jsonify({"ok": False, "error": "Session data is incomplete; start over from /grade/init."}), 400

    auto_check_output = None
    batch_run_id = (data.get("batch_run_id") or "").strip()
    if batch_run_id:
        batch_payload = load_batch_run_session(batch_run_id)
        if batch_payload:
            auto_check_output = batch_output_for_matching_filename(batch_payload, filename)

    try:
        review = review_student_code(
            api_key,
            student_code,
            model_solution,
            assignment_md,
            student_id,
            model_name=model_name,
            student_filename=filename,
            auto_check_output=auto_check_output,
        )
    except Exception as e:
        review = {"grade": "שגיאה", "summary": f"Processing error: {e}", "annotations": []}

    row = {
        "filename": filename,
        "student_id": student_id,
        "test_name": test_name,
        "code": student_code,
        "code_lines": student_code.split("\n"),
        "grade": review["grade"],
        "summary": review["summary"],
        "annotations": review["annotations"],
    }
    if auto_check_output:
        row["auto_check_output"] = auto_check_output
    results[student_id] = row

    students_data = data.get("students_data")
    if not isinstance(students_data, list):
        students_data = []
    students_data.append(
        {
            "filename": filename,
            "student_id": student_id,
            "test_name": test_name,
            "code": student_code,
        }
    )
    data["students_data"] = students_data
    data["student_count"] = len(results)

    try:
        save_grading_session(session_id, data)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Could not save progress: {e}"}), 500

    return jsonify(
        {
            "ok": True,
            "student_id": student_id,
            "filename": filename,
            "grade": review["grade"],
            "processed": len(results),
        }
    )

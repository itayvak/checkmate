import os
import subprocess
import sys
import tempfile
import uuid
from typing import Any

from flask import Blueprint, jsonify, redirect, render_template, request, url_for

from .db import (
    load_automatic_check_session,
    load_batch_run_session,
    list_batch_run_sessions,
    save_automatic_check_session,
    save_batch_run_session,
)
from .gemini_client import (
    DEFAULT_MODEL,
    SUPPORTED_MODELS,
    call_gemini,
    generate_auto_checker_prompt,
    normalize_checker_script_response,
)

bp = Blueprint("auto", __name__)

_MAX_BATCH_FILES = 80
_PER_STUDENT_TIMEOUT_SEC = 90


def _format_checker_run_output(r: dict[str, Any]) -> str:
    chunks: list[str] = []
    err = r.get("error")
    if err:
        chunks.append(f"ERROR: {err}")
    out = r.get("stdout") or ""
    if out:
        chunks.append("STDOUT:\n" + out)
    se = r.get("stderr") or ""
    if se:
        chunks.append("STDERR:\n" + se)
    return "\n\n".join(chunks).strip() or "(no output)"


def _normalize_batch_session_title(raw: Any) -> str:
    if not isinstance(raw, str):
        return ""
    t = raw.strip()
    if len(t) > 200:
        t = t[:200]
    return t


def _normalize_batch_result_rows(raw_results: list[Any]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in raw_results:
        if not isinstance(item, dict):
            continue
        fn = os.path.basename(str(item.get("filename") or "submission.py")) or "submission.py"
        if not fn.endswith(".py"):
            fn = f"{fn}.py"
        row = {
            "filename": fn,
            "exit_code": item.get("exit_code"),
            "stdout": item.get("stdout") if isinstance(item.get("stdout"), str) else "",
            "stderr": item.get("stderr") if isinstance(item.get("stderr"), str) else "",
            "error": item.get("error") if item.get("error") else None,
        }
        row["output"] = _format_checker_run_output(row)
        normalized.append(row)
    return normalized


def persist_batch_run(
    checker_script: str,
    raw_results: list[Any],
    source_auto_session_id: str = "",
    assignment_name: str = "",
    session_title: str = "",
) -> str:
    normalized = _normalize_batch_result_rows(raw_results)
    if not normalized:
        raise ValueError("No valid result entries.")
    batch_id = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "checker_script": checker_script.strip(),
        "results": normalized,
        "source_auto_session_id": (source_auto_session_id or "").strip(),
        "assignment_name": (assignment_name or "").strip(),
        "session_title": _normalize_batch_session_title(session_title),
    }
    save_batch_run_session(batch_id, payload)
    return batch_id


@bp.route("/auto", methods=["GET"])
def auto_check_page():
    return render_template("auto.html")


@bp.route("/auto/batches", methods=["GET"])
def batch_history_page():
    batches = list_batch_run_sessions()
    return render_template("auto_batches.html", batches=batches)


@bp.route("/auto/batch/<batch_id>", methods=["GET"])
def batch_detail_page(batch_id: str):
    data = load_batch_run_session(batch_id)
    if not data:
        return redirect(url_for("auto.batch_history_page"))
    results = data.get("results")
    if not isinstance(results, list):
        results = []
    display_results: list[dict[str, Any]] = []
    for r in results:
        if not isinstance(r, dict):
            continue
        row = dict(r)
        if not str(row.get("output") or "").strip():
            row["output"] = _format_checker_run_output(row)
        display_results.append(row)
    return render_template(
        "auto_batch_detail.html",
        batch_id=batch_id,
        session_title=data.get("session_title") or "",
        assignment_name=data.get("assignment_name") or "",
        checker_script=data.get("checker_script") or "",
        results=display_results,
        source_auto_session_id=data.get("source_auto_session_id") or "",
    )


@bp.route("/auto/run/<session_id>", methods=["GET"])
def auto_batch_page(session_id: str):
    data = load_automatic_check_session(session_id)
    if not data:
        return redirect(url_for("auto.auto_check_page"))
    return render_template(
        "auto_batch.html",
        session_id=session_id,
        assignment_name=data.get("assignment_name") or "",
        checker_script=data.get("checker_script") or "",
    )


@bp.post("/auto/generate")
def auto_generate():
    api_key = (request.form.get("api_key") or "").strip()
    if not api_key:
        return jsonify({"ok": False, "errors": ["A Gemini API key is required."]}), 400

    selected_model = (request.form.get("model_name") or DEFAULT_MODEL).strip()
    if selected_model not in SUPPORTED_MODELS:
        return jsonify({"ok": False, "errors": ["Please choose a supported Gemini model."]}), 400

    extra_instructions = (request.form.get("extra_instructions") or "").strip()

    assignment_file = request.files.get("assignment")
    model_file = request.files.get("model_solution")
    if not assignment_file or not assignment_file.filename:
        return jsonify({"ok": False, "errors": ["Please upload the assignment Markdown file."]}), 400
    if not model_file or not model_file.filename:
        return jsonify({"ok": False, "errors": ["Please upload the model solution Python file."]}), 400

    assignment_bytes = assignment_file.read()
    try:
        assignment_md = assignment_bytes.decode("utf-8")
    except UnicodeDecodeError:
        assignment_md = assignment_bytes.decode("latin-1")

    model_bytes = model_file.read()
    try:
        model_solution_py = model_bytes.decode("utf-8")
    except UnicodeDecodeError:
        model_solution_py = model_bytes.decode("latin-1")

    session_id = str(uuid.uuid4())

    prompt = generate_auto_checker_prompt(
        assignment_md=assignment_md,
        model_solution_py=model_solution_py,
        extra_instructions=extra_instructions,
    )

    try:
        max_tokens = 9000 if ("pro" in selected_model or "preview" in selected_model) else 6500
        raw = call_gemini(
            api_key=api_key,
            prompt=prompt,
            model_name=selected_model,
            max_tokens=max_tokens,
            response_schema=None,
        )
        checker_script = normalize_checker_script_response(raw)
    except Exception as e:
        err_msg = str(e)
        if "MAX_TOKENS" in err_msg or "missing 'parts'" in err_msg:
            hint = "Try selecting a stronger model (e.g. Gemini Pro) or upload shorter assignment/model files."
            err_msg = f"{err_msg}. {hint}"
        return jsonify({"ok": False, "errors": [f"Failed to generate checker script: {err_msg}"]}), 500

    if not isinstance(checker_script, str) or not checker_script.strip():
        return jsonify({"ok": False, "errors": ["AI returned an empty checker script."]}), 500

    payload: dict[str, Any] = {
        "assignment_name": assignment_file.filename,
        "assignment_md": assignment_md,
        "model_solution_name": model_file.filename,
        "model_solution_py": model_solution_py,
        "extra_instructions": extra_instructions,
        "checker_script": checker_script,
        "model_name": selected_model,
    }
    try:
        save_automatic_check_session(session_id, payload)
    except Exception as e:
        return jsonify({"ok": False, "errors": [f"Could not save checker session: {e}"]}), 500

    return jsonify({"ok": True, "session_id": session_id, "checker_script": checker_script})


@bp.post("/auto/manual")
def auto_manual():
    checker_script = (request.form.get("checker_script") or "").strip()
    if not checker_script:
        return jsonify({"ok": False, "errors": ["Please paste a checker script."]}), 400

    assignment_file = request.files.get("assignment")
    model_file = request.files.get("model_solution")
    if not assignment_file or not assignment_file.filename:
        return jsonify({"ok": False, "errors": ["Please upload the assignment Markdown file."]}), 400
    if not model_file or not model_file.filename:
        return jsonify({"ok": False, "errors": ["Please upload the model solution Python file."]}), 400

    assignment_bytes = assignment_file.read()
    try:
        assignment_md = assignment_bytes.decode("utf-8")
    except UnicodeDecodeError:
        assignment_md = assignment_bytes.decode("latin-1")

    model_bytes = model_file.read()
    try:
        model_solution_py = model_bytes.decode("utf-8")
    except UnicodeDecodeError:
        model_solution_py = model_bytes.decode("latin-1")

    session_id = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "assignment_name": assignment_file.filename,
        "assignment_md": assignment_md,
        "model_solution_name": model_file.filename,
        "model_solution_py": model_solution_py,
        "extra_instructions": (request.form.get("extra_instructions") or "").strip(),
        "checker_script": checker_script,
        "model_name": "manual",
    }
    try:
        save_automatic_check_session(session_id, payload)
    except Exception as e:
        return jsonify({"ok": False, "errors": [f"Could not save checker session: {e}"]}), 500

    return jsonify({"ok": True, "session_id": session_id, "checker_script": checker_script})


@bp.post("/auto/save/<session_id>")
def auto_save(session_id: str):
    data = load_automatic_check_session(session_id)
    if not data:
        return jsonify({"ok": False, "error": "Unknown automatic-check session id."}), 404

    checker_script = (request.form.get("checker_script") or "").strip()
    if not checker_script and request.is_json:
        checker_script = (request.json.get("checker_script") or "").strip()

    if not checker_script:
        return jsonify({"ok": False, "error": "Missing checker_script."}), 400

    data["checker_script"] = checker_script
    try:
        save_automatic_check_session(session_id, data)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Could not save checker script: {e}"}), 500

    return jsonify({"ok": True})


@bp.post("/auto/test/<session_id>")
def auto_test(session_id: str):
    data = load_automatic_check_session(session_id)
    if not data:
        return jsonify({"ok": False, "error": "Unknown automatic-check session id."}), 404

    checker_script = (request.form.get("checker_script") or "").strip()
    if not checker_script:
        checker_script = (data.get("checker_script") or "").strip()
    model_solution_py = data.get("model_solution_py") or ""

    if not isinstance(checker_script, str) or not checker_script.strip():
        return jsonify({"ok": False, "error": "Missing checker_script."}), 400
    if not isinstance(model_solution_py, str) or not model_solution_py.strip():
        return jsonify({"ok": False, "error": "Missing model_solution_py in session."}), 400

    try:
        with tempfile.TemporaryDirectory(prefix="checkmate_auto_test_") as td:
            checker_path = os.path.join(td, "checker.py")
            student_path = os.path.join(td, "student.py")

            with open(checker_path, "w", encoding="utf-8") as f:
                f.write(checker_script)
            with open(student_path, "w", encoding="utf-8") as f:
                f.write(model_solution_py)

            # Match generate_auto_checker_prompt: one positional path to the student's .py file.
            cmd = [sys.executable, checker_path, student_path]

            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15,
            )

            return jsonify(
                {
                    "ok": True,
                    "exit_code": proc.returncode,
                    "stdout": proc.stdout or "",
                    "stderr": proc.stderr or "",
                }
            )
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Checker test timed out."}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": f"Checker test failed: {e}"}), 500


@bp.post("/auto/run/<session_id>/execute")
def auto_batch_execute(session_id: str):
    data = load_automatic_check_session(session_id)
    if not data:
        return jsonify({"ok": False, "error": "Unknown automatic-check session id."}), 404

    checker_script = (request.form.get("checker_script") or "").strip()
    if not checker_script:
        checker_script = (data.get("checker_script") or "").strip()
    if not isinstance(checker_script, str) or not checker_script.strip():
        return jsonify({"ok": False, "error": "Missing checker script."}), 400

    data["checker_script"] = checker_script
    try:
        save_automatic_check_session(session_id, data)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Could not update session: {e}"}), 500

    uploads = request.files.getlist("student_files")
    files = [f for f in uploads if f and f.filename]
    if not files:
        return jsonify({"ok": False, "error": "Upload at least one student .py file."}), 400
    if len(files) > _MAX_BATCH_FILES:
        return jsonify(
            {"ok": False, "error": f"Too many files (max {_MAX_BATCH_FILES})."},
        ), 400

    results: list[dict[str, Any]] = []
    for f in files:
        filename = os.path.basename(f.filename) or "submission.py"
        if not filename.endswith(".py"):
            filename = f"{filename}.py"

        try:
            try:
                content = f.read().decode("utf-8")
            except UnicodeDecodeError:
                f.seek(0)
                content = f.read().decode("latin-1")
        except Exception as e:
            results.append(
                {
                    "filename": filename,
                    "exit_code": None,
                    "stdout": "",
                    "stderr": "",
                    "error": f"Could not read file: {e}",
                }
            )
            continue

        try:
            with tempfile.TemporaryDirectory(prefix="checkmate_auto_batch_") as td:
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
                    timeout=_PER_STUDENT_TIMEOUT_SEC,
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

    batch_title = _normalize_batch_session_title(request.form.get("session_title", ""))

    try:
        batch_id = persist_batch_run(
            checker_script,
            results,
            source_auto_session_id=session_id,
            assignment_name=data.get("assignment_name") or "",
            session_title=batch_title,
        )
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"ok": False, "error": f"Could not save batch session: {e}"}), 500

    return jsonify({"ok": True, "batch_id": batch_id})


@bp.post("/auto/batch/save")
def batch_session_save():
    """Persist a completed batch (optional API; runs also auto-save after execute)."""
    if not request.is_json:
        return jsonify({"ok": False, "error": "Expected JSON body."}), 400
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"ok": False, "error": "Invalid JSON."}), 400

    checker_script = (body.get("checker_script") or "").strip()
    raw_results = body.get("results")
    if not checker_script:
        return jsonify({"ok": False, "error": "Missing checker_script."}), 400
    if not isinstance(raw_results, list) or len(raw_results) == 0:
        return jsonify({"ok": False, "error": "Missing or empty results."}), 400

    try:
        batch_id = persist_batch_run(
            checker_script,
            raw_results,
            source_auto_session_id=(body.get("source_auto_session_id") or "").strip(),
            assignment_name=(body.get("assignment_name") or "").strip(),
            session_title=_normalize_batch_session_title(body.get("session_title", "")),
        )
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"ok": False, "error": f"Could not save batch session: {e}"}), 500

    return jsonify({"ok": True, "batch_id": batch_id})

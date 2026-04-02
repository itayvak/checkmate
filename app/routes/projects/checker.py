import os
import subprocess
import sys
import tempfile
from typing import Any

from flask import jsonify, request

from ...db import load_project, save_project, update_project_checker
from ...gemini_client import (
    DEFAULT_MODEL,
    SUPPORTED_MODELS,
    call_gemini,
    generate_auto_checker_prompt,
    normalize_checker_script_response,
)
from . import bp
from .helpers import (
    _PER_STUDENT_TIMEOUT_SEC,
    _checker_subprocess_env,
    _format_checker_run_output,
    _try_parse_checkmate_result,
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
            model_path = os.path.join(td, model_filename)
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
        return jsonify(
            {
                "ok": True,
                "exit_code": None,
                "output": f"Checker timed out after {_PER_STUDENT_TIMEOUT_SEC}s.",
                "check_cases": None,
            }
        )
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
        "ok": True,
        "exit_code": proc.returncode,
        "output": _format_checker_run_output(raw),
    }
    if parsed:
        result["check_cases"] = parsed.get("checks") or []
        result["passed"] = parsed.get("passed")
        result["total"] = parsed.get("total")
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


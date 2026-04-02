from flask import jsonify, request

from ...db import load_project, save_project
from . import bp
from .helpers import _decode_upload, _normalize_title


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


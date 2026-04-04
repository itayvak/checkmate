import os
import subprocess
import sys
import tempfile
import uuid
from typing import Any, Optional

from flask import jsonify, request

from ...db import (
    create_project_comment,
    load_batch_run_session,
    load_grading_session,
    load_project,
    load_project_source_set,
    list_project_comments,
    save_batch_run_session,
    save_grading_session,
    save_project,
)
from ...llm import get_llm_provider, review_student_code
from ...utils import batch_output_for_matching_filename, parse_student_identity
from . import bp
from .helpers import (
    _PER_STUDENT_TIMEOUT_SEC,
    _checker_subprocess_env,
    _format_checker_run_output,
    _persist_batch_run,
    _try_parse_checkmate_result,
)


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
                r_norm["passed"] = p.get("passed")
                r_norm["total"] = p.get("total")
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
                    r_out["passed"] = p.get("passed")
                    r_out["total"] = p.get("total")
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
                "exit_code": chk.get("exit_code"),
                "output": chk.get("output") or "",
                "check_cases": chk.get("check_cases"),
                "passed": chk.get("passed"),
                "total": chk.get("total"),
            }
            if chk
            else None
        )

        ann = ann_by_fn.get(fn)
        ann_d: Optional[dict[str, Any]] = (
            {
                "summary": ann.get("summary") or "",
                "annotations": ann.get("annotations") or [],
            }
            if ann
            else None
        )
        students_out.append({"filename": fn, "code": str(row.get("code") or ""), "check": check_d, "annotation": ann_d})

    return jsonify({"ok": True, "students": students_out})


@bp.post("/projects/<project_id>/run/annotate")
def run_auto_annotate(project_id: str):
    project = load_project(project_id)
    if not project:
        return jsonify({"ok": False, "error": "Unknown project id."}), 404

    provider = get_llm_provider()
    api_key = (request.form.get("api_key") or "").strip()
    if not api_key:
        return jsonify(
            {"ok": False, "error": f"An API key is required ({provider.label})."}
        ), 400

    model_name = (request.form.get("model_name") or provider.default_model).strip()
    if model_name not in provider.supported_models:
        return jsonify(
            {
                "ok": False,
                "error": f"Please choose a supported model ({provider.label}).",
            }
        ), 400

    student_set = load_project_source_set(project_id) or {}
    rows = student_set.get("files")
    if not isinstance(rows, list) or not rows:
        return jsonify({"ok": False, "error": "No source files uploaded for this project."}), 400

    only_fn = (request.form.get("only_filename") or "").strip()
    extra_instructions = (request.form.get("extra_instructions") or "").strip()
    if only_fn:
        rows_to_run = [
            r
            for r in rows
            if isinstance(r, dict) and os.path.basename(str(r.get("filename") or "")) == only_fn
        ]
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
    lib_by_id: dict[str, dict[str, Any]] = {
        str(c.get("id")): c for c in comment_library if isinstance(c, dict) and c.get("id")
    }
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
            review = {"summary": f"Processing error: {e}", "annotations": []}

        # Resolve annotations to comment_id references only (creating new library entries if needed)
        resolved_annotations: list[dict[str, Any]] = []
        for ann in review.get("annotations") or []:
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
                    pts = max(0, int(nc.get("points") or 0))
                except (TypeError, ValueError):
                    pts = 0
                try:
                    created = create_project_comment(project_id, message=msg, teacher_text=teacher_text, points=pts, key=None)
                except Exception:
                    created = create_project_comment(project_id, message=msg, teacher_text=teacher_text, points=pts, key=None)

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
                "exit_code": chk_a.get("exit_code"),
                "output": chk_a.get("output") or "",
                "check_cases": chk_a.get("check_cases"),
                "passed": chk_a.get("passed"),
                "total": chk_a.get("total"),
            }
            if chk_a
            else None
        )
        item_a = results.get(s_id_a)
        ann_d_a: Optional[dict[str, Any]] = (
            {
                "summary": item_a.get("summary") or "",
                "annotations": item_a.get("annotations") or [],
            }
            if item_a
            else None
        )
        students_out_a.append({"filename": fn_a, "code": str(row.get("code") or ""), "check": check_d_a, "annotation": ann_d_a})

    return jsonify({"ok": True, "students": students_out_a, "comment_library": comment_library})


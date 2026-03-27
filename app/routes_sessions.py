import json

from flask import Blueprint, jsonify, redirect, render_template, request, url_for

from .db import list_grading_sessions, load_grading_session
from .gemini_client import DEFAULT_MODEL, call_gemini

bp = Blueprint("sessions", __name__)


@bp.route("/results/<session_id>")
def results(session_id: str):
    data = load_grading_session(session_id)
    if not data:
        return redirect(url_for("main.index"))
    results_json = json.dumps(data["results"], ensure_ascii=False)

    raw_st = data.get("session_title")
    st = raw_st.strip() if isinstance(raw_st, str) else ""
    assignment_file = data.get("assignment_name") or ""
    display_title = st or assignment_file

    return render_template(
        "results.html",
        results=data["results"],
        session_id=session_id,
        assignment_name=display_title,
        student_count=data["student_count"],
        results_json=results_json,
    )


@bp.post("/results/<session_id>/ask")
def ask_about_student_code(session_id: str):
    data = load_grading_session(session_id)
    if not data:
        return jsonify({"ok": False, "error": "Unknown session id."}), 404
    if not request.is_json:
        return jsonify({"ok": False, "error": "Expected JSON request body."}), 400

    body = request.get_json(silent=True) or {}
    student_id = str(body.get("student_id") or "").strip()
    question = str(body.get("question") or "").strip()
    history_raw = body.get("history")
    if not student_id:
        return jsonify({"ok": False, "error": "Missing student_id."}), 400
    if not question:
        return jsonify({"ok": False, "error": "Missing question."}), 400

    results = data.get("results") or {}
    student_row = results.get(student_id)
    if not isinstance(student_row, dict):
        return jsonify({"ok": False, "error": "Student was not found in this session."}), 404

    api_key = (data.get("api_key") or "").strip()
    if not api_key:
        return jsonify({"ok": False, "error": "Session has no Gemini API key."}), 400

    assignment_md = data.get("assignment_md") or ""
    model_solution = data.get("model_solution") or ""
    student_code = student_row.get("code") or ""
    summary = student_row.get("summary") or ""
    annotations = student_row.get("annotations") or []
    annotations_json = json.dumps(annotations, ensure_ascii=False, indent=2)
    model_name = (data.get("model_name") or DEFAULT_MODEL).strip() or DEFAULT_MODEL
    history_items: list[dict[str, str]] = []
    if isinstance(history_raw, list):
        for item in history_raw:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role") or "").strip().lower()
            content = str(item.get("content") or "").strip()
            if role not in ("user", "assistant"):
                continue
            if not content:
                continue
            history_items.append({"role": role, "content": content})
            if len(history_items) >= 12:
                break
    history_block = ""
    if history_items:
        lines: list[str] = []
        for item in history_items:
            label = "Teacher" if item["role"] == "user" else "Assistant"
            lines.append(f"{label}: {item['content']}")
        history_block = "\nCONTEXT: PREVIOUS CHAT FOR THIS STUDENT ONLY\n" + "\n".join(lines) + "\n"

    prompt = f"""You are an assistant helping a teacher analyze student code and grading results.

Answer the teacher's question using ONLY the provided context. If something is uncertain, say so.
Be concise and practical.

TEACHER QUESTION:
{question}

CONTEXT: ASSIGNMENT DESCRIPTION
```md
{assignment_md}
```

CONTEXT: MODEL SOLUTION
```python
{model_solution}
```

CONTEXT: STUDENT CODE (student_id={student_id}, filename={student_row.get("filename") or ""})
```python
{student_code}
```

CONTEXT: GENERATED SUMMARY
{summary}

CONTEXT: GENERATED ANNOTATIONS (JSON)
```json
{annotations_json}
```
{history_block}
"""
    try:
        answer = call_gemini(
            api_key=api_key,
            prompt=prompt,
            model_name=model_name,
            max_tokens=1800,
            response_schema=None,
        )
    except Exception as e:
        return jsonify({"ok": False, "error": f"AI request failed: {e}"}), 500

    return jsonify({"ok": True, "answer": (answer or "").strip()})


@bp.route("/sessions")
def sessions_history():
    sessions_list = list_grading_sessions()
    return render_template("sessions.html", sessions=sessions_list)


@bp.route("/sessions/<session_id>/open")
def open_grading_session(session_id: str):
    if not load_grading_session(session_id):
        return redirect(url_for("sessions.sessions_history"))
    return redirect(url_for("sessions.results", session_id=session_id))

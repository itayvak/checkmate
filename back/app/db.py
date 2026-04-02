"""SQLite persistence for project and grading sessions."""

import json
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Optional

_pkg_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_pkg_dir)
_data_dir = os.environ.get("CHECKMATE_DATA_DIR", "").strip()
if _data_dir:
    os.makedirs(_data_dir, exist_ok=True)
    DB_PATH = os.path.join(_data_dir, "data.db")
else:
    DB_PATH = os.path.join(_project_root, "data.db")


def _db():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _db() as conn:
        conn.execute("DROP TABLE IF EXISTS automatic_check_sessions")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS grading_sessions (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS batch_run_sessions (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS project_source_sets (
                project_id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS project_comments (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                key TEXT,
                message TEXT NOT NULL,
                teacher_text TEXT NOT NULL DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(project_id, key)
            )
            """
        )
        # Best-effort schema upgrades for existing DBs (non-destructive).
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(project_comments)").fetchall()}
        if "teacher_text" not in cols:
            conn.execute("ALTER TABLE project_comments ADD COLUMN teacher_text TEXT NOT NULL DEFAULT ''")
        conn.commit()
        conn.commit()


def save_grading_session(session_id: str, payload: dict) -> None:
    blob = json.dumps(payload, ensure_ascii=False)
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO grading_sessions (id, data) VALUES (?, ?)",
            (session_id, blob),
        )
        conn.commit()


def load_grading_session(session_id: str) -> Optional[dict[str, Any]]:
    if not session_id:
        return None
    with _db() as conn:
        row = conn.execute(
            "SELECT data FROM grading_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
    if not row:
        return None
    return json.loads(row["data"])


def list_grading_sessions() -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute(
            """
            SELECT id, data, created_at
            FROM grading_sessions
            ORDER BY datetime(created_at) DESC
            """
        ).fetchall()
    summaries: list[dict[str, Any]] = []
    for row in rows:
        try:
            payload = json.loads(row["data"])
        except (json.JSONDecodeError, TypeError):
            payload = {}
        results = payload.get("results")
        if not isinstance(results, dict):
            results = {}
        passed = sum(1 for r in results.values() if isinstance(r, dict) and r.get("grade") == "pass")
        failed = len(results) - passed if results else 0
        raw_title = payload.get("session_title")
        session_title = raw_title.strip() if isinstance(raw_title, str) else ""
        summaries.append(
            {
                "id": row["id"],
                "created_at": row["created_at"] or "",
                "session_title": session_title,
                "assignment_name": payload.get("assignment_name") or "(no file)",
                "student_count": int(payload.get("student_count") or len(results) or 0),
                "model_name": payload.get("model_name") or "",
                "pass_count": passed,
                "fail_count": failed,
            }
        )
    return summaries


def save_batch_run_session(batch_id: str, payload: dict) -> None:
    blob = json.dumps(payload, ensure_ascii=False)
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO batch_run_sessions (id, data) VALUES (?, ?)",
            (batch_id, blob),
        )
        conn.commit()


def load_batch_run_session(batch_id: str) -> Optional[dict[str, Any]]:
    if not batch_id:
        return None
    with _db() as conn:
        row = conn.execute(
            "SELECT data FROM batch_run_sessions WHERE id = ?",
            (batch_id,),
        ).fetchone()
    if not row:
        return None
    return json.loads(row["data"])


def list_batch_run_sessions() -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute(
            """
            SELECT id, data, created_at
            FROM batch_run_sessions
            ORDER BY datetime(created_at) DESC
            """
        ).fetchall()
    summaries: list[dict[str, Any]] = []
    for row in rows:
        try:
            payload = json.loads(row["data"])
        except (json.JSONDecodeError, TypeError):
            payload = {}
        results = payload.get("results")
        if not isinstance(results, list):
            results = []
        passed = sum(
            1
            for r in results
            if isinstance(r, dict) and r.get("exit_code") == 0 and not r.get("error")
        )
        failed = len(results) - passed if results else 0
        raw_st = payload.get("session_title")
        session_title = raw_st.strip() if isinstance(raw_st, str) else ""
        summaries.append(
            {
                "id": row["id"],
                "created_at": row["created_at"] or "",
                "session_title": session_title,
                "assignment_name": payload.get("assignment_name") or "(no assignment name)",
                "submission_count": len(results),
                "pass_count": passed,
                "fail_count": failed,
            }
        )
    return summaries


def save_project(project_id: str, payload: dict) -> None:
    blob = json.dumps(payload, ensure_ascii=False)
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO projects (id, data) VALUES (?, ?)",
            (project_id, blob),
        )
        conn.commit()


def load_project(project_id: str) -> Optional[dict[str, Any]]:
    if not project_id:
        return None
    with _db() as conn:
        row = conn.execute(
            "SELECT data FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
    if not row:
        return None
    return json.loads(row["data"])


def list_projects() -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute(
            """
            SELECT id, data, created_at
            FROM projects
            ORDER BY datetime(created_at) DESC
            """
        ).fetchall()
    summaries: list[dict[str, Any]] = []
    for row in rows:
        try:
            payload = json.loads(row["data"])
        except (json.JSONDecodeError, TypeError):
            payload = {}
        project_name = str(payload.get("name") or "").strip() or "Untitled project"
        summaries.append(
            {
                "id": row["id"],
                "created_at": row["created_at"] or "",
                "name": project_name,
                "assignment_name": payload.get("assignment_name") or "(no file)",
                "model_solution_name": payload.get("model_solution_name") or "(no file)",
            }
        )
    return summaries


def delete_project(project_id: str) -> bool:
    if not project_id:
        return False

    with _db() as conn:
        row = conn.execute("SELECT data FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            return False

        # Best-effort: cascade delete related session rows referenced by this project.
        # (If ids are missing/invalid, we simply skip those deletes.)
        try:
            payload = json.loads(row["data"]) if row["data"] else {}
        except (json.JSONDecodeError, TypeError):
            payload = {}

        last_batch_id = (payload.get("last_batch_id") or "").strip()
        last_grading_session_id = (payload.get("last_grading_session_id") or "").strip()

        if last_batch_id:
            conn.execute("DELETE FROM batch_run_sessions WHERE id = ?", (last_batch_id,))
        if last_grading_session_id:
            conn.execute("DELETE FROM grading_sessions WHERE id = ?", (last_grading_session_id,))

        conn.execute("DELETE FROM project_comments WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM project_source_sets WHERE project_id = ?", (project_id,))

        cur = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return (cur.rowcount or 0) > 0


def update_project_checker(project_id: str, checker_script: str) -> None:
    payload = load_project(project_id) or {}
    payload["checker_script"] = checker_script
    save_project(project_id, payload)


def save_project_source_set(project_id: str, payload: dict) -> None:
    blob = json.dumps(payload, ensure_ascii=False)
    with _db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO project_source_sets (project_id, data, updated_at)
            VALUES (?, ?, datetime('now'))
            """,
            (project_id, blob),
        )
        conn.commit()


def load_project_source_set(project_id: str) -> Optional[dict[str, Any]]:
    if not project_id:
        return None
    with _db() as conn:
        row = conn.execute(
            "SELECT data FROM project_source_sets WHERE project_id = ?",
            (project_id,),
        ).fetchone()
    if not row:
        return None
    return json.loads(row["data"])


def list_project_comments(project_id: str) -> list[dict[str, Any]]:
    if not project_id:
        return []
    with _db() as conn:
        rows = conn.execute(
            """
            SELECT id, project_id, key, message, teacher_text, created_at, updated_at
            FROM project_comments
            WHERE project_id = ?
            ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
            """,
            (project_id,),
        ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": r["id"],
                "project_id": r["project_id"],
                "key": r["key"],
                "message": r["message"] or "",
                "teacher_text": r["teacher_text"] or "",
                "created_at": r["created_at"] or "",
                "updated_at": r["updated_at"] or "",
            }
        )
    return out


def get_project_comment(comment_id: str) -> Optional[dict[str, Any]]:
    if not comment_id:
        return None
    with _db() as conn:
        row = conn.execute(
            """
            SELECT id, project_id, key, message, teacher_text, created_at, updated_at
            FROM project_comments
            WHERE id = ?
            """,
            (comment_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "key": row["key"],
        "message": row["message"] or "",
        "teacher_text": row["teacher_text"] or "",
        "created_at": row["created_at"] or "",
        "updated_at": row["updated_at"] or "",
    }


def create_project_comment(
    project_id: str,
    *,
    message: str,
    teacher_text: str = "",
    key: str | None = None,
) -> dict[str, Any]:
    if not project_id:
        raise ValueError("project_id is required")
    msg = (message or "").strip()
    if not msg:
        raise ValueError("message is required")
    comment_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with _db() as conn:
        conn.execute(
            """
            INSERT INTO project_comments (id, project_id, key, message, teacher_text, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                comment_id,
                project_id,
                (key or None),
                msg,
                (teacher_text or "").strip(),
                now,
                now,
            ),
        )
        conn.commit()
    return get_project_comment(comment_id) or {"id": comment_id, "project_id": project_id, "message": msg, "teacher_text": teacher_text}


def update_project_comment(
    comment_id: str,
    *,
    message: str | None = None,
    teacher_text: str | None = None,
    key: str | None = None,
) -> Optional[dict[str, Any]]:
    if not comment_id:
        return None

    fields: list[str] = []
    params: list[Any] = []

    if message is not None:
        msg = message.strip()
        if not msg:
            raise ValueError("message cannot be empty")
        fields.append("message = ?")
        params.append(msg)
    if teacher_text is not None:
        fields.append("teacher_text = ?")
        params.append(teacher_text.strip())
    if key is not None:
        k = key.strip()
        fields.append("key = ?")
        params.append(k or None)

    if not fields:
        return get_project_comment(comment_id)

    fields.append("updated_at = ?")
    params.append(datetime.utcnow().isoformat())

    params.append(comment_id)
    with _db() as conn:
        conn.execute(
            f"""
            UPDATE project_comments
            SET {", ".join(fields)}
            WHERE id = ?
            """,
            params,
        )
        conn.commit()
    return get_project_comment(comment_id)


def delete_project_comment(comment_id: str) -> bool:
    if not comment_id:
        return False
    with _db() as conn:
        cur = conn.execute("DELETE FROM project_comments WHERE id = ?", (comment_id,))
        conn.commit()
        return (cur.rowcount or 0) > 0


init_db()

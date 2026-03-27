"""SQLite persistence for grading and automatic-check sessions."""

import json
import os
import sqlite3
from typing import Any, Optional

_pkg_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_pkg_dir)
_data_dir = os.environ.get("CHECKMATE_DATA_DIR", "").strip()
if _data_dir:
    os.makedirs(_data_dir, exist_ok=True)
    DB_PATH = os.path.join(_data_dir, "grading_sessions.db")
else:
    DB_PATH = os.path.join(_project_root, "grading_sessions.db")


def _db():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _db() as conn:
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
            CREATE TABLE IF NOT EXISTS automatic_check_sessions (
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


def save_automatic_check_session(session_id: str, payload: dict) -> None:
    blob = json.dumps(payload, ensure_ascii=False)
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO automatic_check_sessions (id, data) VALUES (?, ?)",
            (session_id, blob),
        )
        conn.commit()


def load_automatic_check_session(session_id: str) -> Optional[dict[str, Any]]:
    if not session_id:
        return None
    with _db() as conn:
        row = conn.execute(
            "SELECT data FROM automatic_check_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
    if not row:
        return None
    return json.loads(row["data"])


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


init_db()

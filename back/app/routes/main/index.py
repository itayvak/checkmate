import os

from flask import jsonify, redirect, url_for

from . import bp


@bp.route("/")
def index():
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000/").strip()
    # Route the user to the React frontend. During local dev the Vite dev
    # server is typically on :3000.
    return redirect(frontend_url)


@bp.route("/healthz")
def healthz():
    return jsonify({"ok": True}), 200


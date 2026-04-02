import os

from flask import jsonify, redirect, url_for

from . import bp


@bp.route("/")
def index():
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173/").strip()
    # Route the user to the React frontend. During local dev the React dev
    # server is typically on :5173.
    return redirect(frontend_url)


@bp.route("/healthz")
def healthz():
    return jsonify({"ok": True}), 200


from flask import Blueprint, jsonify, redirect, url_for

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    return redirect(url_for("projects.projects_page"))


@bp.route("/healthz")
def healthz():
    return jsonify({"ok": True}), 200

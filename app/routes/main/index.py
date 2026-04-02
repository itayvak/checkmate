from flask import jsonify, redirect, url_for

from . import bp


@bp.route("/")
def index():
    return redirect(url_for("projects.projects_page"))


@bp.route("/healthz")
def healthz():
    return jsonify({"ok": True}), 200


from flask import Blueprint, jsonify, render_template

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    return render_template("projects.html")


@bp.route("/grade")
def grade_page():
    return render_template("grade.html")


@bp.route("/healthz")
def healthz():
    return jsonify({"ok": True}), 200

from flask import Blueprint, render_template

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    return render_template("menu.html")


@bp.route("/grade")
def grade_page():
    return render_template("grade.html")

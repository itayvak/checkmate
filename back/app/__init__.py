import os

from flask import Flask


def create_app() -> Flask:
    pkg_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(pkg_dir)

    flask_app = Flask(__name__)

    from . import db  # noqa: F401 — runs init_db on import

    from .routes.main import bp as main_bp
    from .routes.projects import bp as projects_bp

    flask_app.register_blueprint(main_bp)
    flask_app.register_blueprint(projects_bp, url_prefix="/api")

    return flask_app


app = create_app()

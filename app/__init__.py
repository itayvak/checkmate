import os

from flask import Flask


def create_app() -> Flask:
    pkg_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(pkg_dir)

    flask_app = Flask(
        __name__,
        template_folder=os.path.join(project_root, "templates"),
    )

    from . import db  # noqa: F401 — runs init_db on import

    from .routes_main import bp as main_bp
    from .routes_projects import bp as projects_bp

    flask_app.register_blueprint(main_bp)
    flask_app.register_blueprint(projects_bp)

    return flask_app


app = create_app()

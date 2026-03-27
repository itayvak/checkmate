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

    from .routes_auto import bp as auto_bp
    from .routes_grade import bp as grading_bp
    from .routes_main import bp as main_bp
    from .routes_sessions import bp as sessions_bp

    flask_app.register_blueprint(main_bp)
    flask_app.register_blueprint(auto_bp)
    flask_app.register_blueprint(grading_bp)
    flask_app.register_blueprint(sessions_bp)

    return flask_app


app = create_app()

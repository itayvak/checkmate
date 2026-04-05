import os

from flask import jsonify, redirect, request

from . import bp


def _frontend_redirect_url() -> str:
    override = os.environ.get("FRONTEND_URL", "").strip()
    if override:
        return override
    netloc = request.host
    if netloc.startswith("["):
        end = netloc.rfind("]")
        host_for_url = netloc[: end + 1]
    else:
        host_for_url = netloc.rsplit(":", 1)[0] if ":" in netloc else netloc
    return f"{request.scheme}://{host_for_url}:3000/"


@bp.route("/")
def index():
    return redirect(_frontend_redirect_url())


@bp.route("/healthz")
def healthz():
    return jsonify({"ok": True}), 200

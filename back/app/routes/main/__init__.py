from flask import Blueprint

bp = Blueprint("main", __name__)

# Import modules so their @bp.* decorators register at import time.
from . import index as _index  # noqa: F401


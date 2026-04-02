from flask import Blueprint

bp = Blueprint("projects", __name__)

# Import modules so their @bp.* decorators register at import time.
# The underscores prevent unused import lint warnings.
from . import index as _index  # noqa: F401
from . import comments as _comments  # noqa: F401
from . import annotations as _annotations  # noqa: F401
from . import sources as _sources  # noqa: F401
from . import checker as _checker  # noqa: F401
from . import runs as _runs  # noqa: F401
from . import settings as _settings  # noqa: F401


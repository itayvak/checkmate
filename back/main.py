import os

from app import app


if __name__ == "__main__":
    host = os.environ.get("FLASK_HOST", "0.0.0.0")
    app.run(host=host, port=5000)

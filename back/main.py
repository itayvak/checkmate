"""Local dev entry (backwards compatible): python run.py"""

from app import app


if __name__ == "__main__":
    app.run(port=5000, debug=True)

# Check Mate — Flask grading UI (Gemini)
# Build:  docker build -t checkmate .
# Run:    docker run --rm -p 5000:5000 -v checkmate-data:/data -e CHECKMATE_DATA_DIR=/data checkmate

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY app/ app/
COPY templates/ templates/

EXPOSE 5000

# Grading calls Gemini and can take several minutes per batch.
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "2", \
     "--timeout", "600", \
     "--graceful-timeout", "30", \
     "app:app"]

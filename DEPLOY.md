# Check Mate Docker Deployment

This project is deployed as a single Docker container running Flask behind Gunicorn.

## Fresh machine one-liner

If the repository is not cloned yet, run:

```bash
git clone https://github.com/itayvak/checkmate.git checkmate && cd checkmate && chmod +x deploy.sh && ./deploy.sh
```

Example with explicit options:

```bash
git clone https://github.com/itayvak/checkmate.git checkmate && cd checkmate && chmod +x deploy.sh && ./deploy.sh --image_name checkmate --port 5000 --data_dir /opt/checkmate-data
```

## 1) Build the image

```bash
docker build -t checkmate .
```

## 2) Run with persistent data

The app stores its SQLite DB at:

- `/data/grading_sessions.db` when `CHECKMATE_DATA_DIR=/data` is set
- `/srv/grading_sessions.db` if `CHECKMATE_DATA_DIR` is not set

Use a volume so data survives container recreation:

```bash
docker run --name checkmate \
  -p 5000:5000 \
  -v checkmate-data:/data \
  -e CHECKMATE_DATA_DIR=/data \
  --restart unless-stopped \
  checkmate
```

## 3) Verify health

The container healthcheck calls:

- `GET /healthz` (expects HTTP 200 and JSON `{"ok": true}`)

Manual checks:

```bash
curl http://localhost:5000/healthz
curl http://localhost:5000/
```

## 4) Update deployment

```bash
docker build -t checkmate .
docker stop checkmate
docker rm checkmate
docker run --name checkmate \
  -p 5000:5000 \
  -v checkmate-data:/data \
  -e CHECKMATE_DATA_DIR=/data \
  --restart unless-stopped \
  checkmate
```

## Operational notes

- Gunicorn defaults to `1` worker in this setup to avoid SQLite multi-process locking issues.
- The app serves on fixed port `5000` inside the container.
- `templates/` and `app/static/` are bundled in the image.
- Gemini API keys are supplied by users in the app UI during grading flows.

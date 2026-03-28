#!/usr/bin/env bash

set -euo pipefail

# User-facing optional flags:
#   --image_name  Docker image name/tag
#   --port        Host port published to container port 5000
#   --data_dir    Host directory to store persistent app data
IMAGE_NAME="checkmate"
HOST_PORT="5000"
HOST_DATA_DIR="./checkmate-data"

# Internal fixed runtime settings
CONTAINER_NAME="checkmate"
CONTAINER_PORT="5000"
CONTAINER_DATA_DIR="/data"
RESTART_POLICY="unless-stopped"
DOCKERFILE_PATH="Dockerfile"
BUILD_CONTEXT="."
HEALTH_PATH="/healthz"
HEALTH_TIMEOUT="90"
HEALTH_INTERVAL="3"

SCRIPT_NAME="$(basename "$0")"

if [[ -t 1 ]]; then
  C_RED="\033[31m"
  C_GREEN="\033[32m"
  C_YELLOW="\033[33m"
  C_BLUE="\033[34m"
  C_RESET="\033[0m"
else
  C_RED=""
  C_GREEN=""
  C_YELLOW=""
  C_BLUE=""
  C_RESET=""
fi

log() { printf "%b[%s]%b %s\n" "$C_BLUE" "INFO" "$C_RESET" "$*"; }
warn() { printf "%b[%s]%b %s\n" "$C_YELLOW" "WARN" "$C_RESET" "$*"; }
ok() { printf "%b[%s]%b %s\n" "$C_GREEN" "OK" "$C_RESET" "$*"; }
die() {
  printf "%b[%s]%b %s\n" "$C_RED" "ERROR" "$C_RESET" "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  local line_no="${1:-unknown}"
  printf "%b[%s]%b Deployment failed at line %s (exit code: %s)\n" \
    "$C_RED" "ERROR" "$C_RESET" "$line_no" "$exit_code" >&2
  exit "$exit_code"
}
trap 'on_error $LINENO' ERR

usage() {
  cat <<EOF
Usage: ./$SCRIPT_NAME [options]

Options (all optional):
  --image_name NAME   Docker image name/tag (default: $IMAGE_NAME)
  --port PORT         Host port to publish (default: $HOST_PORT)
  --data_dir PATH     Host data directory bind-mounted to container /data (default: $HOST_DATA_DIR)
  -h, --help          Show this help and exit
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image_name)
      [[ $# -ge 2 ]] || die "Missing value for --image_name"
      IMAGE_NAME="$2"
      shift 2
      ;;
    --port)
      [[ $# -ge 2 ]] || die "Missing value for --port"
      HOST_PORT="$2"
      shift 2
      ;;
    --data_dir)
      [[ $# -ge 2 ]] || die "Missing value for --data_dir"
      HOST_DATA_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1. Use --help for usage."
      ;;
  esac
done

is_positive_int() {
  [[ "$1" =~ ^[0-9]+$ ]] && [[ "$1" -gt 0 ]]
}

to_absolute_path() {
  local p="$1"
  if [[ "$p" = /* ]]; then
    printf "%s" "$p"
  else
    printf "%s/%s" "$(pwd)" "$p"
  fi
}

validate_inputs() {
  [[ -n "$IMAGE_NAME" ]] || die "image name cannot be empty."
  [[ -n "$HOST_DATA_DIR" ]] || die "data_dir cannot be empty."
  is_positive_int "$HOST_PORT" || die "port must be a positive integer."

  if (( HOST_PORT < 1 || HOST_PORT > 65535 )); then
    die "port must be between 1 and 65535."
  fi
}

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "Required command not found: $cmd"
}

check_linux() {
  local os_name
  os_name="$(uname -s)"
  [[ "$os_name" == "Linux" ]] || die "This script must run on Linux (detected: $os_name)."
}

check_docker_daemon() {
  docker info >/dev/null 2>&1 || die "Docker daemon is not accessible. Start Docker and ensure your user can run docker commands."
}

check_project_files() {
  [[ -f "$DOCKERFILE_PATH" ]] || die "Missing required file: $DOCKERFILE_PATH"
  [[ -f "requirements.txt" ]] || die "Missing required file: requirements.txt"
  [[ -d "app" ]] || die "Missing required directory: app/"
  [[ -d "templates" ]] || die "Missing required directory: templates/"
}

container_exists() {
  docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"
}

port_is_listening() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -ltnH "sport = :$port" 2>/dev/null | grep -q .
    return $?
  fi

  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$port\$"
    return $?
  fi

  warn "Neither ss nor netstat is installed. Skipping host port conflict check."
  return 1
}

check_host_port() {
  if container_exists; then
    log "Container '$CONTAINER_NAME' already exists; it will be replaced."
    return 0
  fi

  if port_is_listening "$HOST_PORT"; then
    die "Host port $HOST_PORT appears to be in use. Pick another port with --port."
  fi
}

prepare_host_data_dir() {
  HOST_DATA_DIR="$(to_absolute_path "$HOST_DATA_DIR")"

  if [[ ! -d "$HOST_DATA_DIR" ]]; then
    log "Creating data directory: $HOST_DATA_DIR"
    mkdir -p "$HOST_DATA_DIR"
  fi

  [[ -w "$HOST_DATA_DIR" ]] || die "Data directory is not writable: $HOST_DATA_DIR"
}

build_image() {
  log "Building Docker image '$IMAGE_NAME' ..."
  docker build -t "$IMAGE_NAME" -f "$DOCKERFILE_PATH" "$BUILD_CONTEXT"
  ok "Image build completed."
}

replace_container_if_exists() {
  if container_exists; then
    log "Stopping existing container '$CONTAINER_NAME' ..."
    docker stop "$CONTAINER_NAME" >/dev/null
    log "Removing existing container '$CONTAINER_NAME' ..."
    docker rm "$CONTAINER_NAME" >/dev/null
    ok "Existing container replaced."
  fi
}

run_container() {
  log "Starting container '$CONTAINER_NAME' ..."
  local container_id
  container_id="$(docker run -d \
    --name "$CONTAINER_NAME" \
    -p "${HOST_PORT}:${CONTAINER_PORT}" \
    -v "${HOST_DATA_DIR}:${CONTAINER_DATA_DIR}" \
    -e "CHECKMATE_DATA_DIR=${CONTAINER_DATA_DIR}" \
    --restart "$RESTART_POLICY" \
    "$IMAGE_NAME")"

  ok "Container started."
  log "Container ID: $container_id"
}

wait_for_health() {
  local health_url="http://127.0.0.1:${HOST_PORT}${HEALTH_PATH}"
  local elapsed=0

  if ! command -v curl >/dev/null 2>&1; then
    warn "curl not found; skipping HTTP health probe. Manual check: $health_url"
    return 0
  fi

  log "Checking health at $health_url (timeout: ${HEALTH_TIMEOUT}s) ..."

  while (( elapsed < HEALTH_TIMEOUT )); do
    if curl --silent --show-error --fail --max-time 5 "$health_url" >/dev/null; then
      ok "Health check succeeded."
      return 0
    fi

    sleep "$HEALTH_INTERVAL"
    elapsed=$((elapsed + HEALTH_INTERVAL))
  done

  warn "Health check timed out after ${HEALTH_TIMEOUT}s."
  return 1
}

print_failure_diagnostics() {
  warn "Showing diagnostics for '$CONTAINER_NAME' ..."
  docker ps -a --filter "name=^/${CONTAINER_NAME}$" || true
  docker logs --tail 120 "$CONTAINER_NAME" || true
}

main() {
  validate_inputs
  check_linux
  require_command bash
  require_command docker
  check_docker_daemon
  check_project_files
  check_host_port
  prepare_host_data_dir

  build_image
  replace_container_if_exists
  run_container

  if ! wait_for_health; then
    print_failure_diagnostics
    exit 1
  fi

  ok "Deployment complete."
  printf "\n"
  printf "Application URL: http://127.0.0.1:%s/\n" "$HOST_PORT"
  printf "Data directory:  %s\n" "$HOST_DATA_DIR"
  printf "View logs using: docker logs -f %s\n" "$CONTAINER_NAME"
}

if ! main "$@"; then
  print_failure_diagnostics
  exit 1
fi

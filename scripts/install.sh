#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Transkryptor"
REPO_URL="${TRANSKRYPTOR_REPO_URL:-https://github.com/Lesur-ai/transkryptor.git}"
REF="${TRANSKRYPTOR_REF:-v6.1.1}"
PORT="${TRANSKRYPTOR_PORT:-3000}"
APP_URL="http://localhost:${PORT}"
OPEN_BROWSER="${TRANSKRYPTOR_OPEN_BROWSER:-1}"

log() {
  printf '[transkryptor] %s\n' "$1"
}

fail() {
  printf '[transkryptor] ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

detect_platform() {
  case "$(uname -s)" in
    Darwin) printf '%s\n' "macos" ;;
    Linux) printf '%s\n' "linux" ;;
    *) fail "Unsupported platform. Use macOS, Linux, or WSL on Windows." ;;
  esac
}

default_install_dir() {
  case "$1" in
    macos) printf '%s\n' "${HOME}/Applications/${APP_NAME}" ;;
    linux) printf '%s\n' "${XDG_DATA_HOME:-${HOME}/.local/share}/transkryptor" ;;
  esac
}

default_state_dir() {
  case "$1" in
    macos) printf '%s\n' "${HOME}/Library/Application Support/${APP_NAME}" ;;
    linux) printf '%s\n' "${XDG_STATE_HOME:-${HOME}/.local/state}/transkryptor" ;;
  esac
}

default_log_dir() {
  case "$1" in
    macos) printf '%s\n' "${HOME}/Library/Logs/${APP_NAME}" ;;
    linux) printf '%s\n' "${XDG_STATE_HOME:-${HOME}/.local/state}/transkryptor/logs" ;;
  esac
}

check_node_version() {
  local major
  major="$(node -p "Number(process.versions.node.split('.')[0])")"
  if [ "$major" -lt 18 ]; then
    fail "Node.js 18 or newer is required. Current version: $(node --version)"
  fi
}

clone_or_update() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    log "Updating existing checkout in ${INSTALL_DIR}"
    git -C "$INSTALL_DIR" fetch --tags origin
    git -C "$INSTALL_DIR" checkout --force "$REF"
    if [ "$(git -C "$INSTALL_DIR" rev-parse --abbrev-ref HEAD)" != "HEAD" ]; then
      git -C "$INSTALL_DIR" pull --ff-only origin "$REF" || true
    fi
    return
  fi

  if [ -e "$INSTALL_DIR" ]; then
    fail "${INSTALL_DIR} already exists and is not a git checkout."
  fi

  mkdir -p "$(dirname "$INSTALL_DIR")"
  log "Installing ${APP_NAME} into ${INSTALL_DIR}"
  if ! git clone --depth 1 --branch "$REF" "$REPO_URL" "$INSTALL_DIR"; then
    log "Shallow clone for ${REF} failed, retrying with full history"
    git clone "$REPO_URL" "$INSTALL_DIR"
    git -C "$INSTALL_DIR" checkout "$REF"
  fi
}

setup_env() {
  if [ -f "$INSTALL_DIR/.env" ]; then
    log "Keeping existing .env"
    return
  fi

  [ -f "$INSTALL_DIR/.env.example" ] || fail ".env.example not found in ${INSTALL_DIR}"
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  log "Created .env from .env.example"
}

install_dependencies() {
  log "Installing npm dependencies"
  if [ -f "$INSTALL_DIR/package-lock.json" ]; then
    npm --prefix "$INSTALL_DIR" ci
  else
    npm --prefix "$INSTALL_DIR" install
  fi
}

is_app_ready() {
  curl -fsS "${APP_URL}/api/version" >/dev/null 2>&1
}

start_service() {
  mkdir -p "$STATE_DIR" "$LOG_DIR"

  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1; then
    if is_app_ready; then
      log "${APP_NAME} is already running on ${APP_URL}"
      return
    fi
    log "Stopping stale ${APP_NAME} process from ${PID_FILE}"
    kill "$(cat "$PID_FILE")" >/dev/null 2>&1 || true
  fi

  if lsof -ti "tcp:${PORT}" >/dev/null 2>&1 && ! is_app_ready; then
    fail "Port ${PORT} is already in use by another service."
  fi

  log "Starting ${APP_NAME} on ${APP_URL}"
  (
    cd "$INSTALL_DIR"
    PORT="$PORT" nohup npm start >"$LOG_FILE" 2>&1 &
    printf '%s\n' "$!" >"$PID_FILE"
  )
}

wait_for_service() {
  local i
  for i in $(seq 1 30); do
    if is_app_ready; then
      log "${APP_NAME} is ready"
      return
    fi
    sleep 1
  done

  tail -n 40 "$LOG_FILE" >&2 || true
  fail "${APP_NAME} did not become ready on ${APP_URL}"
}

open_browser() {
  if [ "$OPEN_BROWSER" = "0" ]; then
    log "Browser opening disabled. Open ${APP_URL} manually."
    return
  fi

  log "Opening ${APP_URL}"
  case "$PLATFORM" in
    macos)
      open "$APP_URL" >/dev/null 2>&1 || log "Open ${APP_URL} manually"
      ;;
    linux)
      if command -v xdg-open >/dev/null 2>&1; then
        nohup xdg-open "$APP_URL" >/dev/null 2>&1 || log "Open ${APP_URL} manually"
      elif command -v sensible-browser >/dev/null 2>&1; then
        nohup sensible-browser "$APP_URL" >/dev/null 2>&1 || log "Open ${APP_URL} manually"
      else
        log "No browser opener found. Open ${APP_URL} manually."
      fi
      ;;
  esac
}

require_command git
require_command node
require_command npm
require_command curl
check_node_version

PLATFORM="$(detect_platform)"
INSTALL_DIR="${TRANSKRYPTOR_INSTALL_DIR:-$(default_install_dir "$PLATFORM")}"
STATE_DIR="${TRANSKRYPTOR_STATE_DIR:-$(default_state_dir "$PLATFORM")}"
LOG_DIR="${TRANSKRYPTOR_LOG_DIR:-$(default_log_dir "$PLATFORM")}"
PID_FILE="${STATE_DIR}/transkryptor.pid"
LOG_FILE="${LOG_DIR}/transkryptor.log"

clone_or_update
setup_env
install_dependencies
start_service
wait_for_service
open_browser

log "Done. Edit ${INSTALL_DIR}/.env to set your Cloud Temple API key."

#!/bin/sh
# Copy the nanocore Docker data volume to ../backups/YYYY-MM-DD
# (sibling of the repo). Stops the container briefly so SQLite is consistent.
# Usage (from anywhere):
#   sh docker/backup.sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DATE=$(date +%Y-%m-%d)
DEST=$(CDPATH= cd -- "$ROOT/.." && pwd)/backups/$DATE
SERVICE=nanocore

cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not on PATH" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is not available" >&2
  exit 1
fi

if ! docker compose ps -a --services 2>/dev/null | grep -qx "$SERVICE"; then
  echo "No compose service '$SERVICE' found. Start the stack once from the repo root:" >&2
  echo "  docker compose up -d" >&2
  exit 1
fi

was_running=0
if docker compose ps --status running --services 2>/dev/null | grep -qx "$SERVICE"; then
  was_running=1
fi

restore() {
  if [ "$was_running" = 1 ]; then
    echo "Starting $SERVICE..."
    docker compose start "$SERVICE"
  fi
}
trap restore EXIT

mkdir -p "$DEST"

if [ "$was_running" = 1 ]; then
  echo "Stopping $SERVICE for a consistent copy..."
  docker compose stop "$SERVICE"
fi

echo "Copying $SERVICE:/data -> $DEST"
docker compose cp "$SERVICE:/data/." "$DEST"

echo "Backup written to $DEST"
ls -la "$DEST"

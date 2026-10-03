#!/bin/bash
# One-command local play for Code Arena (dev seam, no auth).
#   ./scripts/play.sh          # solo on this machine (localhost)
#   ./scripts/play.sh lan      # expose over LAN so a friend can join
# Ctrl-C stops everything.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME_PORT="${GAME_PORT:-3220}"
WEB_PORT="${WEB_PORT:-4173}"
MODE="${1:-local}"

HOST="localhost"
if [ "$MODE" = "lan" ]; then
  HOST="$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
  [ -z "$HOST" ] && { echo "could not detect LAN IP" >&2; exit 1; }
fi
GAME_URL="http://${HOST}:${GAME_PORT}"
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5433/arena_test}"

command -v psql >/dev/null && (pg_isready -h localhost -p 5433 -q 2>/dev/null || echo "warn: no Postgres on :5433 — game will run in-memory (no persistence)") || true
command -v docker >/dev/null || echo "warn: no docker — Run/Submit will fail safely (no counting)"

cd "$ROOT"
npm run build --workspace arena-game >/dev/null 2>&1 || true
PORT="$GAME_PORT" DEV_PRINCIPAL=true node services/game/dist/main.js &
GAME_PID=$!
VITE_GAME_URL="$GAME_URL" npm run build --workspace arena-frontend >/dev/null 2>&1
npm run preview --workspace arena-frontend -- --port "$WEB_PORT" --strictPort --host >/dev/null 2>&1 &
WEB_PID=$!
trap 'kill $GAME_PID $WEB_PID 2>/dev/null' EXIT INT TERM
sleep 2
echo "game: $GAME_URL/health"
echo "you:    http://${HOST}:${WEB_PORT}/?live=1&user=you"
echo "friend: http://${HOST}:${WEB_PORT}/?live=1&user=friend  (same Wi-Fi for lan mode)"
echo "Create a private room, share the invite code. Ctrl-C to stop."
wait

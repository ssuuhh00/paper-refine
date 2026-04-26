#!/usr/bin/env bash
# paper-refine launcher — starts both servers and opens the default browser.
#
# Usage:
#   ./start.sh              # uses defaults: server :3001, web :5173
#   SERVER_PORT=4000 WEB_PORT=4173 ./start.sh
#   ./start.sh --no-open    # skip browser
#
# Logs go to /tmp/paper-refine-{server,web}.log; tail them in another shell.

set -euo pipefail

cd "$(dirname "$0")"

SERVER_PORT="${SERVER_PORT:-3001}"
WEB_PORT="${WEB_PORT:-5173}"
OPEN_BROWSER=1
for arg in "$@"; do
  case "$arg" in
    --no-open) OPEN_BROWSER=0 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "✗ node not found — please install Node.js 18+ first." >&2
  exit 1
fi
if ! command -v claude >/dev/null 2>&1; then
  echo "⚠  claude CLI not found in PATH. Pipeline runs will fail until it's installed."
fi

if [ ! -d node_modules ]; then
  echo "📦 Installing dependencies (first run)…"
  npm install
fi

if lsof -ti:"$SERVER_PORT" >/dev/null 2>&1; then
  echo "✗ port $SERVER_PORT already in use. Free it or set SERVER_PORT=<other>." >&2
  exit 1
fi
if lsof -ti:"$WEB_PORT" >/dev/null 2>&1; then
  echo "✗ port $WEB_PORT already in use. Free it or set WEB_PORT=<other>." >&2
  exit 1
fi

SERVER_LOG="/tmp/paper-refine-server.log"
WEB_LOG="/tmp/paper-refine-web.log"
: > "$SERVER_LOG"
: > "$WEB_LOG"

PORT="$SERVER_PORT" npm run dev:server >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
echo "🟢 backend  pid=$SERVER_PID port=$SERVER_PORT log=$SERVER_LOG"

npm run dev:web >"$WEB_LOG" 2>&1 &
WEB_PID=$!
echo "🟢 frontend pid=$WEB_PID port=$WEB_PORT log=$WEB_LOG"

cleanup() {
  echo ""
  echo "🛑 stopping…"
  kill "$SERVER_PID" "$WEB_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  echo "  done."
}
trap cleanup EXIT INT TERM

# wait for web to respond
URL="http://localhost:$WEB_PORT/"
echo -n "⏳ waiting for $URL "
for i in $(seq 1 60); do
  if curl -sf "$URL" >/dev/null 2>&1; then
    echo "✓"
    break
  fi
  echo -n "."
  sleep 0.3
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo ""
    echo "✗ frontend died — see $WEB_LOG" >&2
    tail -20 "$WEB_LOG" >&2
    exit 1
  fi
done

if [ "$OPEN_BROWSER" = 1 ]; then
  echo "🚀 opening $URL in default browser"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$URL"
  elif command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "$URL" 2>/dev/null
  else
    echo "  (no browser opener found — open $URL manually)"
  fi
fi

echo ""
echo "Press Ctrl+C to stop both servers."
echo "Tail logs:  tail -f $SERVER_LOG $WEB_LOG"
echo ""

# block until either child dies, then cleanup runs via trap
wait -n "$SERVER_PID" "$WEB_PID"

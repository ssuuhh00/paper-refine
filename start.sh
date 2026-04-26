#!/usr/bin/env bash
# paper-refine launcher — starts both servers and opens the default browser.
#
# Usage:
#   ./start.sh              # uses defaults: server :3001, web :5173
#   SERVER_PORT=4000 WEB_PORT=4173 ./start.sh
#   ./start.sh --no-open    # skip browser
#   ./start.sh --kill-stale # kill leftover paper-refine procs on those ports
#                           # (only kills procs whose cwd is under this repo)
#
# Logs go to /tmp/paper-refine-{server,web}.log; tail them in another shell.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SERVER_PORT="${SERVER_PORT:-3001}"
WEB_PORT="${WEB_PORT:-5173}"
OPEN_BROWSER=1
KILL_STALE=0
for arg in "$@"; do
  case "$arg" in
    --no-open) OPEN_BROWSER=0 ;;
    --kill-stale) KILL_STALE=1 ;;
    -h|--help)
      sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

# Returns 0 (and prints a short summary) if every PID holding $1 has its cwd
# inside $SCRIPT_DIR. Returns non-zero if any PID is foreign or the port
# is free.
port_is_only_ours() {
  local port=$1
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  [ -z "$pids" ] && return 1  # nothing on the port → nothing to "kill"
  local pid cwd
  for pid in $pids; do
    cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || echo "")
    case "$cwd" in
      "$SCRIPT_DIR"|"$SCRIPT_DIR"/*) ;;
      *) return 1 ;;  # foreign process — refuse
    esac
  done
  echo "$pids"
  return 0
}

# Print who is on the given port (pid + cwd + cmd) — for the refuse message.
describe_port_holder() {
  local port=$1
  local pid cwd cmd
  for pid in $(lsof -ti:"$port" 2>/dev/null || true); do
    cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || echo "?")
    cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 80 || echo "?")
    echo "    pid=$pid cwd=$cwd"
    echo "      cmd: $cmd"
  done
}

handle_busy_port() {
  local port=$1 label=$2 envvar=$3
  if ! lsof -ti:"$port" >/dev/null 2>&1; then
    return 0  # free
  fi
  if [ "$KILL_STALE" = 1 ]; then
    local ours
    if ours=$(port_is_only_ours "$port"); then
      echo "🧹 killing stale $label proc(s) on $port: $ours"
      kill -9 $ours 2>/dev/null || true
      sleep 0.3
      return 0
    fi
    echo "✗ port $port held by a process outside this repo — refusing to kill." >&2
    describe_port_holder "$port" >&2
    exit 1
  fi
  echo "✗ port $port already in use. Free it, set $envvar=<other>, or rerun with --kill-stale." >&2
  describe_port_holder "$port" >&2
  exit 1
}

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

handle_busy_port "$SERVER_PORT" backend  SERVER_PORT
handle_busy_port "$WEB_PORT"    frontend WEB_PORT

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

#!/usr/bin/env bash
# Stops the server started by scripts/local-up.sh (and its mock Claude API, if STRIVE_LOCAL_BRAIN=mock
# started one). Local D1/KV data stays in .wrangler/state.
set -uo pipefail
cd "$(dirname "$0")/.."
PORT="${STRIVE_LOCAL_PORT:-8787}"
MOCK_PORT="${STRIVE_MOCK_PORT:-8789}"

if [ -f .wrangler/local-mock.pid ]; then
  kill "$(cat .wrangler/local-mock.pid)" 2>/dev/null
  rm -f .wrangler/local-mock.pid
fi
# a mock orphaned by a lost pid file; only ever touch test/mock-anthropic.mjs
for p in $(lsof -ti "tcp:$MOCK_PORT" -sTCP:LISTEN 2>/dev/null); do
  ps -o args= -p "$p" | grep -q 'mock-anthropic' && kill "$p" 2>/dev/null
done

if [ -f .wrangler/local-dev.pid ]; then
  kill "$(cat .wrangler/local-dev.pid)" 2>/dev/null
  rm -f .wrangler/local-dev.pid
fi
# a hard-killed wrangler can leave its workerd child holding the port; only ever touch workerd
for _ in 1 2 3 4 5; do
  pids=$(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | while read -r p; do
    ps -o comm= -p "$p" | grep -q workerd && echo "$p"; done)
  [ -z "$pids" ] && exit 0
  kill $pids 2>/dev/null
  sleep 1
done

#!/usr/bin/env bash
# Hermetic local Strive API: wrangler dev --local (miniflare D1 + KV), no Cloudflare account needed.
#
#   npm ci
#   STRIVE_TEST_KEY_ANGELA=<random> STRIVE_TEST_KEY_REVIEW=<random> scripts/local-up.sh
#   STRIVE_API_BASE=http://127.0.0.1:8787 STRIVE_TEST_KEY_REVIEW=<same> node test/smoke.mjs
#   scripts/local-down.sh
#
# Applies schema + seed to the local D1, loads the starter clips into the local KV, writes .dev.vars
# (studio keys from the env), then starts the server in the background and waits for /v1/config.
# Idempotent: every run restarts the server on a fresh copy of the seed (local data is reset).
# No FISH_API_KEY / ANTHROPIC_API_KEY locally, so voice and drafting are off: approving unedited
# starter text still works (its clip is in KV); anything needing a fresh render returns 503.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${STRIVE_TEST_KEY_ANGELA:?set STRIVE_TEST_KEY_ANGELA to a random string (16+ chars of A-Z a-z 0-9 _ -)}"
: "${STRIVE_TEST_KEY_REVIEW:?set STRIVE_TEST_KEY_REVIEW to a random string (16+ chars of A-Z a-z 0-9 _ -)}"
for k in "$STRIVE_TEST_KEY_ANGELA" "$STRIVE_TEST_KEY_REVIEW"; do
  [[ "$k" =~ ^[A-Za-z0-9_-]{16,}$ ]] || { echo "local-up: test keys must be 16+ chars of A-Z a-z 0-9 _ -" >&2; exit 1; }
done

PORT="${STRIVE_LOCAL_PORT:-8787}"
LOG=.wrangler-dev.log
WRANGLER="$PWD/node_modules/.bin/wrangler"
node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' \
  || { echo "local-up: wrangler 4 needs Node 22+, found $(node -v)" >&2; exit 1; }
[ -x "$WRANGLER" ] || { echo "local-up: wrangler isn't installed — run npm ci in worker/ first" >&2; exit 1; }
export WRANGLER_SEND_METRICS=false

scripts/local-down.sh >/dev/null 2>&1 || true
if lsof -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "local-up: something else is already listening on port $PORT" >&2; exit 1
fi

rm -rf .wrangler/state   # local D1 + KV only; production data is never touched from here
node seed/build-seed.mjs
"$WRANGLER" d1 execute strive-db --local --file schema.sql >/dev/null
"$WRANGLER" d1 execute strive-db --local --file seed/seed.sql >/dev/null
node seed/upload-audio.mjs --local
echo "local D1 + KV seeded"

# every test client signs in from 127.0.0.1, so the per-IP auth limit is lifted locally
(umask 077 && printf "ATHLETE_KEYS='{\"%s\":\"angela\",\"%s\":\"angela-review\"}'\nAUTH_ATTEMPTS_PER_HOUR=100000\n" \
  "$STRIVE_TEST_KEY_ANGELA" "$STRIVE_TEST_KEY_REVIEW" > .dev.vars)

mkdir -p .wrangler
nohup "$WRANGLER" dev --local --port "$PORT" --ip 127.0.0.1 --test-scheduled </dev/null >"$LOG" 2>&1 &
echo $! > .wrangler/local-dev.pid
disown

for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:$PORT/v1/config" >/dev/null 2>&1; then
    echo "Strive API v1 is up at http://127.0.0.1:$PORT/v1 (log: worker/$LOG)"
    exit 0
  fi
  kill -0 "$(cat .wrangler/local-dev.pid)" 2>/dev/null || break
  sleep 1
done
echo "local-up: wrangler dev didn't come up — last log lines:" >&2
tail -40 "$LOG" >&2
exit 1

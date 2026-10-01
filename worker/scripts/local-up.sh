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
#
# STRIVE_LOCAL_BRAIN=mock also starts test/mock-anthropic.mjs (a scripted stand-in for the Claude API,
# port STRIVE_MOCK_PORT, default 8789) and gives the worker a dummy ANTHROPIC_API_KEY pointed at it,
# with AUTOPILOT_MODE=grounded — so Coach Angela's autopilot / review / decline paths run end to end
# for free (keywords in test/mock-anthropic.mjs pick the reply). Nothing reaches api.anthropic.com
# from /v1. Then: node test/v1-brain.test.mjs. scripts/local-down.sh stops the mock too.
#
# STRIVE_LOCAL_SIGNIN=mock also starts test/mock-identity.mjs (a stand-in for Resend and for Google's
# ID-token keys, port STRIVE_IDENTITY_PORT, default 8791) and turns v1.2 sign-in on against it: a
# placeholder RESEND_API_KEY, EMAIL_FROM, a test GOOGLE_CLIENT_ID, loopback RESEND_BASE_URL /
# GOOGLE_JWKS_URL, and a raised per-IP email limit. No mail leaves the machine. Then:
# node test/v1-signin.test.mjs. Combines with STRIVE_LOCAL_BRAIN=mock; local-down.sh stops it too.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${STRIVE_TEST_KEY_ANGELA:?set STRIVE_TEST_KEY_ANGELA to a random string (16+ chars of A-Z a-z 0-9 _ -)}"
: "${STRIVE_TEST_KEY_REVIEW:?set STRIVE_TEST_KEY_REVIEW to a random string (16+ chars of A-Z a-z 0-9 _ -)}"
for k in "$STRIVE_TEST_KEY_ANGELA" "$STRIVE_TEST_KEY_REVIEW"; do
  [[ "$k" =~ ^[A-Za-z0-9_-]{16,}$ ]] || { echo "local-up: test keys must be 16+ chars of A-Z a-z 0-9 _ -" >&2; exit 1; }
done
BRAIN="${STRIVE_LOCAL_BRAIN:-}"
[[ -z "$BRAIN" || "$BRAIN" == mock ]] || { echo "local-up: STRIVE_LOCAL_BRAIN must be 'mock' or unset" >&2; exit 1; }
MOCK_PORT="${STRIVE_MOCK_PORT:-8789}"
SIGNIN="${STRIVE_LOCAL_SIGNIN:-}"
[[ -z "$SIGNIN" || "$SIGNIN" == mock ]] || { echo "local-up: STRIVE_LOCAL_SIGNIN must be 'mock' or unset" >&2; exit 1; }
ID_PORT="${STRIVE_IDENTITY_PORT:-8791}"
GOOGLE_TEST_CLIENT=strive-test.apps.googleusercontent.com   # = TEST_CLIENT_ID in test/mock-identity.mjs

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
if [ -n "$BRAIN" ] && lsof -ti "tcp:$MOCK_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "local-up: something else is already listening on port $MOCK_PORT (set STRIVE_MOCK_PORT)" >&2; exit 1
fi
if [ -n "$SIGNIN" ] && lsof -ti "tcp:$ID_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "local-up: something else is already listening on port $ID_PORT (set STRIVE_IDENTITY_PORT)" >&2; exit 1
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
if [ -n "$BRAIN" ]; then
  # the key is a dummy: every /v1 brain and revise call goes to the mock named here
  printf "ANTHROPIC_API_KEY=local-mock-not-a-real-key\nANTHROPIC_BASE_URL=http://127.0.0.1:%s\nAUTOPILOT_MODE=grounded\n" "$MOCK_PORT" >> .dev.vars
  nohup node test/mock-anthropic.mjs "$MOCK_PORT" </dev/null >.wrangler/local-mock.log 2>&1 &
  echo $! > .wrangler/local-mock.pid
  disown
  for _ in $(seq 1 20); do
    curl -fsS "http://127.0.0.1:$MOCK_PORT/__requests" >/dev/null 2>&1 && break
    kill -0 "$(cat .wrangler/local-mock.pid)" 2>/dev/null || break
    sleep 0.5
  done
  curl -fsS "http://127.0.0.1:$MOCK_PORT/__requests" >/dev/null 2>&1 \
    || { echo "local-up: the mock Claude API didn't start — see worker/.wrangler/local-mock.log" >&2; exit 1; }
fi
if [ -n "$SIGNIN" ]; then
  # placeholders only: every sign-in email and Google key fetch goes to the mock named here (the worker
  # honours these URL overrides only because they are loopback)
  printf 'RESEND_API_KEY=local-mock-not-a-real-key\nRESEND_BASE_URL=http://127.0.0.1:%s\nEMAIL_FROM="Strive Local <signin@strive.test>"\nGOOGLE_CLIENT_ID=%s\nGOOGLE_JWKS_URL=http://127.0.0.1:%s/oauth2/v3/certs\nEMAIL_PER_IP_HOUR=100000\n' \
    "$ID_PORT" "$GOOGLE_TEST_CLIENT" "$ID_PORT" >> .dev.vars
  MOCK_GOOGLE_CLIENT_ID="$GOOGLE_TEST_CLIENT" nohup node test/mock-identity.mjs "$ID_PORT" </dev/null >.wrangler/local-identity.log 2>&1 &
  echo $! > .wrangler/local-identity.pid
  disown
  for _ in $(seq 1 20); do
    curl -fsS "http://127.0.0.1:$ID_PORT/__health" >/dev/null 2>&1 && break
    kill -0 "$(cat .wrangler/local-identity.pid)" 2>/dev/null || break
    sleep 0.5
  done
  curl -fsS "http://127.0.0.1:$ID_PORT/__health" >/dev/null 2>&1 \
    || { echo "local-up: the mock identity server didn't start — see worker/.wrangler/local-identity.log" >&2; exit 1; }
fi
nohup "$WRANGLER" dev --local --port "$PORT" --ip 127.0.0.1 --test-scheduled </dev/null >"$LOG" 2>&1 &
echo $! > .wrangler/local-dev.pid
disown

for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:$PORT/v1/config" >/dev/null 2>&1; then
    echo "Strive API v1 is up at http://127.0.0.1:$PORT/v1 (log: worker/$LOG)"
    [ -z "$BRAIN" ] || echo "Coach Angela brain: mock Claude at http://127.0.0.1:$MOCK_PORT, AUTOPILOT_MODE=grounded (log: worker/.wrangler/local-mock.log)"
    [ -z "$SIGNIN" ] || echo "Sign-in: mock Resend + Google keys at http://127.0.0.1:$ID_PORT, client id $GOOGLE_TEST_CLIENT (log: worker/.wrangler/local-identity.log)"
    exit 0
  fi
  kill -0 "$(cat .wrangler/local-dev.pid)" 2>/dev/null || break
  sleep 1
done
echo "local-up: wrangler dev didn't come up — last log lines:" >&2
tail -40 "$LOG" >&2
exit 1

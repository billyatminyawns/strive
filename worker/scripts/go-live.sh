#!/usr/bin/env bash
# Takes Strive live — the web app's API v1 (accounts, questions, approvals, voice) plus Coach
# Angela — in one interactive pass. Safe to re-run: every step checks before it acts, and nothing
# secret is ever printed.
#
#   cd worker && scripts/go-live.sh
#
#  1. Cloudflare login (opens your browser once if the token expired)
#  2. Creates the D1 database + KV namespace if wrangler.toml still has placeholder ids
#     (one Worker serves the live app's /v1 API and the demo's /ask + /voice, so deploy needs
#     real bindings)
#  3. Secrets: ATHLETE_KEYS (from .secrets.local.json); ANTHROPIC_API_KEY is optional (pasted,
#     hidden) — without it, new questions simply wait for Angela to answer them herself
#  4. Consent gate: asks whether Angela approved autopilot → sets the AUTOPILOT_MODE secret
#  5. Compiles the brain, runs its tests, deploys, and probes production
#  6. Optionally commits + pushes the web app (GitHub Pages rebuilds in ~1 min)
#  7. Prints the invite link for fans
set -euo pipefail
cd "$(dirname "$0")/.."

W="$PWD/node_modules/.bin/wrangler"
export WRANGLER_SEND_METRICS=false
say() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ask() { local a; read -r -p "$1 [y/N] " a; [[ "$a" =~ ^[Yy] ]]; }

node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' || { echo "Needs Node 22+ (found $(node -v))"; exit 1; }
[ -x "$W" ] || npm ci

say "1/7 Cloudflare login"
if ! "$W" whoami 2>&1 | grep -qi "associated with the email"; then
  "$W" login
fi
"$W" whoami 2>&1 | grep -i "email" | head -1

say "2/7 Database + storage bindings"
if grep -q 'database_id = "00000000-0000-0000-0000-000000000000"' wrangler.toml; then
  id=$("$W" d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=(JSON.parse(s||"[]").find(x=>x.name==="strive-db")||{});console.log(d.uuid||"")})')
  [ -n "$id" ] || id=$("$W" d1 create strive-db 2>&1 | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  [ -n "$id" ] || { echo "Couldn't create or find D1 database strive-db"; exit 1; }
  sed -i '' "s/database_id = \"00000000-0000-0000-0000-000000000000\"/database_id = \"$id\"/" wrangler.toml
  "$W" d1 execute strive-db --remote --file schema.sql >/dev/null
  node seed/build-seed.mjs >/dev/null && "$W" d1 execute strive-db --remote --file seed/seed.sql >/dev/null
  echo "D1 strive-db ready ($id), schema + seed applied"
else echo "D1 already bound"; fi
if grep -q 'id = "00000000000000000000000000000000"' wrangler.toml; then
  kv=$("$W" kv namespace list 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const d=(JSON.parse(s).find(x=>/AUDIO/.test(x.title))||{});console.log(d.id||"")}catch{console.log("")}})')
  [ -n "$kv" ] || kv=$("$W" kv namespace create AUDIO 2>&1 | grep -Eo '[0-9a-f]{32}' | head -1)
  [ -n "$kv" ] || { echo "Couldn't create or find the AUDIO KV namespace"; exit 1; }
  sed -i '' "s/id = \"00000000000000000000000000000000\"/id = \"$kv\"/" wrangler.toml
  node seed/upload-audio.mjs --remote
  echo "KV AUDIO ready ($kv)"
else echo "KV already bound"; fi

say "3/7 Secrets"
have=$("$W" secret list 2>/dev/null || echo "[]")
if ! grep -q '"ANTHROPIC_API_KEY"' <<<"$have"; then
  echo "Optional: an Anthropic API key turns on Coach Angela (drafted replies she approves)."
  echo "Skip it and every new question simply waits for Angela to write or dictate the answer."
  if ask "Add an Anthropic API key now? (console.anthropic.com → API keys; input is hidden)"; then
    "$W" secret put ANTHROPIC_API_KEY
  fi
else echo "ANTHROPIC_API_KEY already set"; fi
if ! grep -q '"ATHLETE_KEYS"' <<<"$have" && [ -f .secrets.local.json ]; then
  node -e 'const d=require("./.secrets.local.json");process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(d).map(([t,k])=>[k,t]))))' \
    | "$W" secret put ATHLETE_KEYS >/dev/null && echo "ATHLETE_KEYS set from .secrets.local.json"
fi
grep -q '"FISH_API_KEY"' <<<"$have" && echo "FISH_API_KEY present (Angela's voice)" || echo "⚠ FISH_API_KEY missing — replies will fall back to WellSaid/on-device voice"

say "4/7 Consent: Coach Angela autopilot"
cat <<'TXT'
Autopilot lets Coach Angela answer fans ON ITS OWN, in Angela's cloned voice, when the reply is
grounded in her verified public record. Everything else still waits for her approval.
Angela OK'd voice cloning for the prototype; answering in her name without review is a new scope.
TXT
if ask "Has Angela given written approval for autopilot replies in her voice?"; then mode=grounded; else mode=review; fi
printf '%s' "$mode" | "$W" secret put AUTOPILOT_MODE >/dev/null
echo "AUTOPILOT_MODE = $mode  (change later: printf review | npx wrangler secret put AUTOPILOT_MODE)"

say "5/7 Build, test, deploy"
node scripts/build-brain.mjs
node test/brain.test.mjs | tail -1
"$W" deploy
B=https://strive-api.billyatminyawns.workers.dev
O="Origin: https://billyatminyawns.github.io"
echo "health: $(curl -s -m 15 $B/health -H "$O")"
echo "v1:     $(curl -s -m 15 $B/v1/config -H "$O" | head -c 160)"
echo "cors:   $(curl -s -m 15 -o /dev/null -w '%{http_code}' -X OPTIONS $B/v1/me -H "$O" \
  -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization') (want 204)"
grep -q '"ANTHROPIC_API_KEY"' <<<"$("$W" secret list 2>/dev/null || echo '[]')" && \
echo "ask:    $(curl -s -m 60 -X POST $B/ask -H "$O" -H 'content-type: application/json' \
  -d '{"question":"How many Olympics did you play in?","autopilot":true}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const d=JSON.parse(s);console.log(d.route+" · "+(d.reason||"")+" · "+String(d.reply||d.error).slice(0,90))}catch{console.log(s.slice(0,200))}})')"

say "6/7 Publish the web app"
cd ..
git status --short | head -20
if ask "Commit these changes and push to GitHub Pages (public repo)?"; then
  # .gitignore keeps .secrets.local.json, .dev.vars and raw research out; .github/ stays local.
  paths=()
  for p in app js css assets index.html demo.html manifest.webmanifest sw.js privacy.html terms.html \
    support.html legal.css README.md CONTRACT.md docs .gitignore worker/src worker/persona worker/seed \
    worker/scripts worker/test worker/schema.sql worker/wrangler.toml worker/package.json worker/package-lock.json; do
    [ -e "$p" ] && paths+=("$p")
  done
  git add -A -- "${paths[@]}"
  git commit -m "Publish Strive web app + API" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" || true
  git push
  echo "Pushed. Live in ~1 min at https://billyatminyawns.github.io/strive/"
fi

say "7/7 Invite fans"
cat <<'TXT'
Fans:   https://billyatminyawns.github.io/strive/?invite=ANGELA   (or code ANGELA on the welcome screen)
Angela: same link → "I'm an athlete" → her studio key (worker/.secrets.local.json — send it privately)
        Nothing reaches fans until she approves it: bio, drops and starter answers wait in her queue.
On a phone, add it to the home screen:
  iPhone  → Share → Add to Home Screen
  Android → ⋮ menu → Install app
TXT

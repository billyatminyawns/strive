#!/usr/bin/env bash
# Turns on Strive sign-in (6-digit email codes + "Continue with Google"). Safe to re-run; nothing
# secret is printed. Either half can be skipped — the app only shows the methods that are set up.
#
#   cd worker && scripts/setup-signin.sh
#
#  1. Cloudflare login (opens your browser once if the token expired)
#  2. Sign-in tables in the live database (CREATE IF NOT EXISTS — existing data is untouched)
#  3. Google: the OAuth *Web* client ID (public; ends in .apps.googleusercontent.com)
#  4. Email codes: your Resend API key (pasted, hidden) + the From address on your verified domain
#  5. Probes production
set -euo pipefail
cd "$(dirname "$0")/.."

W="$PWD/node_modules/.bin/wrangler"
export WRANGLER_SEND_METRICS=false
say() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ask() { local a; read -r -p "$1 [y/N] " a; [[ "$a" =~ ^[Yy] ]]; }

node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' || { echo "Needs Node 22+ (found $(node -v))"; exit 1; }
[ -x "$W" ] || npm ci

say "1/5 Cloudflare login"
"$W" whoami 2>&1 | grep -qi "associated with the email" || "$W" login

say "2/5 Sign-in tables"
"$W" d1 execute strive-db --remote --file schema.sql -y >/dev/null && echo "schema applied (idempotent)"

say "3/5 Google sign-in"
read -r -p "Google OAuth Web client ID (blank = skip): " gid
if [ -n "$gid" ]; then
  [[ "$gid" =~ ^[0-9]+-[A-Za-z0-9_]+\.apps\.googleusercontent\.com$ ]] || { echo "That doesn't look like a Web client ID (…apps.googleusercontent.com)."; exit 1; }
  printf '%s' "$gid" | "$W" secret put GOOGLE_CLIENT_ID >/dev/null && echo "GOOGLE_CLIENT_ID set"
fi

say "4/5 Email codes (Resend)"
if ask "Set up email codes now?"; then
  echo "Paste your Resend API key (resend.com → API Keys, 'Sending access'). Input is hidden."
  "$W" secret put RESEND_API_KEY
  read -r -p "From address on your verified domain, e.g. Strive <signin@mail.yourdomain.com>: " from
  [[ "$from" =~ [^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+ ]] || { echo "That doesn't look like an email address."; exit 1; }
  printf '%s' "$from" | "$W" secret put EMAIL_FROM >/dev/null && echo "EMAIL_FROM set"
  if ask "On Resend's free plan (100 emails/day)? Cap sign-in emails at 100/day to match"; then
    printf '100' | "$W" secret put EMAIL_DAILY_CAP >/dev/null && echo "EMAIL_DAILY_CAP = 100"
  fi
fi

say "5/5 Check"
B=https://strive-api.billyatminyawns.workers.dev
echo "config: $(curl -s -m 15 $B/v1/config)"
cat <<'TXT'

Sign-in shows up in the app as soon as config lists it ("signIn": {"email": true, "google": "…"}).
Try it: open https://billyatminyawns.github.io/strive/ → join → "Save your seat".
TXT

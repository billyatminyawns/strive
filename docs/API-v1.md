# Strive API v1 — contract for the iOS app

Base URL: `https://strive-api.billyatminyawns.workers.dev/v1`
Runs on the existing Cloudflare Worker (`worker/`). The legacy web-demo routes `/draft`, `/voice`, `/health` stay untouched.

## Principles

1. **Nothing reaches fans until the athlete approves it.** Fan-facing endpoints only ever return approved content
   (published drops, answered/instant replies, approved bio). Seeded starter content for the real tenant starts as drafts.
2. **Multi-tenant from day one.** Every row carries `athlete_id`. v1 has two tenants:
   - `angela` — the real one. Invite code `ANGELA`. Starter content seeded as **drafts** awaiting Angela.
   - `angela-review` — isolated sandbox for Apple App Review / demos. Invite code `REVIEW`. Starter content seeded **pre-approved** so the fan side is populated.
3. **Honest data only.** Stats are computed from real rows. No fake fans, listen counts, or provenance ("drafted from your 2019 podcast" is banned — starter content says it is a starter draft).

## Conventions

- JSON in/out, camelCase keys. Errors: HTTP 4xx/5xx with `{ "error": "human-readable message" }`.
- Auth: `Authorization: Bearer <token>`; tokens come from the auth endpoints. Missing/invalid → 401. Wrong role → 403.
- Timestamps: integer milliseconds since epoch. IDs: opaque strings.
- `audioKey` = opaque key for `GET /v1/audio/:key`. `duration` = seconds (float), may be null.

## Objects

**Athlete** (public profile)
```json
{
  "id": "angela", "name": "Angela Ruggiero", "firstName": "Angela", "coachName": "Coach Angela",
  "headline": "Olympic gold medalist · Hockey Hall of Fame", "sport": "Hockey",
  "photoURL": "https://billyatminyawns.github.io/strive/assets/angela1.webp",
  "heroURL": "https://billyatminyawns.github.io/strive/assets/medals.jpg",
  "badges": ["4× Olympian", "256 games · Team USA", "IOC member"],
  "bio": { "text": "Hey, I'm Angela…", "audioKey": "…", "duration": 20.0 },
  "paused": false
}
```
`bio` is `null` until the athlete approves it.

**User**
```json
{ "id": "u_…", "role": "fan", "name": "Marcus", "interests": ["Mindset", "Stories"], "athleteId": "angela", "createdAt": 1790000000000 }
```
`role` is `"fan"` or `"athlete"`. `name` may be null.

**Drop**
```json
{
  "id": "d_…", "title": "Gold medal morning", "script": "People ask what…",
  "status": "published", "source": "Starter draft — edit it or redraft it",
  "audioKey": "…", "duration": 20.9, "publishedAt": 1790000000000, "queuePos": null,
  "listens": 12, "pinned": false, "listened": false
}
```
`status`: `draft | queued | published | rejected`. `listened` is fan-specific (always false for athletes).

**Question** (fan thread item)
```json
{
  "id": "q_…", "text": "How do I handle pre-game nerves?",
  "status": "answered", "answer": "Nerves mean it matters…", "audioKey": "…", "duration": 15.2,
  "note": null, "createdAt": 1790000000000, "answeredAt": 1790000100000, "saved": false
}
```
`status`:
- `pending` — waiting for the athlete. `note` = "With Angela — she reviews every answer before it's sent."
  (v1.1: while autopilot is live — server `AUTOPILOT_MODE=grounded` + a brain key + Angela's own switch — it reads
  "With Angela — her AI Coach answers what her public record covers; she answers the rest herself.")
- `answered` — athlete approved; `answer` + `audioKey` set.
- `instant` — matched an already-approved answer; `answer` + `audioKey` set immediately.
- `guarded` — auto-declined sensitive topic (medical/betting/legal). No audio. `note` = system text (not in the athlete's voice).
- `declined` — athlete passed. `note` = "Angela passed on this one — she answers what she can speak to best."

**StudioQuestion** (athlete queue item)
```json
{
  "id": "q_…", "text": "I'm 16 and just got cut from AAA…", "fanName": "Marcus", "kind": "fan",
  "draft": "Getting cut stings…", "draftSource": "claude", "drafting": false, "createdAt": 1790000000000
}
```
`kind`: `fan` (a real fan asked; approving replies to them) or `starter` (a common question seeded by Strive; approving adds it to the instant-answer library, nobody is notified). `draftSource`: `claude | starter | none` (`none` → empty draft, athlete writes it). `fanName` null for starters.

**Notification**
```json
{ "id": "n_…", "text": "Angela answered you", "sub": "How do I handle…", "link": "ask", "createdAt": 1790000000000, "read": false }
```
`link`: `ask | home | drop:<id>`.

## Public

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/v1/config` | — | `{ "drafting": bool, "voice": bool, "push": bool, "minBuild": 1 }` |
| POST | `/v1/auth/fan` | `{ "code": "ANGELA", "name": "Marcus" }` (name optional) | `{ token, user, athlete }` · 404 bad code · 429 too many attempts |
| POST | `/v1/auth/athlete` | `{ "key": "…" }` | `{ token, user, athlete }` · 401 bad key · 429 |

## Any signed-in user

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/v1/me` | — | `{ user, athlete }` |
| PATCH | `/v1/me` | `{ "name"?: string, "interests"?: [string] }` | `{ user }` |
| DELETE | `/v1/me` | — | `{ "ok": true }` — fan: deletes the account and all their data; athlete: revokes the token only |
| POST | `/v1/auth/signout` | — | `{ "ok": true }` (revokes this token) |
| GET | `/v1/audio/:key` | — | `audio/mpeg` bytes · 404 |
| POST | `/v1/devices` | `{ "token": "<apns hex>", "env": "sandbox"｜"production" }` | `{ "ok": true }` |
| GET | `/v1/notifications` | — | `{ "notifications": [Notification], "unread": 2 }` newest first, max 50 |
| POST | `/v1/notifications/read` | — | `{ "ok": true }` |

## Fan

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/v1/home` | — | `{ athlete, today: Drop｜null, picks: [Drop], suggested: [Drop], suggestions: [string], unread: int }` |
| GET | `/v1/drops` | — | `{ "drops": [Drop] }` published, newest first |
| POST | `/v1/drops/:id/listen` | — | `{ "listens": int }` idempotent per user |
| GET | `/v1/questions` | — | `{ "questions": [Question], "paused": bool }` oldest first |
| POST | `/v1/questions` | `{ "text": "…" }` (1–300 chars) | 201 `{ question }` · 409 paused · 429 over 10/day |
| POST | `/v1/questions/:id/save` | `{ "saved": bool }` | `{ question }` |

`today` = latest published drop. `picks` = pinned published drops. `suggested` = other published drops, unlistened first (max 10).
`suggestions` = up to 4 question strings from the approved instant-answer library (tapping one asks it → instant answer).

## Athlete (role = athlete)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/v1/studio/today` | — | `{ queueCount, stats, draftDrops: [Drop], queued: [Drop], nextPublishAt｜null, bioStatus: "draft"｜"approved" }` |
| GET | `/v1/studio/queue` | — | `{ "questions": [StudioQuestion] }` pending, oldest first |
| POST | `/v1/studio/questions/:id/approve` | `{ "text": "final answer" }` | `{ ok, audioKey, duration }` · 502 if the voice render fails · 503 if voice isn't configured and this exact text was never rendered (status unchanged either way) · 409 if no longer pending |
| POST | `/v1/studio/questions/:id/decline` | — | `{ "ok": true }` |
| POST | `/v1/studio/questions/:id/revise` | `{ "text": "current draft", "note": "what to change" }` | `{ "draft": "…" }` · 503 when drafting isn't configured |
| POST | `/v1/studio/preview` | `{ "text": "…" }` | `{ audioKey, duration }` (render in her voice without approving) · 502/503 as approve |
| GET | `/v1/studio/drops` | — | `{ drafts: [Drop], queued: [Drop], published: [Drop] }` |
| POST | `/v1/studio/drops` | `{ "title": "…", "script": "…" }` | `{ drop }` new draft (e.g. from a captured recording) |
| POST | `/v1/studio/drops/:id/approve` | `{ "title"?: string, "script"?: string, "publishNow"?: bool }` | `{ drop }` — renders voice; `queued` (appended) or `published` · 409 if already published · 502/503 as approve |
| POST | `/v1/studio/drops/:id/reject` | — | `{ "ok": true }` |
| POST | `/v1/studio/drops/:id/pin` | `{ "pinned": bool }` | `{ drop }` |
| GET | `/v1/studio/bio` | — | `{ text, status, audioKey｜null, duration｜null }` |
| POST | `/v1/studio/bio` | `{ "text": "…" }` | `{ text, status: "approved", audioKey, duration }` · 502/503 as approve |
| GET | `/v1/studio/settings` | — | `{ paused, guardTopics, guardDecline }` |
| PATCH | `/v1/studio/settings` | any subset | same shape |
| GET | `/v1/studio/prompts` | — | `{ prompts: [{ id, title, src, hint }], coverage: [{ bucket, pct }] }` |
| POST | `/v1/studio/prompts/:id/pass` | — | `{ "ok": true }` |
| GET | `/v1/studio/stories` | — | `{ "stories": [{ id, promptId, title, transcript, duration, createdAt }] }` newest first |
| POST | `/v1/studio/stories` | `{ promptId, title, transcript, duration, audio: "<base64 m4a>"｜null }` | `{ story }` |
| DELETE | `/v1/studio/stories/:id` | — | `{ "ok": true }` |

`stats` = `{ members, membersWeek, answeredPct｜null, medianReplyHours｜null, listensWeek, published }` — all computed from real rows.
`coverage` = how much approved material exists per topic bucket (Training, Mindset, Nutrition, Recovery, Leadership, Culture), computed from approved answers + published drops + stories. Honest, starts low.
Prompts: curated starter prompts (`src: "STARTER PROMPT"`), plus live ones built from real pending fan questions (`src: "FANS ARE ASKING"`), plus a free-talk prompt (`id: "free"`).

## Behaviour

- **Guardrail:** sensitive topics (medical / betting / legal, token-boundary matching) → `guarded` instantly when `guardDecline` is on.
- **Instant answers:** a new question that clearly matches an approved answer (conservative token matching — false positives are worse than misses) → `instant`.
- **Drafting:** otherwise `pending`; if `ANTHROPIC_API_KEY` is set, Claude drafts in the background from the persona, approved answers and recent stories (`drafting: true` meanwhile). Without the key the draft is empty and the athlete writes it.
- **Approval** renders the final text in the athlete's voice (Fish Audio, the cloned voice, speed 0.87), stores the audio, notifies the fan, and adds the Q&A to the instant-answer library.
- **Voice** is content-addressed: the same text always gets the same `audioKey` and is only ever rendered once. Seeded starter text is pre-rendered, so approving it unedited works even when `config.voice` is false; new text then gets a 503.
- **Daily drop:** a cron at 14:00 UTC (7:00 AM Pacific) publishes the next queued drop per athlete if none was published in the last 20 hours, and posts a broadcast notification.
- **Paused:** fans can read everything but can't ask (409 with a friendly message).
- **Limits:** 10 questions/day per fan; auth attempts rate-limited per IP.

## Server notes (v1 implementation)

Details the tables above leave open. None of them change a documented shape.

- `GET /v1/audio/:key` needs the `Authorization` header like every signed-in route (for AVPlayer, pass it via `AVURLAssetHTTPHeaderFieldsKey` or download first). It supports `Range: bytes=…` (206 + `Content-Range`) and `HEAD`; audio is immutable, cached for a year.
- Invite codes are case-insensitive. Fan `name` is trimmed to 40 characters; `PATCH /v1/me` takes up to 20 interests of up to 40 characters each.
- Live prompts have ids `fan-<questionId>`; they disappear once that question is answered, declined or passed. A prompt with a recorded story (matched by `promptId`) is no longer offered; `free` is always offered.
- `queuePos` is the drop's current 1-based place in the queue. Broadcast notifications (`New drop: …`) are shown to fans who joined before they were sent.
- `drafting` reads `false` again if a background draft hasn't landed within 2 minutes (the draft stays empty; use revise).
- `DELETE /v1/me` (fan) also removes library entries approved from that fan's questions, since they carry the fan's words.
- Rejecting a drop takes it off every list, including a published one (fans stop seeing it).
- Other statuses the client may see: 400 invalid input, 405 wrong method, 413 story audio over ~20 MB, 500 unexpected. Every error body is `{ "error": "…" }` with a message fit to show as-is.

## v1.1 — web client + Coach Angela brain (10/1/26)

Additions for the live web app (served from GitHub Pages) and for wiring the Coach Angela brain (`worker/src/brain.js`) into the real question flow. Nothing above changes shape; these fields and routes are additive.

### Browser access (CORS)
Every `/v1/*` route answers browser origins listed in `ALLOWED_ORIGINS` (plus `http://localhost:8642` and `http://127.0.0.1:8642` for local dev): `Access-Control-Allow-Origin: <origin>`, `Vary: Origin`, and `OPTIONS` preflights return 204 with `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`, `Access-Control-Allow-Headers: authorization, content-type`, `Access-Control-Max-Age: 86400`. Requests without an `Origin` header (the iOS app) are unaffected. Unlisted origins get no `Access-Control-Allow-Origin`.

### Question — new fields
```json
{ "answeredBy": "angela", "sources": [{ "id": "olympedia-2010", "title": "Olympedia — Angela Ruggiero", "url": "https://…" }] }
```
- `answeredBy`: `"angela"` (she approved it), `"library"` (an `instant` match to an answer she approved earlier), `"coach"` (Coach Angela answered on autopilot — AI in her voice, grounded in her public record), or `null` while unanswered.
- `sources`: citations for `coach` answers (may be empty), otherwise `[]`.

### Question flow with the brain
1. **Crisis language** (the brain's crisis matcher) → `guarded`, `note` = the fixed safety message (988 etc.). Never voiced. Runs even when no Anthropic key is set.
2. Sensitive topics → `guarded` (unchanged). Approved-library match → `instant`, `answeredBy: "library"` (unchanged).
3. Otherwise `pending`. If `ANTHROPIC_API_KEY` is set, the brain runs in the background (instead of the plain drafter):
   - **autopilot answer** (server `AUTOPILOT_MODE=grounded` AND the athlete's `autopilot` setting on AND every brain gate passes) → voice rendered → `answered`, `answeredBy: "coach"`, `sources` set, fan notified ("Coach Angela answered"). If the voice render fails it falls through to review.
   - **review** → stays `pending`; the brain's reply becomes the draft (`draftSource: "coach"`) with `sources`, `confidence` and `reason` (why it needs Angela) on the StudioQuestion.
   - **decline** → `guarded` with the brain's decline text as `note`.
4. Without a key: unchanged (empty draft, Angela writes it).

### Config / settings
- `GET /v1/config` adds `"autopilot": bool` — true only when the server is in `grounded` mode and a key is configured.
- `StudioSettings` adds `"autopilot": bool` (Angela's own switch, default `false`); `PATCH /v1/studio/settings` accepts it.
- `StudioQuestion` adds `sources`, `confidence` (0–1 or null) and `reason` (string or null).

### Autopilot oversight (athlete)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/v1/studio/coach` | — | `{ "answers": [{ id, text, answer, sources, confidence, reviewed, answeredAt, fanName }] }` — Coach Angela's autopilot answers, newest first, max 50 |
| POST | `/v1/studio/questions/:id/keep` | — | `{ "ok": true }` — marks an autopilot answer reviewed |
| POST | `/v1/studio/questions/:id/retract` | — | `{ "ok": true }` — withdraws an autopilot answer: back to `pending` with the old answer as the draft; the fan's thread shows `note` "Angela is taking another look at this one." · 409 if it isn't an autopilot answer |

### Server notes (v1.1 implementation)
- **One deviation, for safety:** crisis language gets its `201` `guarded` safety reply even while the athlete is paused and past the 10/day limit (up to 20 that day), instead of 409/429. It never reaches Angela, Claude or the voice.
- **Brain results land in the background.** `POST /v1/questions` returns `pending` at once; seconds later the question is `answered` (autopilot), `guarded` (decline), or still `pending` with a coach draft in her queue. Poll `GET /v1/questions` (fan) or `GET /v1/studio/queue` (`drafting` is `true` meanwhile, and reads `false` after 2 minutes regardless).
- **Keep = approve:** a kept answer also joins the instant-answer library (the next fan asking it gets `instant`, `answeredBy: "library"`). Keep is idempotent. Retract (kept or not) removes that library entry; instant replies it already gave stay. Both 409 with `"Only Coach Angela's autopilot answers can be kept."` / `"… retracted."` for anything else (her own answers, library answers, pending or guarded questions), 404 for unknown ids.
- **After a retract** the StudioQuestion has `draftSource: "coach"`, the withdrawn answer as `draft`, the original `sources`/`confidence`, and `reason` "You retracted this autopilot answer — rewrite it or approve it." The fan's note stays until she approves (→ `answeredBy: "angela"`) or declines.
- `reason` is a display-ready line. When the brain wanted to answer but something held it back, the blockers follow ` · ` (e.g. "… · Angela has autopilot off", "… · Voice render failed", "… · Autopilot was switched off before it sent"). With no usable brain result the draft is empty (`draftSource: "none"`) and `reason` says so. Turning `autopilot` off also stops answers still in flight.
- Additive fields: `sources` items are `{ id, title, outlet, date, url }`; `/v1/studio/coach` answers also carry `audioKey` and `duration` (what went out, playable).
- A brain decline's `note` is Coach Angela's own redirect (first person); the crisis `note` is the fixed safety message. Neither is voiced.
- `revise` still uses the plain drafter: `draftSource` becomes `"claude"`; `sources`/`confidence`/`reason` keep the brain's pass.
- Browser audio: `GET /v1/audio/:key` needs the `Authorization` header, so fetch the clip and play it from a blob URL (`Range` isn't among the allowed request headers).

---

## v1.2 — Sign-in: email codes + Google (10/1/26)

Why: accounts started as a bearer token in one browser. On iPhone the Home Screen app has storage
separate from Safari (so "Add to Home Screen" meant a brand-new account), and switching phones or
clearing data lost everything. Sign-in lets a fan or athlete get back into the **same** account
anywhere. The invite code still gates **new** accounts — sign-in only links and restores.

### Config
`GET /v1/config` adds `signIn: { email: boolean, google: string | null }`.
`email` = `RESEND_API_KEY` and `EMAIL_FROM` are set; `google` = the public OAuth Web client id
(`GOOGLE_CLIENT_ID`) or `null`. Clients hide whatever is off.

### Two modes on every sign-in route (bearer token optional)
- **No token → sign in.** Find the account linked to this identity →
  `200 { token, user, athlete, identities }`.
- **Token → link** the identity to the signed-in user (fan or athlete) →
  `200 { linked: true, user, identities }`, or the empty-account switch below →
  `200 { switched: true, token, user, athlete, identities }`.

### Identities
- `email`: subject = normalized email (trimmed, lowercased; ≤ 254 chars).
- `google`: subject = the ID token's `sub`; its `email` is stored (for display and matching) only
  when `email_verified` is true.
- Unique per (provider, subject, **athlete room**): one person can have separate accounts in
  different athletes' rooms; inside a room an identity belongs to exactly one user. Max 5 per user.
- An **email code** signs into accounts linked by that email address **or** by a Google identity
  whose verified email is that address (so a Gmail user can use a code inside the iPhone Home Screen
  app, where Google's sign-in window doesn't work).
- Several matches (several rooms) → prefer the athlete account, then the newest.

### Routes
`POST /v1/auth/email/start` `{ email }` → `202 { sent: true, expiresIn: 600 }`
- Sends a 6-digit code (valid 10 min). A new code replaces older ones for that address; only the
  newest works. Codes are stored as SHA-256 hashes and bound to the mode (a link code records the
  requesting user and only that user can verify it).
- 400 "Enter a valid email address." · sign-in mode with no matching account → 404 "No Strive
  account uses this email yet. New here? Use your invite code." · 429 (per address 3 / 15 min and
  10 / day; per IP 20 / hour) "We just sent you a code — check your inbox (and spam), or try again
  in a few minutes." · global daily cap (`EMAIL_DAILY_CAP`, default 500) → 503 "Sign-in email is
  busy — try again later." · not configured → 503 "Email sign-in isn't set up yet." · provider
  failure → 502 "We couldn't send that email — try again."
- Email: From `EMAIL_FROM`, Subject "Your Strive code: 123456", plain text + minimal HTML, no
  tracking: "Your Strive sign-in code is 123456. It expires in 10 minutes. If you didn't ask for it,
  ignore this email — nobody can get in without the code."

`POST /v1/auth/email/verify` `{ email, code }` → identity flow
- 400 "That code isn't right." (counts an attempt) · 410 "That code has expired — send a new one."
  (none / expired / used / other mode or user) · 429 "Too many tries — send a new code." (5 wrong
  tries burn the code).

`POST /v1/auth/google` `{ credential }` → identity flow
- Verifies the Google ID token: RS256 against Google's JWKS (cached per Cache-Control), `aud` =
  `GOOGLE_CLIENT_ID`, `iss` ∈ {accounts.google.com, https://accounts.google.com}, `exp` (60 s skew),
  `iat` not in the future. 401 "Google sign-in didn't work — try again." · 503 "Google sign-in isn't
  set up yet." · sign-in mode with no match → 404 "No Strive account uses this Google account yet.
  New here? Use your invite code."

Identity flow, **link mode**:
- Already linked to this user → 200 `linked` (idempotent).
- Linked to **another** user in this room:
  - the current user is a fan with **no activity** (no questions, saves or listens) → **switch**:
    sign into the existing account (new token), delete the empty current account and its tokens →
    `200 { switched: true, token, user, athlete, identities }`. (This is the iPhone case: someone
    re-joins in the Home Screen app, then saves their seat with the address they used in Safari.)
  - otherwise 409 "That email already belongs to another Strive account. Sign out, then sign in
    with it." (Google: "That Google account already belongs…")
- 6th identity → 400 "That's the most sign-in methods one account can have."

`GET /v1/me` adds `identities: [{ id, provider: "email" | "google", email, createdAt }]`.
`DELETE /v1/me/identities/:id` (any role) → `200 { identities }`; 404 if it isn't the caller's.
`DELETE /v1/me` (fans) also deletes the fan's identities and any login codes for their addresses.
Per-IP `authAttempt` counting also covers verify and Google calls.

### Server config
Secrets (`npx wrangler secret put …`): `RESEND_API_KEY`, `EMAIL_FROM` (e.g.
`Strive <signin@yourdomain.com>`, a domain verified in Resend), `GOOGLE_CLIENT_ID` (public value,
kept as a secret so deploys never reset it). Optional: `EMAIL_DAILY_CAP`.
Test-only overrides `RESEND_BASE_URL` / `GOOGLE_JWKS_URL` are honoured **only** for loopback URLs.
Never log codes or full addresses.

### Server notes (v1.2 implementation)
Where the server pins down or goes beyond the contract above. Response shapes are as documented.
- **Deploy order:** apply `schema.sql` (two new tables only) before deploying the worker — `GET /v1/me` reads `identities`.
- **Optional auth:** the three sign-in routes work signed out, but a token that is sent must be valid (else the usual 401 "Your session has ended — sign in again."). So in link mode a 401 can also be Google's "Google sign-in didn't work — try again." — that one is not a session problem; tell them apart by the message.
- **Start** checks, in order: 503 off · 400 address · per-IP limit (counts every valid request, 404s included, so addresses can't be probed in bulk) · signed out: 404 · signed in with five methods already (and not this address): 400 "That's the most sign-in methods one account can have." before any email · per-address limits · daily cap. A send that fails (502) leaves no usable code and doesn't count against the address.
- **Codes:** only the newest code for an address is checked, so an older one gets 400 "That code isn't right." (and counts a try); the 5th wrong try itself answers 429. Spaces and hyphens in `code` are ignored. Verify also answers 503 while email sign-in is off.
- **Who holds an address in a room (link mode):** the user with that email identity, else the user whose Google identity has it as its verified address (the accounts an email code signs into). So saving your seat with the address of a Google account linked elsewhere switches (or 409s) instead of starting a second account; after such a switch the address is also linked to that account (if it has room). Google links and signs in by account (`sub`) only — never via an email identity with the same address.
- **One address, two accounts in one room** (an email identity on one, a Google account sharing the address on another): an email code picks the athlete account, then the email identity's account; across rooms the athlete-then-newest rule applies.
- **Google:** missing or non-string `credential` → 400 (same message); `aud` must equal `GOOGLE_CLIENT_ID`; `iat`/`nbf` get the same 60 s skew as `exp`; Google's keys unreachable (and none cached) → 502 "Google sign-in didn't work — try again.". The stored address follows the account: every Google sign-in or link refreshes it, and clears it once Google stops marking it verified.
- **Switch:** the empty account's tokens, devices, notifications and identities go with it. Athletes never switch (409).
- **Identities** are listed oldest first; an email identity's `email` is its address. `DELETE /v1/me/identities/:id` 404 → "That sign-in method isn't on your account." Removing the last one is allowed.
- **Deleting a fan** removes login codes for every address on its identities (email and verified Google). Link codes it requested for other addresses die with the user but stay until the daily cron, which deletes login codes older than 24 h, so per-address limits still hold.

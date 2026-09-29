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

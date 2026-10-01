# STRIVE

**Train with the greatest. Talk with them, too.**

Fans hear voice drops from elite athletes and ask them questions — answered back in the
athlete's voice, in words the athlete wrote or approved. Pilot athlete: Angela Ruggiero.

## The live app (`index.html` + `app/`)

The real product at **https://billyatminyawns.github.io/strive/** — mobile-first web app
(installable to the home screen), backed by Strive API v1 on Cloudflare (`worker/`, contract in
`docs/API-v1.md`). Real accounts and shared data: a fan's question reaches Angela's studio on her
phone, and her approval reaches the fan.

- **Fans** join with an invite code (share `…/strive/?invite=ANGELA` to prefill it): Home (today's
  drop, Angela's voice bio, her pinned picks), **Ask** (instant answers she already approved;
  new questions wait for her; medical/betting/legal get a polite pass), Library, You (profile,
  interests, delete account).
- **Angela** signs in with her studio key ("I'm an athlete" on the welcome screen): Today (queue,
  real stats, drafted drops to approve), **Approve** (swipe or tap; edit, dictate, preview in her
  voice), Capture (record stories that teach her Coach), Coach answers (autopilot oversight),
  Studio settings (guardrails, pause, autopilot, voice bio, pins).
- **Sign-in follows the account** (6-digit email codes everywhere, "Continue with Google" where
  Google's window can open). Fans "save their seat" right after joining, so they can get back in on
  another phone — or in the iPhone Home Screen app, which keeps storage separate from Safari. Angela
  can link Google/email in Studio settings instead of pasting her studio key. The invite code still
  gates new accounts. Turn it on with `worker/scripts/setup-signin.sh` (Google OAuth Web client ID +
  a Resend API key on a verified sending domain); the app shows only the methods that are set up.
- **Nothing reaches fans until Angela approves it** — seeded starter content waits in her queue.
  When autopilot is on (only after her written OK), Coach Angela answers grounded questions on
  its own, labelled *AI Coach* with its sources, and she can keep or retract each one.
- Plain ES modules, no build step. Local testing: run the API with
  `worker/scripts/local-up.sh`, serve the folder, and open `…/?api=http://127.0.0.1:8787/v1`
  (only loopback API overrides are accepted).

## The concept demo (`demo.html`)

The original click-through prototype (localStorage only, "Reset demo") lives on at
`demo.html` for pitches. Everything below describes it.

Two connected experiences:

- **Fan app** (iOS-style) — invite gate, today feed, athlete profile, **Ask Angela** chat
  with voice replies, lesson player, discover, membership tiers, library, profile.
- **Strive Studio** (desktop) — approval inbox, content scheduler, Voice Studio with
  guardrails, the athlete onboarding scan, audience, and earnings.

The core loop is live: a fan asks a question → known answers come back instantly in the
athlete's approved words, sensitive topics are politely declined by the guardrails, and new
questions route to the Studio inbox for approval → once approved, the voice reply lands back
in the fan's chat.

### Running the demo locally

No build step. Serve the folder with any static server and open `demo.html`:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/demo.html
```

## Tech

Plain HTML/CSS/JavaScript — no framework, no dependencies.

- **Voice**: all seeded content (drops, answers, drafts, lesson intros) plays real
  **WellSaid Studio** audio, pre-rendered with the WellSaid API (voice: Vanessa N. ·
  Conversational) and shipped in `assets/vo/`. Live-typed questions fall back to the
  browser's on-device speech synthesis.
- **Real browser APIs**: MediaRecorder (re-record voice source lines), File API + canvas
  (upload clips to the Studio library), Web Share / Clipboard (share replies), Notifications
  (voice-reply alerts), Blob downloads (audience CSV export), and shipped PDF drill sheets.
- **State**: a small localStorage-backed store; "Reset demo" restores the seed.
- **Live intelligence** (optional, `worker/`): a Cloudflare Worker gives the demo a real brain —
  **Coach Angela** (`POST /ask`, `worker/src/brain.js`). See *Coach Angela's brain* below.
  As a backup, the **Live API** panel accepts a browser-local Anthropic key (BYOK) for drafts.
  With neither, the app falls back to template drafts and on-device speech — nothing breaks.

## Coach Angela's brain

One Claude call (Opus 5, structured output) answers each new fan question as Angela, grounded
only in what she has actually said, done or approved:

- **Grounding** — `worker/persona/angela.json`: verified bio facts, cited summaries of her
  public interviews/talks/writing, topics to avoid, and a style guide. Compile it with
  `node worker/scripts/build-brain.mjs` (rejected and low-confidence entries never reach the
  prompt; quotes are capped at 15 words). Plus whatever Angela approves in her studio.
- **Routes** — *answer* (may send on its own) · *review* (draft waits in Angela's inbox, with
  the reason) · *decline* (warm redirect) · *crisis* (fixed safety message, never voiced as her).
- **Autopilot gate** — a reply sends without Angela only if the server's `AUTOPILOT_MODE`
  secret is `grounded`, Angela's own studio toggle is on, confidence ≥ 0.75, it cites a source,
  it doesn't touch medical/betting/legal, and every number and proper noun in it traces back to
  her record. Otherwise it waits for her. Angela can **Keep** (becomes an approved answer) or
  **Retract** (pulled from the fan's chat, question returns to her) anything autopilot sent.
- **Honesty** — every autopilot reply is labeled *Coach Angela · AI* with its source.
- **Tests** — `node worker/test/brain.test.mjs` (routing/gates, mock Claude, free) and
  `node worker/test/brain-eval.mjs` (18 real questions against the live worker, ~$0.25).
- **Go live** — `worker/scripts/go-live.sh` (Cloudflare login, bindings, secrets, a consent
  question that sets autopilot, deploy, prod probe, optional push).

## Note (demo)

The demo is an illustrative concept. Angela Ruggiero is shown as an example pilot athlete; all
metrics, quotes, photos, and content are placeholders for discussion only, and do not
represent a real product, partnership, or endorsement. AI voice powered by WellSaid.

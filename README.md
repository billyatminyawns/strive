# STRIVE

**Train with the greatest. Talk with them, too.**

A concept demo for a membership platform where fans train with elite athletes —
masterclass-grade lessons, daily audio drops, and questions answered back in the
athlete's real voice, generated from words the athlete wrote or approved.

Two connected experiences:

- **Fan app** (iOS-style) — invite gate, today feed, athlete profile, **Ask Angela** chat
  with voice replies, lesson player, discover, membership tiers, library, profile.
- **Strive Studio** (desktop) — approval inbox, content scheduler, Voice Studio with
  guardrails, the athlete onboarding scan, audience, and earnings.

The core loop is live: a fan asks a question → known answers come back instantly in the
athlete's approved words, sensitive topics are politely declined by the guardrails, and new
questions route to the Studio inbox for approval → once approved, the voice reply lands back
in the fan's chat.

## Running locally

No build step. Serve the folder with any static server and open it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
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
  Claude (Opus 4.8) drafts Angela's reply to brand-new questions, and WellSaid renders any
  approved novel text so even live answers come back in her real voice. As a backup, the
  **Live API** panel accepts a browser-local Anthropic key (BYOK) for drafts. With neither,
  the app falls back to template drafts and on-device speech — nothing breaks.

## Note

This is an illustrative concept. Angela Ruggiero is shown as an example pilot athlete; all
metrics, quotes, photos, and content are placeholders for discussion only, and do not
represent a real product, partnership, or endorsement. AI voice powered by WellSaid.

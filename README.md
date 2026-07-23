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

Plain HTML/CSS/JavaScript — no framework, no dependencies. Voice playback uses the browser's
on-device speech synthesis as a stand-in for the production WellSaid Studio voice. State is
kept in a small localStorage-backed store; "Reset demo" restores the seed.

## Note

This is an illustrative concept. Angela Ruggiero is shown as an example pilot athlete; all
metrics, quotes, photos, and content are placeholders for discussion only, and do not
represent a real product, partnership, or endorsement. AI voice powered by WellSaid.

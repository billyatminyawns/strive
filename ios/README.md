# Strive for iOS

Native SwiftUI app (iOS 17+, iPhone) for Strive: fans hear athlete-approved voice drops and ask questions answered in the athlete's AI voice; athletes run their studio from the same app.

- **Fan app:** Home (today's drop, voice bio, picks, suggestions) · Ask (instant approved answers, pending questions, guardrails) · Library (saved replies, all drops) · You (profile, interests, notifications, account deletion).
- **Athlete studio:** Today (queue, real stats, drafted drops to approve) · Approve (swipe deck, in-app editor with dictation and voice-note rewrites) · Capture (hold-to-talk stories and drops, on-device transcription) · Studio (guardrails, pause, voice bio, pins).
- **Backend:** Strive API v1 on the Cloudflare Worker in `../worker` — contract in `../docs/API-v1.md`.

## Run it

1. Open `Strive.xcodeproj` in Xcode 16 or newer.
2. Target **Strive** → Signing & Capabilities → pick your Team (simulator runs need no team).
3. Run on an iPhone simulator or device. Join as a fan with invite code `REVIEW` (review sandbox) or `ANGELA` (real room); athletes sign in with a studio key.

To point the app at a local API: `cd ../worker && ./scripts/local-up.sh`, then run with the environment variable `STRIVE_API_BASE=http://127.0.0.1:8787/v1/` (Scheme → Run → Arguments).

## Without Xcode

- `./scripts/typecheck.sh` — type-checks the whole app in seconds against the Mac Catalyst SDK (Command Line Tools only).
- `python3 scripts/check-xcodeproj.py` — validates the project file.
- CI (`.github/workflows/ios.yml`) builds for iOS, runs the fan + athlete UI tours against a hermetic local API, builds Release for device, and uploads the screenshots.

## Project layout

- `Strive/App` — entry point and root routing (onboarding → fan or athlete).
- `Strive/Core` — API client, session/Keychain, audio engine (background audio, lock screen), recorder + transcription, notifications/background refresh, models, theme.
- `Strive/Shared` — components, mini player, toasts.
- `Strive/Onboarding`, `Strive/Fan`, `Strive/Athlete` — screens and their stores.
- `StriveUITests` — the screenshot tour.
- `scripts/gen-xcodeproj.py` — regenerates the project file (folders are synchronized, so new Swift files never need registering).

Shipping: see `APP_STORE.md`.

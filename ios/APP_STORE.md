# Strive — App Store submission kit

Everything App Store Connect asks for, pre-written. Items marked **YOU** need a decision or an account only Billy has.

## 1. Before you can submit (only you can do these)

| # | Step | Why |
|---|---|---|
| 1 | **Install Xcode** from the Mac App Store (free, ~1 hr). | Needed to sign, archive and upload. |
| 2 | **`cd ~/Downloads/strive/worker && npx wrangler login`** (click Allow in the browser). | Cloudflare login expired; the production API can't deploy until you renew it. |
| 3 | **Apple Developer Program** — enroll at developer.apple.com ($99/yr). Decide the seller: you personally, or a company (needs a D-U-N-S number). | The seller name shows on the App Store listing. |
| 4 | **Angela's written consent** covering: her name and likeness, the three photos, the AI clone of her voice, and publishing approved content under her name. Also confirm rights to the photos themselves (they came from the design project; the photographer or USA Hockey may own them). | Apple can ask for proof you have the rights (Guideline 5.2), and it's the right thing to do. |
| 5 | **Angela approves launch content** in her studio (Today → voice bio, drafted drops; Approve → starter answers). | Nothing reaches fans until she approves it. An empty app gets rejected. |
| 6 | **Pick the support email** and the legal entity name, then have counsel skim `privacy.html` / `terms.html`. | Apple requires working support contact; the pages currently point to GitHub issues. |
| 7 | In Xcode: open `ios/Strive.xcodeproj` → target **Strive** → Signing & Capabilities → choose your **Team**. Change the bundle ID `com.minyawns.strive` if you prefer. | Signing. |
| 8 | App Store Connect → **New App** (iOS, name below, bundle ID, SKU `strive-ios`). | Creates the listing. |
| 9 | Xcode → Product → **Archive** → Distribute → App Store Connect → Upload. Test on your phone via **TestFlight** first. | Ships the build. |
| 10 | Fill the listing with section 2, attach screenshots, answer privacy (section 4), submit for review. | — |

Optional, any time: `npx wrangler secret put ANTHROPIC_API_KEY` turns on AI-drafted replies; an APNs key (developer portal → Keys) enables instant push (the app already falls back to background refresh).

## 2. Listing copy

**Name (30):** Strive: Hear From Athletes
*(“Strive” alone is taken on the App Store; the icon label on the phone still reads “Strive”. Angela called Strive a placeholder — decide the final brand before submitting.)*

**Subtitle (30):** Their words. Their voice.

**Promotional text (170):** Olympic champion Angela Ruggiero answers your questions in her own voice — every word approved by her. Invite-only for founding fans.

**Description:**
> Train with the greatest. Talk with them, too.
>
> Strive puts you in the room with elite athletes. Hear short voice drops on mindset, training and the moments that defined their careers — and ask them your own questions.
>
> EVERY WORD APPROVED
> Athletes review every reply before it's sent. What you hear is their words, spoken in their AI voice — made with their permission and labelled wherever it plays.
>
> ASK ANYTHING
> Ask about nerves, comebacks, leadership or the game. Answers the athlete has already approved come back instantly; new questions go straight to them.
>
> DAILY DROPS
> A fresh drop most mornings, plus the ones fans replay most. Save your favorite replies to your Library.
>
> FOR ATHLETES
> The athlete studio runs from a phone: swipe to approve replies, edit by typing or dictating, capture stories by holding to talk, and approve a week of drafted drops in one sitting.
>
> Strive is invite-only while the first athletes build their rooms. Enter the code an athlete shared with you to join.

**Keywords (100):** athlete,olympian,hockey,coach,mindset,training,voice,audio,sports,motivation,leadership,olympics

**Category:** Primary **Sports** · Secondary **Health & Fitness**
**Support URL:** https://billyatminyawns.github.io/strive/support.html
**Privacy Policy URL:** https://billyatminyawns.github.io/strive/privacy.html
**Marketing URL (optional):** https://billyatminyawns.github.io/strive/
**Copyright:** 2026 <seller name>

**Age rating (suggested 13+):** no violence, mature or gambling content; users can send questions to an athlete (moderated — sensitive topics auto-declined, athlete approves every reply; no public chat, no user-to-user messaging); no unrestricted web access.

## 3. App Review information

**Sign-in required:** yes. Paste into *Notes*:

> Strive is invite-only. On the welcome screen enter invite code **REVIEW** — it opens an isolated review sandbox (separate from real fans) with the athlete's approved content.
>
> Fan flow: Home plays approved voice drops. Ask → "How do I handle pre-game nerves?" returns an approved answer instantly; a new question shows "With Angela" until the athlete approves it; "Should I bet on the game?" is declined by the guardrail. You → Delete account permanently deletes the account.
>
> Athlete flow: on the welcome screen tap "I'm an athlete — sign in to my studio" and enter the studio key: **<paste the angela-review key from worker/.secrets.local.json>**. Approve (swipe or ✓), edit (typing or dictation), capture (hold the mic), and publish drops. This key only affects the review sandbox.
>
> Voice: replies and drops are synthesized with an AI model of Angela Ruggiero's voice, created with her written permission, from text she wrote or approved. Every playback is labelled "Approved by Angela · AI voice". The microphone is only used in the athlete studio when the athlete holds the record button; speech recognition transcribes those recordings on-device where supported.
>
> The app has no in-app purchases in this version; access is free for invited fans.

**Contact:** your name, phone and email.

## 4. App Privacy answers (nutrition label)

Tracking: **No.** Data collected, all *Linked to the user*, *App Functionality* only, **not** used for tracking:

| App Store category | What it is in Strive |
|---|---|
| Contact Info → Name | optional first name |
| User Content → Other User Content | questions fans send |
| User Content → Audio Data | recordings athletes choose to save |
| Identifiers → User ID | random account id |
| Identifiers → Device ID | push token (only if notifications allowed) |
| Usage Data → Product Interaction | which drops were played (listen counts) |

This matches `Strive/Resources/PrivacyInfo.xcprivacy`.

## 5. Screenshots

Required: **6.9" iPhone** (1320 × 2868). The CI tour captures exactly that size on iPhone 16 Pro Max — download the `strive-ios-tour` artifact from the latest *iOS app* run on GitHub Actions. Suggested order: 03-home, 06-ask-instant, 04-home-playing, 22-approve-deck, 20-studio-today, 25-capture.

## 6. Guideline notes (why the app is built the way it is)

- **4.2 Minimum functionality:** native SwiftUI app (not a web wrapper) with background audio, lock-screen controls, on-device transcription, notifications.
- **5.1.1(v) Account deletion:** You → Delete account (server deletes all fan data).
- **2.1 / 2.3 Completeness & accuracy:** no demo data, fake fans or invented stats in the real tenant; everything fans see is athlete-approved; stats are computed from real rows.
- **1.2 User-generated content:** fans' questions are private to the athlete; sensitive topics auto-declined; athletes approve every reply; no public posting.
- **3.1.1 In-app purchase:** v1 has no paid tiers. Selling memberships inside the iOS app later requires Apple In-App Purchase (StoreKit) — plan for it before adding prices.
- **5.2 Intellectual property:** requires Angela's documented consent (step 4 above).

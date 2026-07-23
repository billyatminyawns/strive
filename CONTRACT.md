# Strive screen-builder contract

You are implementing ONE screen module for the Strive demo webapp (dark, mint-accent athlete fan
platform). The app is plain JS — **no build step, no ES modules, no React**. Each screen is a classic
script that registers itself on `window.Screens`. Screens render **HTML strings** from shared state.

## Read these first (in this order)
1. `js/ui.js` — helpers you MUST use (`UI.esc`, `UI.arg`, `UI.fmt`, `UI.wave`, `UI.playBtn`, `UI.icon`,
   `UI.mono`, `UI.ava`, `UI.toggle`, `UI.slider`, `UI.tierBadge`)
2. `js/data.js` — seed state shape, `Data.IMG` (image paths), `Data.COURSE`, `Data.ATHLETES`, `Data.KB`
3. `js/actions.js` — the ONLY state transitions you may call (via `data-action`)
4. `js/fan/home.js` + `js/studio/overview.js` — exemplar screens; match their idiom exactly
5. `css/app.css` — tokens (CSS vars) + shared classes (`.card`, `.card2`, `.gradcard`, `.btn*`,
   `.progress`, `.wave`, `.tgl`, `.slider`, `.field-dark`, `.field-rect`, `.p-scroll`, `.k-label`,
   `.pill`, `.playbtn`, `.avatar`, `.scroll`)
6. Your mockup HTML file (given in your prompt) — this is the visual spec. Port it faithfully:
   same copy, same numbers, same spacing/font sizes/colors (inline styles are fine and expected;
   translate mockup hex values to the CSS vars where an obvious token exists).

## Module shape (copy this skeleton)
```js
/* Fan · <Name> — (mockup NN) */
(function () {
  'use strict';
  const { esc, arg, fmt, wave, playBtn, mono, ava, icon } = UI;
  window.Screens = window.Screens || {};
  Screens['fan/<name>'] = {
    tab: '<home|discover|ask|library|you>',   // fan screens only: which tab is lit
    // noTabbar: true,                        // fan screens that hide the tab bar (invite, tiers, lesson)
    // url: '<path>',                        // studio screens only: shown as studio.strive.app/<path>
    render(s, params) { return `...html...`; },
    // after(s, params) {}                   // optional post-DOM hook (scroll positions etc.)
  };
})();
```

## Rules
- **Fan screens** render INSIDE a 402×874 iPhone screen. Top content needs ~70px top padding
  (status bar overlays). Scrollable content goes in `<div class="p-scroll" style="padding:70px 18px 8px">`.
  The shell adds the tab bar automatically unless `noTabbar: true` (then render your own bottom
  spacing; the home-indicator bar overlays the bottom ~12px).
- **Studio screens** render inside `.studio-main` (already padded 26px 30px, scrollable, 1280px wide
  window minus the 216px sidebar). Do NOT render the sidebar or browser chrome — the shell does.
- Escape ALL dynamic text with `esc()`. Pass action args with `data-arg="${arg({...})}"`.
- Interactivity = `data-action="<Actions name>"` on buttons. Inputs: `data-enter-action` (Enter submits,
  value passed), `data-input-action` (fires on input). Add `data-keep="<unique-id>"` to any input the
  user types into (preserves focus across re-renders).
- Audio: anything playable uses `UI.playBtn({id}, size)` + `UI.wave(id, n, h)`. IDs that resolve:
  `drop-*` (drops), `sample`, `draft:<inboxId>`, chat message ids. Do NOT invent new playable ids
  unless you also extend nothing — stick to these.
- Never touch `Store` directly from render. Never call `Store.set` in your module scope. If you need
  a new action, define it at the bottom of your module as `window.Actions.<name> = function (a, el) {...}`
  using `Store.set(s => {...})` — but prefer existing actions.
- Numbers/copy: use the mockup's copy verbatim. Illustrative stats stay as-is.
- Images: `Data.IMG.head` (portrait), `Data.IMG.skate` (action), `Data.IMG.medals` (medals/hero),
  `Data.IMG.ciLogo` (Continuity Intelligence logo, dark logo on light chip — put on `#F4F7F5` bg chip).
- Colors: use CSS vars (`var(--mint)`, `--lav`, `--azure`, `--papaya`, `--card`, `--line2`, `--sub`,
  `--dim`, `--dim2`, `--faint`, `--ink`, `--chip-line`, `--chip-bg`). DM Sans is inherited; don't set font-family.
- No external network calls, no new dependencies, no `Date.now()` gimmicks needed.
- File must be syntactically valid standalone (wrap in IIFE, `'use strict'`).

## State you can read (Store passed as `s` to render)
`s.fan` {name, mono, color, tier, billing, memberSince, streak, interests[], savedReplies[], follows{},
listenedDrops{}, unread}; `s.lessonProgress` {l1..l6: pct}; `s.currentLesson`; `s.chat[]`; `s.chips[]`;
`s.inbox[]` {id, from, tier, avatar, color, text, ago, meta, status: draft|sent|declined, draft, similar,
similarLabel, flagged?, fromFan?, sentToAll?, editing?}; `s.inboxExtra` (+N more count); `s.drops[]`
{id, title, when, listens, completion, script}; `s.scheduled[]` {id, slot, title, sub, dur};
`s.guards` {review, topics, decline}; `s.delivery` {warmth, energy, pace}; `s.sample` {text, ready};
`s.stats`; `s.activity[]`; `s.billingAnnual`; `s.trialTier`; `s.composerOpen`.

## Actions available (call by name)
nav(hashString) · resetDemo · unlock · togglePlay({id}) · seek({delta}) · askChip({id}) ·
askSubmit(value, el) · saveReply({id}) · openReply({id}) · toggleFollow({id}) · setBilling({annual}) ·
startTrial({tier}) · toggleInterest({tag}) · surpriseMe · openLesson({id}) ·
completeChapter({lesson}) · selectInbox({id}) · setInboxFilter({f}) · toggleEditDraft({id}) ·
approve({id}) · decline({id}) · sendToAll({id}) · toggleGuard({k}) · setDelivery({k,v}) ·
sampleText(value) · genSample · scheduleDrop(a, el) · toggleComposer · reviewInbox({id})

## Definition of done
- `node --check js/<your file>` passes.
- Screen renders from seed state with zero console errors (you can sanity-check pure-render with
  `node -e` by stubbing `window`, but visual QA happens later — prioritize correct structure).
- Every button visible in the mockup does something real (navigates, toggles state, or plays audio).
- Return a 3-line report: what you built, any actions you added, anything you flagged.

/* Fan · Live AMA — the monthly All-Access room, live in Angela's real voice.
   Segments (open → a1 → a2) each play a PRE-RENDERED WellSaid clip via Player.toggle
   (resolved by exact text). A scripted live chat drips in over time, a viewer count ticks
   up, ❤️ floats hearts. One master interval; it self-kills + resets when the hash leaves. */
(function () {
  'use strict';
  const { esc, arg, fmt, wave, ava, icon } = UI;
  window.Screens = window.Screens || {};

  /* ---------- module timer + live state (all module-local, never in render scope) ---------- */
  const BASE = (window.Data && Data.AMA && Data.AMA.rsvps) || 412;   // viewers at join
  const CAP = 460;
  let timer = null;          // the ONE interval id (guarded against doubles, nulled on leave)
  let joinT0 = 0;            // performance.now() at join — chat + count clock
  let chatIdx = 0;           // scripted messages dripped so far
  let viewers = BASE;        // ticks up live; written straight to the DOM
  let lastBump = 0;          // elapsed secs at last viewer bump
  let reactions = 0;         // ❤️ count
  let session = 0;           // bumped each (re)join — invalidates stale setTimeouts

  /* ---------- scripted live chat (hockey-fan energy) — 14 msgs, 2 are the AMA questions ---------- */
  const A = (window.Data && Data.AMA) || { answers: [{}, {}] };
  const SCRIPT = [
    { t: 1.2,  who: 'Jonas ▪ Prague',   text: 'greetings from Prague!! 🇨🇿',                 kind: 'chat' },
    { t: 3.0,  who: 'Host',             text: "Angela's got her tea, we're starting with the opening. 🎙️", kind: 'host' },
    { t: 5.4,  who: 'Deke_19',          text: "LET'S GO 🔥🔥",                               kind: 'chat' },
    { t: 7.8,  who: 'Maya R.',          text: '4 years watching you, still can’t believe this is live', kind: 'chat', tier: 'All-Access' },
    { t: 10.2, who: 'Host',             text: 'Angela is picking the first question…',        kind: 'host' },
    { t: 12.6, who: A.answers[0].from,  text: A.answers[0].q,                                 kind: 'question', seg: 'a1', tier: 'All-Access' },
    { t: 15.2, who: 'Coach_T',          text: 'two-touch angling walls, noted 📝',            kind: 'chat' },
    { t: 17.6, who: 'Sofia ▪ Madrid',   text: 'her voice really is HER, this is wild',        kind: 'chat' },
    { t: 20.0, who: 'RinkRat44',        text: 'GOAT 🐐',                                      kind: 'chat' },
    { t: 22.6, who: 'Host',             text: 'Next one coming up — keep the questions coming 👀', kind: 'host' },
    { t: 25.2, who: A.answers[1].from,  text: A.answers[1].q,                                 kind: 'question', seg: 'a2', tier: 'Inner Circle' },
    { t: 28.0, who: 'Liam',             text: 'dropped a tray LOL absolute legend',           kind: 'chat' },
    { t: 30.6, who: 'Nadia ▪ Toronto',  text: 'worth every penny of All-Access 🏒',           kind: 'chat', tier: 'All-Access' },
    { t: 33.2, who: 'Host',             text: "We've got the whole hour — Angela's taking more live.", kind: 'host' },
  ];

  /* ---------- segment helpers ---------- */
  function segText(seg) {
    if (seg === 'a1') return Data.AMA.answers[0].a;
    if (seg === 'a2') return Data.AMA.answers[1].a;
    return Data.AMA.open;
  }
  function segAnswer(seg) {
    if (seg === 'a1') return Data.AMA.answers[0];
    if (seg === 'a2') return Data.AMA.answers[1];
    return null;
  }
  const anyPlaying = () => Player.isPlaying('ama-open') || Player.isPlaying('ama-a1') || Player.isPlaying('ama-a2');

  /* ---------- chat row rendering ---------- */
  function nameColor(who) {
    const pal = ['var(--azure)', 'var(--lav)', 'var(--papaya)', '#7CE2C0', '#F0B37E', '#8FB8F7', 'var(--mint)'];
    let h = 0;
    for (let i = 0; i < who.length; i++) h = (h * 31 + who.charCodeAt(i)) >>> 0;
    return pal[h % pal.length];
  }
  function tierTag(tier) {
    const mint = String(tier).toLowerCase() === 'inner circle';
    return `<span style="font-size:8px;font-weight:800;letter-spacing:0.04em;color:${mint ? 'var(--mint)' : 'var(--sub)'};
      border:1px solid ${mint ? 'var(--chip-line)' : 'var(--line2)'};border-radius:999px;padding:1px 5px;vertical-align:middle">${esc(String(tier).toUpperCase())}</span>`;
  }
  function chatRow(m) {
    if (m.kind === 'host') {
      return `<div class="popin" style="align-self:stretch;text-align:center;font-size:10.5px;color:var(--sub2);font-weight:600;line-height:1.4;padding:1px 8px">
        <span class="k-label" style="font-size:8px;color:var(--lav)">HOST</span> · ${esc(m.text)}</div>`;
    }
    if (m.kind === 'question') {
      const playing = Player.isPlaying('ama-' + m.seg);
      return `<div class="popin" style="border-left:2px solid var(--mint);background:var(--card2);border-radius:0 12px 12px 0;padding:9px 11px;display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:11.5px;font-weight:800;color:var(--mint)">${esc(m.who)}</span>
            ${m.tier ? tierTag(m.tier) : ''}
            <span style="font-size:9px;color:var(--dim2);font-weight:700">asked live</span>
          </div>
          <div style="font-size:12.5px;color:var(--txt);line-height:1.4;margin-top:3px">${esc(m.text)}</div>
        </div>
        <button class="playbtn" style="width:30px;height:30px" data-action="liveToggle" data-arg="${arg({ seg: m.seg })}" data-playbtn-for="ama-${esc(m.seg)}" aria-label="Play answer">
          ${playing ? icon.pause(9) : icon.play(10)}</button>
      </div>`;
    }
    const col = m.you ? 'var(--mint)' : nameColor(m.who);
    return `<div class="popin" style="font-size:12.5px;line-height:1.45;${m.you ? 'background:rgba(124,226,165,0.08);border-radius:8px;padding:3px 8px;margin:0 -2px;' : ''}">
      <span style="font-weight:800;color:${col}">${esc(m.who)}</span>${m.tier ? ' ' + tierTag(m.tier) : ''}<span style="color:var(--sub2)"> ${esc(m.text)}</span></div>`;
  }

  /* ---------- screen ---------- */
  Screens['fan/live'] = {
    tab: 'home',
    noTabbar: true,
    render(s) {
      const seg = s.liveSeg || 'open';
      const chat = s.liveChat || [];
      const playingCur = Player.isPlaying('ama-' + seg);
      const curA = segAnswer(seg);
      const dur = fmt(Player.estimate(segText(seg), 1));

      return `<div style="flex:1;display:flex;flex-direction:column;min-height:0;position:relative">
        <style>
          @keyframes liveFloat { 0% { transform: translateY(0) scale(0.7); opacity: 0; }
            18% { opacity: 1; } 100% { transform: translateY(-150px) scale(1.35); opacity: 0; } }
          @keyframes liveRingPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(124,226,165,0.55); }
            50% { box-shadow: 0 0 0 9px rgba(124,226,165,0); } }
          .live-heart { position: absolute; bottom: 0; font-size: 19px; pointer-events: none;
            animation: liveFloat 1.7s ease-out forwards; }
          .live-avawrap { position: relative; border-radius: 50%; flex-shrink: 0; }
          .live-avawrap.on { animation: liveRingPulse 1.4s ease-in-out infinite; }
          .live-heartlayer { position: absolute; right: 18px; bottom: 46px; width: 54px; height: 8px; pointer-events: none; }
        </style>

        <!-- top bar -->
        <div style="padding:58px 14px 12px;display:flex;align-items:center;gap:10px;flex-shrink:0;border-bottom:1px solid #1D221E">
          <button style="background:none;border:none;padding:0;display:flex" data-action="nav" data-arg="${arg('#/fan/home')}" aria-label="Back">${icon.back}</button>
          <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;min-width:0">
            <span class="pill" style="background:rgba(240,138,138,0.14);border:1px solid rgba(240,138,138,0.42);color:var(--red);padding:4px 10px;font-size:11px;font-weight:800;letter-spacing:0.05em">
              <span style="width:6px;height:6px;border-radius:50%;background:var(--red);animation:livepulse 1s infinite"></span>LIVE</span>
            <span style="font-size:14px;font-weight:800;white-space:nowrap">All-Access AMA</span>
          </div>
          <span data-live-count style="font-size:12px;font-weight:700;color:var(--sub2);white-space:nowrap">👀 ${viewers}</span>
        </div>

        <!-- stage + pinned (fixed) -->
        <div style="padding:12px 14px 4px;display:flex;flex-direction:column;gap:10px;flex-shrink:0">
          <div class="gradcard" style="padding:14px 16px;display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;align-items:center;gap:12px">
              <div class="live-avawrap${anyPlaying() ? ' on' : ''}">${ava(Data.IMG.head, 64)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:16px;font-weight:800">Angela Ruggiero</div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
                  <span style="width:6px;height:6px;border-radius:50%;background:var(--mint);animation:livepulse 1.4s infinite"></span>
                  <span style="font-size:11.5px;color:var(--sub2)">speaking live · her real voice</span>
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              <button class="playbtn" style="width:52px;height:52px;box-shadow:0 8px 24px rgba(124,226,165,0.3)"
                data-action="liveToggle" data-arg="${arg({ seg })}" data-playbtn-for="ama-${seg}" aria-label="Play current segment">
                ${playingCur ? icon.pause(16) : icon.play(18)}</button>
              <div style="flex:1;min-width:0">${wave('ama-' + seg, 22, 26)}</div>
              <span style="font-size:11px;color:var(--dim2);white-space:nowrap" data-dur-for="ama-${seg}">${dur}</span>
            </div>
          </div>

          <div class="card2" style="padding:10px 13px;display:flex;flex-direction:column;gap:3px">
            <span class="k-label" style="font-size:9px;color:var(--lav)">UP NOW</span>
            ${seg === 'open'
              ? `<div style="font-size:13px;font-weight:700">Angela's opening</div>`
              : `<div style="font-size:13px;font-weight:700;line-height:1.35">"${esc(curA.q)}"</div>
                 <div style="font-size:10.5px;color:var(--dim2);margin-top:1px">asked by ${esc(curA.from)}</div>`}
          </div>
        </div>

        <!-- live chat feed (scrolls) -->
        <div id="live-chat" class="p-scroll" style="flex:1;min-height:0;padding:10px 14px 12px;display:flex;flex-direction:column;gap:8px;border-top:1px solid #1D221E">
          ${chat.length
            ? chat.map(chatRow).join('')
            : `<div style="margin:auto;text-align:center;color:var(--dim);font-size:11.5px;line-height:1.7">The room is filling up…<br>Angela is about to start.</div>`}
        </div>

        <!-- reaction bar -->
        <div style="position:relative;flex-shrink:0;border-top:1px solid #1D221E;padding:10px 14px 6px;display:flex;align-items:center;gap:9px">
          <div class="live-heartlayer"></div>
          <input class="field-dark" style="flex:1;min-width:0" placeholder="Say something…" data-keep="live-say"
            data-enter-action="liveSay" id="live-say" autocomplete="off">
          <button class="playbtn" style="width:38px;height:38px" data-action="liveSend" aria-label="Send">${icon.send}</button>
          <button data-action="liveReact" aria-label="React with a heart"
            style="display:flex;align-items:center;gap:5px;background:none;border:1px solid var(--line2);border-radius:999px;padding:8px 12px;font-size:14px;line-height:1">
            ❤️<span data-react-count style="font-size:12px;font-weight:800;color:var(--sub2)">${reactions}</span></button>
        </div>

        <div style="font-size:9.5px;color:var(--dim);text-align:center;line-height:1.45;padding:4px 22px 14px;flex-shrink:0">
          Live answers are generated with WellSaid from what Angela says — every fan hears her, not a bot.</div>
      </div>`;
    },

    after(s) {
      // first paint of a fresh visit → join (clears feed, resets clocks, starts the show)
      if (s.liveJoined !== true) { window.Actions.liveJoin(); return; }
      ensureTimer();
      const sc = document.getElementById('live-chat');
      if (sc) sc.scrollTop = sc.scrollHeight;
    },
  };

  /* ---------- timer machinery ---------- */
  function resetProgress() {
    chatIdx = 0; viewers = BASE; lastBump = 0; reactions = 0; joinT0 = performance.now();
  }
  function ensureTimer() {
    if (timer) return;                 // guard: never run two intervals
    timer = setInterval(tick, 500);
  }
  function leave() {
    if (timer) { clearInterval(timer); timer = null; }
    session++;                          // invalidate any pending host-reply timeouts
    resetProgress();
    // reset persisted flags silently (we're off-screen) so re-joining restarts the show
    if (window.Store) Store.silent(s => { s.liveJoined = false; s.liveChat = []; s.liveSeg = 'open'; });
  }
  function tick() {
    if (location.hash !== '#/fan/live') { leave(); return; }
    const elapsed = (performance.now() - joinT0) / 1000;

    // viewer count ticks up live — written straight to the DOM, no re-render
    if (elapsed - lastBump >= 4 && viewers < CAP) {
      viewers = Math.min(CAP, viewers + 1 + Math.floor(Math.random() * 3));
      lastBump = elapsed;
      const el = document.querySelector('[data-live-count]');
      if (el) el.textContent = '👀 ' + viewers;
    }

    // drip any scripted messages now due
    const due = [];
    while (chatIdx < SCRIPT.length && SCRIPT[chatIdx].t <= elapsed) { due.push({ ...SCRIPT[chatIdx] }); chatIdx++; }
    if (due.length) Store.set(s => { s.liveChat = (s.liveChat || []).concat(due); });
  }

  /* ---------- module actions ---------- */
  window.Actions.liveJoin = function () {
    resetProgress();
    session++;
    Store.set(s => { s.liveJoined = true; s.liveChat = []; s.liveSeg = s.liveSeg || 'open'; });
  };

  // play/pause a segment (from the stage or a chat question) and make it the current segment
  window.Actions.liveToggle = function (a) {
    const seg = (a && a.seg) || 'open';
    if (Store.get().liveSeg !== seg) Store.silent(s => { s.liveSeg = seg; });
    Player.toggle({ id: 'ama-' + seg, text: segText(seg), title: 'Live AMA — Angela' });
  };

  // fan says something → appears in the feed, host acknowledges 3s later
  window.Actions.liveSay = function (value, el) {
    const text = String(value || '').trim();
    if (!text) return;
    if (el) el.value = '';
    Store.set(s => { s.liveChat = (s.liveChat || []).concat([{ who: 'Marcus (you)', text, kind: 'chat', you: true }]); });
    const g = session;
    setTimeout(() => {
      if (g !== session || location.hash !== '#/fan/live') return;   // stale / left the room
      Store.set(s => { s.liveChat = (s.liveChat || []).concat([{ who: 'Host', text: 'Queued for Angela 👍', kind: 'host' }]); });
    }, 3000);
  };
  window.Actions.liveSend = function () {
    const el = document.getElementById('live-say');
    if (el) window.Actions.liveSay(el.value, el);
  };

  // ❤️ — bump the counter and float three hearts up
  window.Actions.liveReact = function () {
    reactions++;
    const c = document.querySelector('[data-react-count]');
    if (c) c.textContent = reactions;
    const layer = document.querySelector('.live-heartlayer');
    if (!layer) return;
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('span');
      h.className = 'live-heart';
      h.textContent = '❤️';
      h.style.left = (2 + i * 12 + Math.random() * 8) + 'px';
      h.style.animationDelay = (i * 0.11).toFixed(2) + 's';
      layer.appendChild(h);
      setTimeout(() => { try { h.remove(); } catch (e) {} }, 2000 + i * 130);
    }
  };
})();

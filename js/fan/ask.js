/* Fan · Ask Angela — chat (mockup 03 + walkthrough ChatScreen). The heart of the demo loop. */
(function () {
  'use strict';
  const { esc, arg, fmt, wave, playBtn, mono, ava, icon } = UI;

  window.Screens = window.Screens || {};

  function voiceBubble(m) {
    const dur = Player.estimate(m.text, 1);
    return `<div class="bubble-v popin">
      <div style="display:flex;align-items:center;gap:7px">
        ${ava(Data.IMG.head, 20)}
        <span class="k-label" style="font-size:10.5px;color:var(--dim2)">VOICE REPLY · <span data-dur-for="${m.id}">${fmt(dur)}</span></span>
        <span style="flex:1"></span>
        <button data-action="openReply" data-arg="${arg({ id: m.id })}" title="Open full player"
          style="background:none;border:none;padding:2px;color:var(--dim);display:flex">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M7 1h4v4M11 1L6.5 5.5M5 11H1V7M1 11l4.5-4.5" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>
        </button>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${playBtn({ id: m.id }, 34)}
        <div style="flex:1">${wave(m.id, 16, 20, null, 3.5)}</div>
      </div>
      <div style="font-size:12px;color:var(--sub2);line-height:1.55">${esc(m.text)}</div>
    </div>`;
  }

  Screens['fan/ask'] = {
    tab: 'ask',
    render(s) {
      const chips = s.chips.map(id => Data.KB.find(k => k.id === id)).filter(Boolean);
      return `
        <div style="padding:66px 18px 12px;border-bottom:1px solid #1D221E;display:flex;align-items:center;gap:12px;flex-shrink:0">
          <button style="background:none;border:none;padding:0;display:flex" data-action="nav" data-arg="${arg('#/fan/home')}">${icon.back}</button>
          ${ava(Data.IMG.head, 38)}
          <div style="flex:1">
            <div style="font-size:15.5px;font-weight:800">Angela Ruggiero</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:1px">
              <span style="width:6px;height:6px;border-radius:50%;background:var(--mint);animation:livepulse 2s infinite"></span>
              <span style="font-size:11px;color:var(--sub2)">Answers in her real voice</span>
            </div>
          </div>
        </div>
        <div style="text-align:center;font-size:10.5px;color:var(--dim);padding:10px 30px 0;line-height:1.5;flex-shrink:0">
          Angela's AI voice · every answer is written or approved by her</div>

        <div class="p-scroll" id="chat-scroll" style="padding:14px 18px;display:flex;flex-direction:column;gap:12px">
          ${s.chat.map(m => {
            if (m.kind === 'q') return `<div class="bubble-q">${esc(m.text)}</div>`;
            if (m.kind === 'sys') return `<div class="bubble-sys">${esc(m.text)}</div>`;
            if (m.kind === 'typing') return `<div style="align-self:flex-start;display:flex;align-items:center;gap:8px;background:var(--card2);border:1px solid var(--line2);border-radius:18px;padding:10px 14px">
              ${[0, 1, 2].map(i => `<span style="width:7px;height:7px;border-radius:50%;background:var(--mint);animation:typing 1.1s ease ${i * 0.18}s infinite"></span>`).join('')}
              <span style="font-size:11px;color:var(--dim);font-weight:700">Angela · voice reply</span></div>`;
            if (m.kind === 'voice') return voiceBubble(m);
            return '';
          }).join('')}
          ${chips.length ? `<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;margin-top:4px">
            ${chips.map(c => `<button data-action="askChip" data-arg="${arg({ id: c.id })}"
              style="background:none;border:1px solid var(--chip-line);color:var(--mint);border-radius:999px;padding:9px 14px;font-size:12.5px;font-weight:700">${esc(c.q)}</button>`).join('')}
          </div>` : ''}
        </div>

        <div style="padding:10px 16px 14px;border-top:1px solid #1D221E;display:flex;align-items:center;gap:10px;flex-shrink:0">
          <input class="field-dark" style="flex:1;min-width:0" placeholder="Ask Angela…" data-keep="ask-input"
            data-enter-action="askSubmit" id="ask-input">
          <button class="playbtn" style="width:38px;height:38px" data-action="askSend">${icon.send}</button>
        </div>`;
    },
    after() {
      const sc = document.getElementById('chat-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    },
  };

  // send button reads the input's value
  window.Actions.askSend = function () {
    const el = document.getElementById('ask-input');
    if (el) Actions.askSubmit(el.value, el);
  };

  /* Fan · Voice reply moment — full-screen player (mockup 04 + walkthrough VoiceScreen) */
  Screens['fan/reply'] = {
    tab: 'ask', noTabbar: true,
    render(s, params) {
      const id = params[0];
      const m = s.chat.find(x => x.id === id) || s.chat.filter(x => x.kind === 'voice').slice(-1)[0];
      if (!m) return `<div style="padding:120px 30px;text-align:center;color:var(--sub)">No reply yet — ask Angela something first.</div>`;
      const dur = Player.estimate(m.text, 1);
      const saved = s.fan.savedReplies.includes(m.id);
      const playing = Player.isPlaying(m.id);
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:84px 26px 40px;background:radial-gradient(120% 70% at 50% 0%,#182019 0%,#0F1110 60%);overflow-y:auto">
        <div style="width:100%;display:flex;justify-content:flex-start">
          <button style="background:none;border:none;padding:0;display:flex" data-action="nav" data-arg="${arg('#/fan/ask')}">${UI.icon.back}</button>
        </div>
        <div class="k-label" style="font-size:10.5px;letter-spacing:0.2em;color:var(--mint)">YOUR ANSWER FROM ANGELA</div>
        <img src="${Data.IMG.head}" alt="" style="width:150px;height:150px;border-radius:50%;object-fit:cover;object-position:50% 18%;margin-top:22px">
        <div style="font-size:19px;font-weight:800;margin-top:16px">Angela Ruggiero</div>
        <div style="font-size:11px;color:var(--dim2);margin-top:3px">Her voice · generated from her written answer</div>
        ${m.q ? `<div class="card2" style="border-radius:14px;padding:12px 16px;margin-top:20px;font-size:12.5px;color:var(--sub2);line-height:1.5">"${esc(m.q)}" — you, ${esc(m.when || 'today')}</div>` : ''}
        <div style="margin-top:26px;width:100%;display:flex;justify-content:center">${wave(m.id, 26, 52, null, 4.5)}</div>
        <div style="display:flex;justify-content:space-between;width:100%;font-size:10.5px;color:var(--dim);margin-top:8px">
          <span data-time-for="${m.id}">${playing ? fmt(Player.state.t) : '0:00'}</span><span data-dur-for="${m.id}">${fmt(dur)}</span></div>
        <div style="display:flex;align-items:center;gap:26px;margin-top:18px">
          <button data-action="seek" data-arg="${arg({ delta: -15 })}"
            style="width:40px;height:40px;border-radius:50%;background:none;border:1px solid #2A2F2B;color:var(--sub2);font-size:10px;font-weight:800">−15</button>
          <button class="playbtn" style="width:64px;height:64px;box-shadow:0 10px 30px rgba(124,226,165,0.3)"
            data-action="togglePlay" data-arg="${arg({ id: m.id })}" data-playbtn-for="${m.id}">
            ${playing ? UI.icon.pause(17) : UI.icon.play(20)}</button>
          <button data-action="seek" data-arg="${arg({ delta: 15 })}"
            style="width:40px;height:40px;border-radius:50%;background:none;border:1px solid #2A2F2B;color:var(--sub2);font-size:10px;font-weight:800">+15</button>
        </div>
        <div style="font-size:12px;color:var(--dim2);line-height:1.6;margin-top:22px">"${esc(m.text.length > 140 ? m.text.slice(0, 140) + '…' : m.text)}"</div>
        <div style="display:flex;gap:8px;margin-top:auto;padding-top:20px">
          <button data-action="saveReply" data-arg="${arg({ id: m.id })}"
            style="background:none;border:1px solid ${saved ? 'var(--chip-line)' : '#2A2F2B'};color:${saved ? 'var(--mint)' : '#D7DDD8'};border-radius:999px;padding:9px 16px;font-size:12px;font-weight:700">${saved ? 'Saved ✓' : 'Save'}</button>
          <button data-action="toast" data-arg="${arg({ msg: 'Sharing isn’t wired in this concept demo.' })}" style="background:none;border:1px solid #2A2F2B;color:#D7DDD8;border-radius:999px;padding:9px 16px;font-size:12px;font-weight:700">Share</button>
          <button data-action="nav" data-arg="${arg('#/fan/ask')}"
            style="background:none;border:1px solid var(--chip-line);color:var(--mint);border-radius:999px;padding:9px 16px;font-size:12px;font-weight:700">Ask follow-up</button>
        </div>
      </div>`;
    },
  };
})();

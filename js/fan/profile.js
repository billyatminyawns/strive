/* Fan · Athlete profile — hero + subscribe + Lessons/Drops/Ask tabs (mockup 02) */
(function () {
  'use strict';
  const { esc, arg, fmt, wave, playBtn, icon } = UI;

  window.Screens = window.Screens || {};

  const pill = t => `<span style="font-size:10.5px;font-weight:700;color:#D7DDD8;background:rgba(20,23,21,0.85);border:1px solid #2A2F2B;border-radius:999px;padding:4px 9px">${esc(t)}</span>`;

  function lessonRow(l, s) {
    const pct = s.lessonProgress[l.id] || 0;
    const watched = pct === 100;
    const current = !watched && l.id === s.currentLesson;
    const status = watched ? ' · Watched' : (current ? ' · Up next' : '');
    return `<button class="card2" style="border-radius:14px;padding:10px;display:flex;gap:12px;align-items:center;text-align:left;color:var(--txt);width:100%"
      data-action="openLesson" data-arg="${arg({ id: l.id })}">
      <img src="${Data.IMG.skate}" alt="" style="width:92px;height:58px;border-radius:9px;object-fit:cover;object-position:50% 25%;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:700">${esc(l.n)} · ${esc(l.title)}</div>
        <div style="font-size:11.5px;color:var(--dim2);margin-top:2px">${l.min} min${status}</div>
      </div>
      ${current ? `<div style="width:30px;height:30px;border-radius:50%;background:var(--mint);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon.play(10)}</div>` : ''}
    </button>`;
  }

  function lessonsTab(s) {
    return `<div style="display:flex;flex-direction:column;gap:10px">
      <div class="k-label" style="font-size:10.5px;color:var(--dim2)">MASTERCLASS · ${esc(Data.COURSE.title.toUpperCase())}</div>
      ${Data.COURSE.lessons.map(l => lessonRow(l, s)).join('')}
    </div>`;
  }

  function dropsTab(s) {
    return `<div style="display:flex;flex-direction:column;gap:10px">
      ${s.drops.map(d => `
        <div class="card2" style="border-radius:14px;padding:12px;display:flex;align-items:center;gap:12px">
          ${playBtn({ id: d.id }, 34)}
          <div style="flex:1;min-width:0">
            <div style="font-size:13.5px;font-weight:700">${esc(d.title)}</div>
            <div style="font-size:11.5px;color:var(--dim2)">${esc(d.when)} · <span data-dur-for="${d.id}">${fmt(Player.estimate(d.script, 1))}</span></div>
          </div>
          ${wave(d.id, 10, 16, '#3C463E')}
        </div>`).join('')}
    </div>`;
  }

  function askTab() {
    return `<div class="gradcard" style="border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:10px">
      <div style="font-size:16px;font-weight:800">Ask Angela anything</div>
      <div style="font-size:12.5px;color:var(--sub2);line-height:1.55">She answers in her own voice. Every reply is written or approved by Angela before it reaches you.</div>
      <button style="align-self:flex-start;background:var(--mint);color:var(--ink);border:none;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:800"
        data-action="nav" data-arg="${arg('#/fan/ask')}">Ask a question</button>
    </div>`;
  }

  Screens['fan/profile'] = {
    tab: 'discover',   // profile is reached from Discover; keep that tab lit
    render(s) {
      const tab = s.profileTab || 'lessons';
      const tabs = [
        { t: 'lessons', label: 'Lessons' },
        { t: 'drops', label: 'Drops' },
        { t: 'ask', label: 'Ask Angela' },
      ];

      return `<div class="p-scroll">

        <div style="position:relative;height:320px;flex-shrink:0">
          <img src="${Data.IMG.medals}" alt="" style="width:100%;height:320px;object-fit:cover;display:block">
          <div style="position:absolute;left:0;right:0;top:0;height:96px;background:linear-gradient(180deg,rgba(11,12,11,0.6) 0%,rgba(11,12,11,0) 100%);pointer-events:none"></div>
          <div style="position:absolute;left:0;right:0;bottom:0;height:65%;background:linear-gradient(180deg,rgba(15,17,16,0) 0%,rgba(15,17,16,0.92) 82%);pointer-events:none"></div>
          <button style="position:absolute;top:58px;left:14px;width:32px;height:32px;border-radius:50%;background:rgba(11,12,11,0.55);border:none;display:flex;align-items:center;justify-content:center"
            data-action="nav" data-arg="${arg('#/fan/discover')}" aria-label="Back">${icon.back}</button>
          <div style="position:absolute;left:18px;right:18px;bottom:14px;pointer-events:none">
            <div class="k-label" style="font-size:10.5px;letter-spacing:0.18em;color:var(--mint)">HOCKEY · DEFENSE</div>
            <div style="font-size:26px;font-weight:900;letter-spacing:0.01em;margin-top:4px">ANGELA RUGGIERO</div>
            <div style="font-size:12.5px;color:#B9C0BA;margin-top:2px">Olympic gold medalist · Hockey Hall of Fame '15</div>
            <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
              ${pill('4× Olympian')}${pill('256 games · Team USA')}${pill('IOC member')}
            </div>
          </div>
        </div>

        <div style="padding:14px 18px 10px;display:flex;flex-direction:column;gap:12px">

          <div style="display:flex;align-items:center;gap:12px">
            <button style="flex:1;background:var(--mint);color:var(--ink);border:none;border-radius:12px;padding:13px 0;font-size:14.5px;font-weight:800"
              data-action="nav" data-arg="${arg('#/fan/tiers')}">Subscribe · from $9.99/mo</button>
            <div style="font-size:11px;color:var(--dim2);width:78px;line-height:1.4">12,480 members</div>
          </div>

          <div style="display:flex;gap:22px;border-bottom:1px solid #1D221E">
            ${tabs.map(t => `<button data-action="profileTab" data-arg="${arg({ t: t.t })}"
              style="background:none;border:none;padding:10px 2px 11px;font-size:13.5px;font-weight:700;color:${tab === t.t ? 'var(--txt)' : 'var(--dim2)'};border-bottom:2px solid ${tab === t.t ? 'var(--mint)' : 'transparent'}">${esc(t.label)}</button>`).join('')}
          </div>

          ${tab === 'drops' ? dropsTab(s) : tab === 'ask' ? askTab() : lessonsTab(s)}

        </div>
      </div>`;
    },
  };

  // local tab state — no new global seed key needed
  window.Actions.profileTab = function (a) {
    Store.set(s => { s.profileTab = a.t; });
  };
})();

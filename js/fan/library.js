/* Fan · Library — saved replies, drops, masterclass, drill sheets (no mockup; system-matched) */
(function () {
  'use strict';
  const { esc, arg, fmt, wave, playBtn, ava } = UI;

  window.Screens = window.Screens || {};

  const dlIcon = `<svg width="15" height="15" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M7 1.5v7M4 5.7L7 8.7l3-3" stroke="var(--dim2)" stroke-width="1.6" fill="none"/>
    <path d="M2 10.5V12h10v-1.5" stroke="var(--dim2)" stroke-width="1.6" fill="none"/></svg>`;

  const SHEETS = [
    { name: 'Gap control drill sheet', file: 'assets/sheets/gap-control-drill-sheet.pdf' },
    { name: 'Small-rink defending', file: 'assets/sheets/small-rink-defending.pdf' },
    { name: 'Tryout prep checklist', file: 'assets/sheets/tryout-prep-checklist.pdf' },
  ];

  function savedCard(m) {
    const dur = Player.estimate(m.text, 1);
    return `<div class="card2" style="border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:9px">
      <div style="display:flex;align-items:center;gap:8px">
        ${ava(Data.IMG.head, 20)}
        <div style="flex:1;min-width:0;font-size:12px;color:var(--sub2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">"${esc(m.q || m.text)}"</div>
        <button data-action="openReply" data-arg="${arg({ id: m.id })}" title="Open full player"
          style="background:none;border:none;padding:2px;color:var(--dim);display:flex;flex-shrink:0">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M7 1h4v4M11 1L6.5 5.5M5 11H1V7M1 11l4.5-4.5" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>
        </button>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${playBtn({ id: m.id }, 34)}
        <div style="flex:1">${wave(m.id, 16, 20, null, 3.5)}</div>
        <span style="font-size:11px;color:var(--dim2);flex-shrink:0" data-dur-for="${esc(m.id)}">${fmt(dur)}</span>
      </div>
    </div>`;
  }

  function dropRow(s, d) {
    const listened = !!s.fan.listenedDrops[d.id];
    return `<div class="card2" style="border-radius:14px;padding:12px;display:flex;align-items:center;gap:12px">
      <button class="playbtn" style="width:34px;height:34px;background:#242A25" data-action="togglePlay" data-arg="${arg({ id: d.id })}" data-playbtn-for="${esc(d.id)}">
        ${Player.isPlaying(d.id) ? UI.icon.pause(10) : UI.icon.playMint(11)}</button>
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:700">${esc(d.title)}</div>
        <div style="font-size:11.5px;color:var(--dim2)">${esc(d.when)} · <span data-dur-for="${esc(d.id)}">${fmt(Player.estimate(d.script, 1))}</span> · ${d.listens.toLocaleString('en-US')} listens</div>
      </div>
      ${listened
        ? `<span style="font-size:11px;font-weight:800;color:var(--mint);flex-shrink:0">Played ✓</span>`
        : wave(d.id, 10, 16, '#3C463E')}
    </div>`;
  }

  Screens['fan/library'] = {
    tab: 'library',
    render(s) {
      const saved = (s.fan.savedReplies || [])
        .map(id => s.chat.find(m => m.kind === 'voice' && m.id === id))
        .filter(Boolean);

      const lessons = Data.COURSE.lessons;
      const pct = Math.round(lessons.reduce((t, l) => t + (s.lessonProgress[l.id] || 0), 0) / lessons.length);
      const cur = lessons.find(l => l.id === s.currentLesson) || lessons[0];

      return `<div class="p-scroll" style="padding:70px 18px 8px">
        <div style="display:flex;flex-direction:column;gap:16px">

          <div style="font-size:22px;font-weight:800">Library</div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <div style="font-size:13px;font-weight:800;color:#B9C0BA">Saved replies</div>
              ${saved.length ? `<span style="font-size:11px;color:var(--dim2)">${saved.length} saved</span>` : ''}
            </div>
            ${saved.length
              ? saved.map(savedCard).join('')
              : `<div class="card2" style="border-radius:14px;padding:18px 16px;font-size:12.5px;color:var(--dim2);text-align:center">Replies you save land here.</div>`}
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="font-size:13px;font-weight:800;color:#B9C0BA">Drops</div>
            ${s.drops.map(d => dropRow(s, d)).join('')}
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <div style="font-size:13px;font-weight:800;color:#B9C0BA">Masterclass</div>
              <span style="font-size:10.5px;color:var(--dim2)">class 1 of 3 · where Angela goes deepest</span>
            </div>
            <div class="gradcard" style="padding:16px;display:flex;flex-direction:column;gap:12px">
              <div style="display:flex;align-items:center;gap:12px">
                <img src="${Data.IMG.skate}" alt="" style="width:76px;height:50px;border-radius:10px;object-fit:cover;object-position:50% 25%;flex-shrink:0">
                <div style="flex:1;min-width:0">
                  <div class="k-label" style="font-size:10px;color:var(--dim2)">${esc(Data.COURSE.sub.toUpperCase())}</div>
                  <div style="font-size:16px;font-weight:800;margin-top:2px">${esc(Data.COURSE.title)}</div>
                </div>
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--dim2);margin-bottom:6px">
                  <span>${pct}% complete</span>
                  <span>Lesson ${esc(cur.n.replace(/^0/, ''))} · ${esc(cur.title)}</span>
                </div>
                <div class="progress"><div style="width:${pct}%"></div></div>
              </div>
              <button class="btn btn-mint" style="align-self:flex-start;padding:9px 16px;font-size:12px"
                data-action="openLesson" data-arg="${arg({ id: cur.id })}">Continue</button>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;padding-bottom:10px">
            <div style="font-size:13px;font-weight:800;color:#B9C0BA">Drill sheets</div>
            <div class="card2" style="border-radius:14px;padding:2px 14px">
              ${SHEETS.map((sh, i) => {
                const got = !!(s.sheetsGot && s.sheetsGot[sh.name]);
                return `
                <a href="${esc(sh.file)}" download data-action="libSheetGot" data-arg="${arg({ name: sh.name })}"
                  style="display:flex;align-items:center;gap:12px;padding:13px 0;text-decoration:none;color:var(--txt);${i < SHEETS.length - 1 ? 'border-bottom:1px solid #1D221E' : ''}">
                  <div style="flex:1;min-width:0;font-size:13.5px;font-weight:700">${esc(sh.name)}</div>
                  ${got
                    ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:800;letter-spacing:0.08em;color:var(--mint);border:1px solid var(--chip-line);border-radius:999px;padding:2px 8px;flex-shrink:0">${UI.icon.check('var(--mint)', 10)}PDF</span>`
                    : `<span style="font-size:9.5px;font-weight:800;letter-spacing:0.08em;color:var(--sub);border:1px solid var(--line2);border-radius:999px;padding:2px 7px;flex-shrink:0">PDF</span>`}
                  ${dlIcon}
                </a>`;
              }).join('')}
            </div>
          </div>

        </div>
      </div>`;
    },
  };

  /* module actions */

  // Drill-sheet row click: the <a download> starts the native PDF download; we flash a toast and
  // mark the sheet as downloaded so the row keeps a mint check. Defer the state write (which
  // re-renders and would detach the anchor) to the next tick so the browser's download fires first.
  window.Actions.libSheetGot = function (a) {
    const name = a && a.name;
    if (!name) return;
    App.toast('Downloaded ✓');
    setTimeout(() => {
      Store.set(s => { s.sheetsGot = s.sheetsGot || {}; s.sheetsGot[name] = true; });
    }, 0);
  };
})();

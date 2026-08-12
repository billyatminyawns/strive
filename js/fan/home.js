/* Fan · Home — today feed (mockup 01 + walkthrough FeedScreen) */
(function () {
  'use strict';
  const { esc, arg, fmt, wave, playBtn, mono, ava } = UI;

  window.Screens = window.Screens || {};

  Screens['fan/home'] = {
    tab: 'home',
    render(s) {
      const drop = s.drops[0];
      const dropDur = Player.estimate(drop.script, 1);
      const lesson = Data.COURSE.lessons.find(l => l.id === s.currentLesson) || Data.COURSE.lessons[3];
      const prog = s.lessonProgress[lesson.id] || 0;
      const minLeft = Math.max(1, Math.round(lesson.min * (1 - prog / 100)));
      const playingDrop = Player.isPlaying(drop.id);
      const editing = !!s.editingInterests;
      const hasUnread = (s.fan.notifs || []).some(n => !n.read);

      return `<div class="p-scroll" style="padding:70px 18px 8px">
        <div style="display:flex;flex-direction:column;gap:16px">

          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:22px;font-weight:800">Good morning, ${esc(s.fan.name)}</div>
              <div style="font-size:12px;color:var(--dim2);margin-top:2px">Wednesday, July 22</div>
            </div>
            <div style="display:flex;align-items:center;gap:14px">
              <button style="background:none;border:none;padding:0;position:relative;display:flex;color:var(--dim2)" data-action="nav" data-arg="${arg('#/fan/notifs')}" aria-label="Notifications">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3a4 4 0 00-4 4c0 3.6-1.4 4.7-1.4 4.7h10.8S14 10.6 14 7a4 4 0 00-4-4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.4 14.6a1.6 1.6 0 003.2 0" stroke="currentColor" stroke-width="1.5"/></svg>
                ${hasUnread ? `<span style="position:absolute;top:-1px;right:-1px;width:8px;height:8px;border-radius:50%;background:var(--mint);border:2px solid var(--screen)"></span>` : ''}
              </button>
              <button style="background:none;border:none;padding:0" data-action="nav" data-arg="${arg('#/fan/you')}">${mono(s.fan.mono, 36, s.fan.color)}</button>
            </div>
          </div>

          <div class="gradcard" style="padding:18px;display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span class="k-label" style="font-size:10.5px;color:var(--mint)">TODAY'S DROP</span>
              <span style="font-size:11px;color:var(--dim2)" data-dur-for="${drop.id}">${fmt(dropDur)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              ${ava(Data.IMG.head, 40)}
              <div>
                <div style="font-size:16px;font-weight:700">${esc(drop.title)}</div>
                <div style="font-size:12px;color:var(--dim2)">Angela Ruggiero</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              ${playBtn({ id: drop.id }, 44, 15)}
              <div style="flex:1">${wave(drop.id, 22, 24)}</div>
            </div>
            <div class="progress"><div data-prog-for="${drop.id}" style="width:${playingDrop ? Math.min(100, Player.state.t / Player.state.dur * 100) : (s.fan.listenedDrops[drop.id] ? 100 : 0)}%"></div></div>
          </div>

          <div class="card" style="border:1px solid rgba(240,138,138,0.35);padding:13px 14px;display:flex;align-items:center;gap:12px">
            <div style="flex:1;min-width:0">
              <span class="pill" style="font-size:9.5px;font-weight:900;letter-spacing:0.08em;color:var(--red);border:1px solid rgba(240,138,138,0.4);padding:3px 8px">
                <span style="width:6px;height:6px;border-radius:50%;background:var(--red);animation:livepulse 1s infinite"></span>LIVE</span>
              <div style="font-size:14px;font-weight:800;margin-top:7px">${esc(Data.AMA.title)}</div>
              <div style="font-size:11.5px;color:var(--dim2);margin-top:2px">Tonight 7:00 PM · ${esc(Data.AMA.rsvps)} going</div>
            </div>
            <button class="btn btn-mint" style="flex-shrink:0" data-action="nav" data-arg="${arg('#/fan/live')}">Join</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="font-size:13px;font-weight:800;color:#B9C0BA">Continue training</div>
            <button class="card2" style="padding:12px;display:flex;gap:12px;align-items:center;text-align:left;color:var(--txt);width:100%"
              data-action="openLesson" data-arg="${arg({ id: lesson.id })}">
              <img src="${Data.IMG.skate}" alt="" style="width:76px;height:50px;border-radius:10px;object-fit:cover;object-position:50% 25%;flex-shrink:0">
              <div style="flex:1;min-width:0">
                <div class="k-label" style="font-size:10px;color:var(--dim2)">${esc(Data.COURSE.title.toUpperCase())}</div>
                <div style="font-size:14px;font-weight:700;margin-top:2px">Lesson ${lesson.n.replace(/^0/, '')} · ${esc(lesson.title)}</div>
                <div class="progress" style="height:3px;margin-top:8px"><div style="width:${prog}%"></div></div>
              </div>
              <span style="font-size:11px;color:var(--dim2);flex-shrink:0">${minLeft} min left</span>
            </button>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <div style="font-size:13px;font-weight:800;color:#B9C0BA">Your interests</div>
              <button data-action="homeEditInterests" style="background:none;border:none;padding:0;font-size:11px;font-weight:700;color:var(--mint)">${editing ? 'Done' : 'Edit'}</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:7px">
              ${s.fan.interests.map(t => editing
                ? `<button data-action="toggleInterest" data-arg="${arg({ tag: t })}"
                    style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#D7DDD8;border:1px solid var(--chip-line);background:var(--chip-bg);border-radius:999px;padding:7px 13px">${esc(t)}<span style="color:var(--dim2);font-weight:800">✕</span></button>`
                : `<span style="font-size:12px;font-weight:700;color:#D7DDD8;border:1px solid var(--chip-line);background:var(--chip-bg);border-radius:999px;padding:7px 13px">${esc(t)}</span>`).join('')}
              ${editing
                ? `<button data-action="homeAddInterest" style="font-size:12px;font-weight:800;color:var(--mint);background:none;border:1px dashed var(--chip-line);border-radius:999px;padding:7px 13px">+ Add</button>`
                : `<button data-action="surpriseMe" style="font-size:12px;font-weight:800;color:var(--ink);background:var(--mint);border:none;border-radius:999px;padding:7px 13px">Surprise me</button>`}
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;padding-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <div style="font-size:13px;font-weight:800;color:#B9C0BA">Suggested for you</div>
              <span style="font-size:10.5px;color:var(--dim2)">things you didn't know to ask</span>
            </div>
            ${s.drops.slice(1)
              .slice().sort((a, b) => (s.fan.listenedDrops[a.id] ? 1 : 0) - (s.fan.listenedDrops[b.id] ? 1 : 0))
              .map(d => `
              <div class="card2" style="border-radius:14px;padding:12px;display:flex;align-items:center;gap:12px">
                <div style="width:34px;height:34px;border-radius:50%;background:#242A25;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <button class="playbtn" style="width:34px;height:34px;background:#242A25" data-action="togglePlay" data-arg="${arg({ id: d.id })}" data-playbtn-for="${d.id}">
                    ${Player.isPlaying(d.id) ? UI.icon.pause(10) : UI.icon.playMint(11)}</button>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13.5px;font-weight:700">${esc(d.title)}</div>
                  <div style="font-size:11.5px;color:var(--dim2)">${d.why && !s.fan.listenedDrops[d.id] ? `<span style="color:var(--mint);font-weight:700">${esc(d.why)}</span>` : esc(d.when)} · <span data-dur-for="${d.id}">${fmt(Player.estimate(d.script, 1))}</span>${s.fan.listenedDrops[d.id] ? ' · Played ✓' : ''}</div>
                </div>
                ${wave(d.id, 10, 16, '#3C463E')}
              </div>`).join('')}
          </div>

        </div>
      </div>`;
    },
  };

  // toggle the interests edit mode (chips become removable, "+ Add" appears)
  window.Actions.homeEditInterests = function () {
    Store.set(s => { s.editingInterests = !s.editingInterests; });
  };

  // "+ Add" chip: add the first suggestion not already present
  window.Actions.homeAddInterest = function () {
    const pool = Data.INTEREST_POOL;
    const s = Store.get();
    const next = pool.find(p => !s.fan.interests.includes(p));
    if (!next) { Actions.toast({ msg: 'That’s the whole suggestions pool — nice.' }); return; }
    Store.set(st => { st.fan.interests.push(next); });
  };
})();

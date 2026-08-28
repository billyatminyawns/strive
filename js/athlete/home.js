/* Athlete · Today — Angela's pocket-studio dashboard (mobile) */
(function () {
  'use strict';
  const { esc, arg, ava, mono, icon, tierBadge } = UI;

  window.Screens = window.Screens || {};

  // small right-chevron for tappable rows
  const chev = `<svg width="7" height="12" viewBox="0 0 8 14" style="flex-shrink:0"><path d="M1 1l5.5 6L1 13" stroke="#5C635D" stroke-width="1.8" fill="none"/></svg>`;

  // compact lav-bordered stat tile (studio side signals with --lav)
  function statTile(val, label, delta) {
    return `<div class="card2" style="border-left:2px solid var(--lav);padding:12px 13px">
      <div style="font-size:20px;font-weight:900;line-height:1">${esc(val)}</div>
      <div class="k-label" style="font-size:10px;letter-spacing:0.12em;color:var(--sub);margin-top:5px">${esc(label)}</div>
      <div style="font-size:10.5px;color:var(--dim2);margin-top:3px">${esc(delta)}</div>
    </div>`;
  }

  /* drafted-drop decisions — approve schedules it (voice pre-rendered), redraft sends it back */
  window.Actions.athDropApprove = function (a) {
    const d = (Store.get().draftDrops || []).find(x => x.id === a.id);
    if (!d) return;
    if (window.Api) Api.ensureVoice(d.script);
    Store.set(s => {
      s.draftDrops = s.draftDrops.filter(x => x.id !== a.id);
      s.scheduled.push({ id: 'sch-' + a.id, slot: 'NEXT OPEN 7:00 AM', title: d.title, sub: d.source + ' · approved from your phone', dur: UI.fmt(Player.estimate(d.script, 1)) });
    });
    Actions.toast({ msg: 'Approved — scheduled in your voice ✓' });
  };
  window.Actions.athDropPass = function (a) {
    Store.set(s => { s.draftDrops = s.draftDrops.filter(x => x.id !== a.id); });
    Actions.toast({ msg: 'Sent back — your Coach will take another angle.' });
  };

  Screens['athlete/home'] = {
    tab: 'home',
    render(s) {
      const waiting = s.inbox.filter(q => q.status === 'draft').length;
      const drafts = s.inbox.filter(q => q.status === 'draft').slice(0, 2);
      const next = s.scheduled[0];

      return `<div class="p-scroll" style="padding:70px 18px 8px">
        <div style="display:flex;flex-direction:column;gap:16px">

          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:22px;font-weight:800">Good morning, Angela</div>
              <div style="font-size:12px;color:var(--dim2);margin-top:2px">Wednesday, July 22 · game day in Boston</div>
            </div>
            <button style="background:none;border:none;padding:0" data-action="nav" data-arg="${arg('#/athlete/profile')}" aria-label="Your profile">${ava(Data.IMG.head, 38)}</button>
          </div>

          ${waiting > 0
            ? `<div class="gradcard" style="padding:20px;display:flex;flex-direction:column;gap:14px">
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <span class="k-label" style="font-size:10.5px;color:var(--lav)">YOUR QUEUE</span>
                  ${s.inboxExtra ? `<span style="font-size:11px;color:var(--dim2)">+${s.inboxExtra} more waiting</span>` : ''}
                </div>
                <div style="display:flex;align-items:flex-end;gap:12px">
                  <div style="font-size:46px;font-weight:900;line-height:0.85">${waiting}</div>
                  <div style="font-size:14.5px;color:#C9D0CA;font-weight:600;line-height:1.3;padding-bottom:4px">replies waiting<br>for your voice</div>
                </div>
                <button class="btn btn-mint" style="width:100%;padding:13px" data-action="nav" data-arg="${arg('#/athlete/approve')}">Approve queue →</button>
              </div>`
            : `<div class="gradcard" style="padding:20px;display:flex;flex-direction:column;gap:8px">
                <span class="k-label" style="font-size:10.5px;color:var(--lav)">YOUR QUEUE</span>
                <div style="font-size:24px;font-weight:800">Queue clear ✓</div>
                <div style="font-size:13px;color:var(--dim2)">Nothing needs you right now.</div>
              </div>`}

          <div class="card" style="border-color:rgba(240,138,138,0.35);padding:15px 16px;display:flex;align-items:center;gap:12px">
            <div style="flex:1;min-width:0">
              <span class="pill" style="font-size:10px;font-weight:900;letter-spacing:0.08em;color:var(--red);background:rgba(240,138,138,0.12);padding:3px 8px">
                <span style="width:6px;height:6px;border-radius:50%;background:var(--red)"></span>LIVE</span>
              <div style="font-size:13.5px;font-weight:800;margin-top:8px">All-Access AMA · 7:00 PM</div>
              <div style="font-size:11.5px;color:var(--dim2);margin-top:3px">${esc(Data.AMA.rsvps)} RSVPs · your open + 2 answers are prepped</div>
            </div>
            <button class="btn btn-mint-line" style="flex-shrink:0;font-size:12px;padding:10px 14px;white-space:nowrap" data-action="nav" data-arg="${arg('#/fan/live')}">Preview room</button>
          </div>

          <!-- fan-engagement metrics only up front; revenue lives on You + Studio (small numbers demotivate) -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${statTile(s.stats.members.toLocaleString(), 'MEMBERS', s.stats.membersDelta)}
            ${statTile(s.stats.answered, 'ANSWERED', s.stats.answeredNote)}
            ${statTile(s.stats.listen, 'AVG LISTEN', s.stats.listenDelta)}
            ${statTile(s.stats.reply, 'MEDIAN REPLY', s.stats.replyNote)}
          </div>

          ${(s.draftDrops || []).length ? `<div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <span class="k-label" style="font-size:10px;color:var(--lav)">DRAFTED FOR YOU</span>
              <span style="font-size:10.5px;color:var(--dim2)">approve in one sitting — you never have to create</span>
            </div>
            ${s.draftDrops.map(d => `
              <div class="card2" style="padding:12px 13px;display:flex;flex-direction:column;gap:9px">
                <div style="display:flex;align-items:center;gap:10px">
                  ${UI.playBtn({ id: d.id }, 32)}
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.title)}</div>
                    <div style="font-size:10.5px;color:var(--dim2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.source)}</div>
                  </div>
                  <span style="font-size:10.5px;color:var(--dim2);flex-shrink:0" data-dur-for="${d.id}">${UI.fmt(Player.estimate(d.script, 1))}</span>
                </div>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-mint" style="flex:1;padding:9px 0;font-size:12px" data-action="athDropApprove" data-arg="${arg({ id: d.id })}">Approve → schedule</button>
                  <button class="btn btn-ghost" style="padding:9px 14px;font-size:12px" data-action="athDropPass" data-arg="${arg({ id: d.id })}">Redraft</button>
                </div>
              </div>`).join('')}
          </div>` : ''}

          ${next ? `<div style="display:flex;flex-direction:column;gap:8px">
            <span class="k-label" style="font-size:10px;color:var(--lav)">SCHEDULE</span>
            <div class="card2" style="padding:13px 14px;display:flex;align-items:center;gap:12px">
              <span style="font-size:10px;font-weight:900;letter-spacing:0.06em;color:var(--azure);background:rgba(126,179,247,0.12);border-radius:8px;padding:6px 9px;flex-shrink:0">${esc(next.slot)}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(next.title)}</div>
                <div style="font-size:11.5px;color:var(--dim2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(next.sub)}</div>
              </div>
              <span style="font-size:11px;color:var(--faint);flex-shrink:0">${esc(next.dur)}</span>
            </div>
          </div>` : ''}

          <button class="btn btn-ghost" style="display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap;font-size:12px;padding:11px 8px" data-action="nav" data-arg="${arg('#/athlete/capture')}">
            ${icon.mic('#D7DDD8', 14)} Capture — teach your Coach something new</button>

          ${drafts.length ? `<div style="display:flex;flex-direction:column;gap:10px">
            <div style="font-size:13px;font-weight:800;color:#B9C0BA">Latest from fans</div>
            ${drafts.map(q => `
              <button class="card2" style="padding:12px;display:flex;align-items:center;gap:11px;text-align:left;color:var(--txt);width:100%"
                data-action="nav" data-arg="${arg('#/athlete/approve')}">
                ${mono(q.avatar, 34, q.color)}
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:7px">
                    <span style="font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(q.from)}</span>
                    ${tierBadge(q.tier)}
                  </div>
                  <div style="font-size:12px;color:var(--dim2);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(q.text)}</div>
                </div>
                ${chev}
              </button>`).join('')}
          </div>` : ''}

          ${s.activity.length ? `<div class="card2" style="padding:14px;display:flex;flex-direction:column;gap:8px;margin-bottom:6px">
            <div style="font-size:12px;font-weight:800;color:#B9C0BA">Just now</div>
            ${s.activity.slice(0, 3).map(a => `<div style="font-size:11.5px;color:var(--sub);line-height:1.45"><span style="color:var(--dim)">${esc(a.t)}</span> · ${esc(a.text)}</div>`).join('')}
          </div>` : ''}

        </div>
      </div>`;
    },
  };
})();

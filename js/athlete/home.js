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

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${statTile(s.stats.members.toLocaleString(), 'MEMBERS', s.stats.membersDelta)}
            ${statTile(s.stats.revenue, 'REVENUE', s.stats.revenueDelta)}
            ${statTile(s.stats.answered, 'ANSWERED', s.stats.answeredNote)}
            ${statTile(s.stats.listen, 'AVG LISTEN', s.stats.listenDelta)}
          </div>

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

          <div style="display:flex;gap:10px">
            <button class="btn btn-ghost" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap;font-size:12px;padding:11px 8px" data-action="nav" data-arg="${arg('#/athlete/capture')}">
              ${icon.mic('#D7DDD8', 14)} Capture a story</button>
            <button class="btn btn-mint-line" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap;font-size:12px;padding:11px 8px" data-action="nav" data-arg="${arg('#/athlete/capture/drop')}">
              <span style="width:9px;height:9px;border-radius:50%;background:var(--mint);flex-shrink:0"></span> Record today's drop</button>
          </div>

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

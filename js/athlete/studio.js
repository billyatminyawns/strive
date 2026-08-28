/* Athlete · Studio — on-the-go management: guardrails, schedule, drops, voice model (pocket mirror of Voice Studio) */
(function () {
  'use strict';
  const { esc, arg, wave, ava, toggle } = UI;

  window.Screens = window.Screens || {};

  // lav kicker above each card — signals the "studio side" (desktop uses lav accents on stats)
  function kicker(text) {
    return `<div class="k-label" style="font-size:10px;color:var(--lav)">${esc(text)}</div>`;
  }

  // guardrail row — same shape as desktop studio/voice.js guardRow (title + sub + toggle → toggleGuard)
  function guardRow(title, sub, key, on, last) {
    return `<div style="display:flex;align-items:center;gap:12px;${last ? '' : 'border-bottom:1px solid #1D221E;padding-bottom:13px'}">
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:700">${esc(title)}</div>
        <div style="font-size:11px;color:var(--faint);margin-top:2px">${esc(sub)}</div>
      </div>
      ${toggle(on, 'toggleGuard', { k: key })}
    </div>`;
  }

  // pin/unpin a drop to the public profile ("Angela's picks")
  window.Actions.athPinDrop = function (a) {
    let nowPinned = false;
    Store.set(s => {
      const d = s.drops.find(x => x.id === a.id);
      if (d) { d.pinned = !d.pinned; nowPinned = d.pinned; }
    });
    Actions.toast({ msg: nowPinned ? 'Pinned to your public profile ✓' : 'Unpinned.' });
  };

  Screens['athlete/studio'] = {
    tab: 'studio',
    render(s) {
      return `<div class="p-scroll" style="padding:70px 18px 8px">
        <div style="display:flex;flex-direction:column;gap:16px">

          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:23px;font-weight:800">Studio</div>
            <span class="pill" style="font-size:10.5px;font-weight:800;color:var(--mint);border:1px solid var(--chip-line);padding:4px 10px">
              <span style="width:6px;height:6px;border-radius:50%;background:var(--mint);animation:livepulse 2s infinite"></span>LIVE</span>
          </div>

          <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px">
            <div>
              ${kicker('GUARDRAILS')}
              <div style="font-size:11.5px;color:var(--dim2);margin-top:4px;line-height:1.5">Your Coach never says anything you haven't written or approved.</div>
            </div>
            ${guardRow('Approve every reply before it sends', 'Required for personal replies', 'review', s.guards.review)}
            ${guardRow('Stick to approved topics', 'Hockey · leadership · career · training', 'topics', s.guards.topics)}
            ${guardRow('Auto-decline sensitive asks', 'Medical, betting & legal questions get a polite pass', 'decline', s.guards.decline, true)}
          </div>

          <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
            ${kicker('SCHEDULED')}
            ${s.scheduled.map((r, i) => `
              <div style="display:flex;align-items:center;gap:12px;${i < s.scheduled.length - 1 ? 'border-bottom:1px solid #1D221E;padding-bottom:12px' : ''}">
                <span style="font-size:9.5px;font-weight:900;letter-spacing:0.05em;color:var(--azure);background:rgba(126,179,247,0.12);border-radius:8px;padding:6px 8px;flex-shrink:0">${esc(r.slot)}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12.5px;font-weight:700">${esc(r.title)}</div>
                  <div style="font-size:11px;color:var(--dim2);margin-top:2px">${esc(r.sub)}</div>
                </div>
                <span style="font-size:11px;color:var(--faint);flex-shrink:0">${esc(r.dur)}</span>
              </div>`).join('')}
          </div>

          <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:13px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              ${kicker('YOUR CONTENT · BY PERFORMANCE')}
              <span style="font-size:10px;color:var(--dim2)">pin your best to your profile</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${s.drops.slice().sort((a, b) => b.listens - a.listens).slice(0, 3).map(d => `
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;gap:10px">
                    <span style="font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.title)}</span>
                    <span style="color:var(--dim2);flex-shrink:0;font-size:11.5px">${d.listens.toLocaleString('en-US')} listens</span>
                    <button data-action="athPinDrop" data-arg="${arg({ id: d.id })}" aria-label="${d.pinned ? 'Unpin from profile' : 'Pin to profile'}"
                      style="flex-shrink:0;background:${d.pinned ? 'var(--chip-bg)' : 'none'};border:1px solid ${d.pinned ? 'var(--chip-line)' : 'var(--line2)'};
                        color:${d.pinned ? 'var(--mint)' : 'var(--dim2)'};border-radius:999px;padding:4px 10px;font-size:10px;font-weight:800">${d.pinned ? 'PINNED ✓' : 'PIN'}</button>
                  </div>
                  <div class="progress" style="margin-top:6px"><div style="width:${d.completion}%"></div></div>
                </div>`).join('')}
            </div>
          </div>

          <div class="gradcard" style="padding:16px;display:flex;flex-direction:column;gap:12px">
            ${kicker('YOUR COACH · VOICE MODEL')}
            <div style="display:flex;align-items:center;gap:11px">
              ${ava(Data.IMG.head, 38)}
              <div style="flex:1;min-width:0">
                <div style="font-size:15px;font-weight:800">Coach Angela</div>
                <div style="font-size:10.5px;color:var(--dim2);margin-top:1px">your digital twin — fans hear you, trained by you</div>
              </div>
              <span style="font-size:9px;letter-spacing:0.08em;font-weight:800;color:var(--mint);border:1px solid var(--chip-line);border-radius:999px;padding:4px 8px;flex-shrink:0">VOICE BY WELLSAID</span>
            </div>
            <div>${wave(null, 34, 26, '#3C463E', 4)}</div>
            <div style="font-size:11.5px;color:var(--sub);line-height:1.5">Source lines & pronunciation live in the full studio.</div>
            <div style="border-top:1px solid #273029;padding-top:11px;font-size:10.5px;color:var(--faint);line-height:1.5">Every clip watermarked · revoke any time — it's yours.</div>
          </div>

          <div style="display:flex;justify-content:center;padding:2px 0 12px">
            <button class="btn-quiet" style="padding:6px 0;font-size:12.5px;color:var(--dim2)" data-action="nav" data-arg="${arg('#/studio/overview')}">Open full studio on desktop →</button>
          </div>

        </div>
      </div>`;
    },
  };
})();

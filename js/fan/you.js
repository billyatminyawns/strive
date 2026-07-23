/* Fan · You — profile, membership, invite & settings (no mockup — system match) */
(function () {
  'use strict';
  const { esc, arg, mono, tierBadge } = UI;

  window.Screens = window.Screens || {};

  const chevron = `<svg width="7" height="12" viewBox="0 0 8 14" style="transform:scaleX(-1);flex-shrink:0"><path d="M7 1L1.5 7 7 13" stroke="#5C635D" stroke-width="1.8" fill="none"/></svg>`;

  function statTile(val, label) {
    return `<div class="card2" style="flex:1;padding:14px 10px;display:flex;flex-direction:column;align-items:center;gap:3px">
      <div style="font-size:22px;font-weight:900">${esc(val)}</div>
      <div style="font-size:10px;color:var(--dim2);font-weight:700;letter-spacing:0.06em;text-transform:uppercase;text-align:center">${esc(label)}</div>
    </div>`;
  }

  function settingRow(label, last) {
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 2px;${last ? '' : 'border-bottom:1px solid #1D221E'}">
      <span style="font-size:13.5px;font-weight:600;color:#D7DDD8">${esc(label)}</span>
      ${chevron}
    </div>`;
  }

  Screens['fan/you'] = {
    tab: 'you',
    render(s) {
      const dropsPlayed = Object.keys(s.fan.listenedDrops).filter(k => s.fan.listenedDrops[k]).length;
      const repliesSaved = s.fan.savedReplies.length;
      const lessonsDone = Object.values(s.lessonProgress).filter(v => v === 100).length;

      return `<div class="p-scroll" style="padding:70px 18px 8px">
        <div style="display:flex;flex-direction:column;gap:16px">

          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding-top:6px;text-align:center">
            ${mono(s.fan.mono, 64, s.fan.color)}
            <div style="font-size:20px;font-weight:800;margin-top:2px">${esc(s.fan.name)} Thompson</div>
            <div style="font-size:12px;color:var(--dim2)">${esc(s.fan.tier)} · member since ${esc(s.fan.memberSince)}</div>
            <span class="pill" style="font-size:11.5px;color:var(--papaya);border:1px solid var(--chip-line);background:var(--chip-bg);padding:6px 12px">🔥 ${esc(s.fan.streak)}-day listening streak</span>
          </div>

          <div class="gradcard" style="padding:18px;display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span class="k-label" style="font-size:10.5px;color:var(--mint)">MEMBERSHIP</span>
              ${tierBadge(s.fan.tier)}
            </div>
            <div>
              <div style="font-size:17px;font-weight:800">${esc(s.fan.tier)}</div>
              <div style="font-size:12px;color:var(--dim2);margin-top:3px">Billed ${esc(s.fan.billing)} · next billing Aug 22</div>
            </div>
            <button class="btn btn-ghost" style="align-self:flex-start;padding:9px 15px;font-size:12px" data-action="nav" data-arg="${arg('#/fan/tiers')}">Manage membership</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="font-size:13px;font-weight:800;color:#B9C0BA">Your interests</div>
            <div style="display:flex;flex-wrap:wrap;gap:7px">
              ${s.fan.interests.map(t => `<button data-action="toggleInterest" data-arg="${arg({ tag: t })}"
                style="font-size:12px;font-weight:700;color:#D7DDD8;border:1px solid var(--chip-line);background:var(--chip-bg);border-radius:999px;padding:7px 13px">${esc(t)}</button>`).join('')}
              <button data-action="surpriseMe" style="font-size:12px;font-weight:800;color:var(--ink);background:var(--mint);border:none;border-radius:999px;padding:7px 13px">Surprise me</button>
            </div>
          </div>

          <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">
            <div style="font-size:14px;font-weight:800">Share Strive</div>
            <div style="font-size:12px;color:var(--sub);line-height:1.5">Give a friend their first month of All-Access on us.</div>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;border:1.5px dashed var(--chip-line);border-radius:12px;padding:11px 14px;text-align:center;font-size:15px;font-weight:900;letter-spacing:0.22em;color:var(--mint)">MARCUS3</div>
              ${s.inviteCopied
                ? `<button class="btn btn-mint-line" style="padding:11px 15px;font-size:12px;flex-shrink:0">Copied ✓</button>`
                : `<button class="btn btn-mint" style="padding:11px 15px;font-size:12px;flex-shrink:0" data-action="copyInvite">Copy</button>`}
            </div>
          </div>

          <div style="display:flex;gap:10px">
            ${statTile(dropsPlayed, 'Drops played')}
            ${statTile(repliesSaved, 'Replies saved')}
            ${statTile(lessonsDone, 'Lessons done')}
          </div>

          <div class="card" style="padding:4px 16px">
            ${settingRow('Notifications')}
            ${settingRow('Downloads')}
            ${settingRow('Restore purchases')}
            ${settingRow('Sign out', true)}
          </div>

          <div style="font-size:10px;color:var(--faint);text-align:center;padding:2px 0 10px">Strive concept demo · all content illustrative</div>

        </div>
      </div>`;
    },
  };

  // Copy invite code → clipboard, flash "Copied ✓"
  window.Actions.copyInvite = function () {
    try { navigator.clipboard.writeText('MARCUS3'); } catch (e) {}
    Store.set(s => { s.inviteCopied = true; });
    setTimeout(() => Store.set(s => { s.inviteCopied = false; }), 1500);
  };
})();

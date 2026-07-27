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

  // right-pointing caret that rotates to point down when its section is open
  function chev(open) {
    return `<svg width="12" height="12" viewBox="0 0 8 14" style="transform:rotate(${open ? '90deg' : '0deg'});transition:transform .18s;flex-shrink:0"><path d="M1.5 1L7 7 1.5 13" stroke="#5C635D" stroke-width="1.8" fill="none"/></svg>`;
  }

  // deterministic, plausible offline file size for a drop
  function sizeFor(d) {
    return Math.max(0.4, String(d.script || '').length / 340).toFixed(1) + ' MB';
  }

  // header of an expandable settings section (chevron rotates when open)
  function secHeader(label, section, open, right) {
    return `<div data-action="youSection" data-arg="${arg({ s: section })}"
      style="display:flex;align-items:center;justify-content:space-between;padding:13px 2px;cursor:pointer">
      <span style="font-size:13.5px;font-weight:600;color:#D7DDD8">${esc(label)}</span>
      <span style="display:flex;align-items:center;gap:9px">${right || ''}${chev(open)}</span>
    </div>`;
  }

  // static (non-expanding) tappable settings row with the plain right chevron
  function tapRow(action, opts) {
    opts = opts || {};
    return `<div data-action="${esc(action)}" style="display:flex;align-items:center;justify-content:space-between;padding:13px 2px;cursor:pointer">
      <span style="font-size:13.5px;font-weight:600;color:${opts.color || '#D7DDD8'}">${esc(opts.label)}</span>
      ${opts.right != null ? opts.right : chevron}
    </div>`;
  }

  // one toggle row inside the Notifications accordion
  function notifToggleRow(label, on, k) {
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 2px">
      <span style="font-size:12.5px;color:#AEB5AF">${esc(label)}</span>
      ${UI.toggle(on, 'youToggleNotif', { k })}
    </div>`;
  }

  Screens['fan/you'] = {
    tab: 'you',
    render(s) {
      const dropsPlayed = Object.keys(s.fan.listenedDrops).filter(k => s.fan.listenedDrops[k]).length;
      const repliesSaved = s.fan.savedReplies.length;
      const lessonsDone = Object.values(s.lessonProgress).filter(v => v === 100).length;

      const settings = (s.fan && s.fan.settings) || {};
      const downloads = (s.fan && s.fan.downloads) || {};
      const notifOpen = s.youOpen === 'notif';
      const dlOpen = s.youOpen === 'downloads';
      const signArmed = !!s.youSignoutArm;
      const dlCount = Object.keys(downloads).filter(k => downloads[k]).length;

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

          <div class="card" style="padding:0 16px">

            <div style="border-bottom:1px solid #1D221E">
              ${secHeader('Notifications', 'notif', notifOpen)}
              ${notifOpen ? `<div style="padding:0 0 10px">
                ${notifToggleRow('Daily drop reminder', !!settings.dropReminder, 'dropReminder')}
                ${notifToggleRow('Voice reply alerts', !!settings.replyAlerts, 'replyAlerts')}
              </div>` : ''}
            </div>

            <div style="border-bottom:1px solid #1D221E">
              ${secHeader('Downloads', 'downloads', dlOpen, dlCount ? `<span style="font-size:11px;color:var(--dim2)">${dlCount} offline</span>` : '')}
              ${dlOpen ? `<div style="padding:2px 0 12px;display:flex;flex-direction:column;gap:9px">
                ${s.drops.map(d => {
                  const got = !!downloads[d.id];
                  return `<div style="display:flex;align-items:center;gap:10px">
                    <div style="flex:1;min-width:0">
                      <div style="font-size:12.5px;font-weight:600;color:#D7DDD8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.title)}</div>
                      <div style="font-size:10.5px;color:var(--dim2);margin-top:1px">${esc(d.when)} · ${esc(sizeFor(d))}</div>
                    </div>
                    ${got
                      ? `<div style="flex-shrink:0;font-size:11px;color:var(--mint);font-weight:700;white-space:nowrap">Downloaded ✓ · <button data-action="youDl" data-arg="${arg({ id: d.id, remove: true })}" style="font-size:11px;font-weight:700;color:var(--dim2);background:none;border:none;padding:0;cursor:pointer">Remove</button></div>`
                      : `<button class="btn btn-ghost" style="padding:7px 13px;font-size:11.5px;flex-shrink:0" data-action="youDl" data-arg="${arg({ id: d.id })}">Download</button>`}
                  </div>`;
                }).join('')}
              </div>` : ''}
            </div>

            <div style="border-bottom:1px solid #1D221E">
              ${tapRow('youRestore', { label: 'Restore purchases' })}
            </div>

            <div>
              ${tapRow('youSignout', signArmed
                ? { label: 'Sign out — sure?', color: 'var(--papaya)', right: `<span style="font-size:11px;color:var(--papaya);font-weight:700">Tap again</span>` }
                : { label: 'Sign out' })}
            </div>

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

  // Settings: open/close an accordion section (only one open at a time)
  window.Actions.youSection = function (a) {
    const sec = a && a.s;
    Store.set(s => { s.youOpen = s.youOpen === sec ? null : sec; });
  };

  // Settings: notification toggles. Turning "Voice reply alerts" ON asks the OS
  // for permission; denied → stay off + toast, granted → fire a sample notification.
  window.Actions.youToggleNotif = function (a) {
    const k = a && a.k;
    if (!k) return;
    const st = Store.get();
    const cur = (st.fan && st.fan.settings) || {};
    const turningOn = !cur[k];

    if (k === 'replyAlerts' && turningOn) {
      if (typeof Notification === 'undefined') { App.toast('Notifications aren’t supported here'); return; }
      const grant = () => {
        Store.set(s => { s.fan.settings = s.fan.settings || {}; s.fan.settings.replyAlerts = true; });
        try { new Notification('STRIVE', { body: 'Voice reply alerts are on — you\'ll hear when Angela answers.' }); } catch (e) {}
      };
      const deny = () => {
        App.toast('Allow notifications in your browser to get alerts');
        Store.set(s => { s.fan.settings = s.fan.settings || {}; s.fan.settings.replyAlerts = false; });
      };
      try {
        const r = Notification.requestPermission();
        if (r && typeof r.then === 'function') r.then(p => (p === 'granted' ? grant() : deny())).catch(deny);
        else ((typeof r === 'string' ? r : Notification.permission) === 'granted' ? grant() : deny());
      } catch (e) { deny(); }
      return;
    }

    Store.set(s => { s.fan.settings = s.fan.settings || {}; s.fan.settings[k] = !s.fan.settings[k]; });
  };

  // Settings: mark a drop available offline (instant) or remove it
  window.Actions.youDl = function (a) {
    const id = a && a.id;
    if (!id) return;
    Store.set(s => {
      s.fan.downloads = s.fan.downloads || {};
      if (a.remove) delete s.fan.downloads[id];
      else s.fan.downloads[id] = true;
    });
  };

  // Settings: fake App Store restore — two sequential toasts
  window.Actions.youRestore = function () {
    App.toast('Checking App Store…');
    setTimeout(() => {
      if (!window.Store || !Store.get()) return;   // demo may have been reset away
      App.toast('All-Access restored ✓');
    }, 1200);
  };

  // Settings: two-step sign out → clear session and drop back to the invite gate
  window.Actions.youSignout = function () {
    if (!Store.get().youSignoutArm) {
      Store.set(s => { s.youSignoutArm = true; });
      setTimeout(() => {
        if (window.Store && Store.get() && Store.get().youSignoutArm) Store.set(s => { s.youSignoutArm = false; });
      }, 3000);
      return;
    }
    if (window.Player && Player.state.playing) Player.stop();
    Store.set(s => {
      s.unlocked = false;
      s.youSignoutArm = false;
      if (s.fan) s.fan.unread = 0;
    });
    location.hash = '#/fan/home';
  };
})();

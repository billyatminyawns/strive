/* Fan · Notifications — notification center (system match) */
(function () {
  'use strict';
  const { esc, arg, icon } = UI;

  window.Screens = window.Screens || {};

  Screens['fan/notifs'] = {
    tab: 'home',
    render(s) {
      const notifs = (s.fan && s.fan.notifs) || [];

      const list = notifs.length
        ? notifs.map(n => {
            const unread = !n.read;
            return `<button class="card2" data-action="fanNotifTap" data-arg="${arg({ id: n.id })}"
              style="width:100%;text-align:left;padding:13px 14px;display:flex;align-items:flex-start;gap:11px;color:var(--txt);${unread ? 'background:var(--chip-bg);' : ''}">
              <span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:5px;background:${unread ? 'var(--mint)' : 'transparent'}"></span>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;line-height:1.35">${esc(n.text)}</div>
                <div style="font-size:11.5px;color:var(--sub2);line-height:1.4;margin-top:3px">${esc(n.sub)}</div>
              </div>
              <span style="flex-shrink:0;font-size:10.5px;color:var(--faint);white-space:nowrap;text-align:right;margin-top:1px">${esc(n.when)}</span>
            </button>`;
          }).join('')
        : `<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:80px 0;font-size:14px;font-weight:600;color:var(--dim2)">All caught up.</div>`;

      return `<div class="p-scroll" style="padding:70px 18px 8px">
        <div style="display:flex;flex-direction:column;gap:14px">

          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
            <button data-action="nav" data-arg="${arg('#/fan/home')}" aria-label="Back"
              style="background:none;border:none;padding:0;display:flex;align-items:center;justify-content:center;width:24px;height:24px;flex-shrink:0">${icon.back}</button>
            <div style="font-size:17px;font-weight:800">Notifications</div>
            <button class="btn-quiet" data-action="fanNotifsReadAll"
              style="font-size:12px;font-weight:700;padding:0">Mark all read</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:9px">
            ${list}
          </div>

        </div>
      </div>`;
    },
  };

  // tap a notification: mark THAT notif read, then navigate to its target
  window.Actions.fanNotifTap = function (a) {
    const s = Store.get();
    const n = ((s.fan && s.fan.notifs) || []).find(x => x.id === a.id);
    const to = (n && n.to) || '#/fan/home';
    Store.set(st => {
      const item = ((st.fan && st.fan.notifs) || []).find(x => x.id === a.id);
      if (item) item.read = true;
    });
    location.hash = to;
  };

  // mark every notification read (stays on this screen)
  window.Actions.fanNotifsReadAll = function () {
    Store.set(s => {
      ((s.fan && s.fan.notifs) || []).forEach(n => { n.read = true; });
    });
  };
})();

/* Fan · Discover — featured athlete + trending follows (mockup 08) */
(function () {
  'use strict';
  const { esc, arg, mono, icon } = UI;

  window.Screens = window.Screens || {};

  const SPORTS = ['All', 'Hockey', 'Tennis', 'Track', 'Soccer'];
  const BROWSE = [
    { sport: 'Hockey', count: 12 },
    { sport: 'Tennis', count: 9 },
    { sport: 'Track', count: 14 },
  ];

  Screens['fan/discover'] = {
    tab: 'discover',
    render(s) {
      return `<div class="p-scroll" style="padding:70px 18px 8px">
        <div style="display:flex;flex-direction:column;gap:13px">

          <div style="font-size:24px;font-weight:800">Discover</div>

          <div style="display:flex;align-items:center;gap:9px;background:var(--card2);border:1px solid var(--line2);border-radius:999px;padding:11px 15px">
            ${icon.search()}
            <span style="font-size:13px;color:var(--dim)">Search athletes, sports, skills…</span>
          </div>

          <div style="display:flex;gap:6px">
            ${SPORTS.map((sp, i) => i === 0
              ? `<span style="font-size:11.5px;font-weight:800;color:var(--ink);background:var(--mint);border-radius:999px;padding:6px 12px">${esc(sp)}</span>`
              : `<span style="font-size:11.5px;font-weight:700;color:var(--sub);border:1px solid var(--line2);border-radius:999px;padding:6px 12px">${esc(sp)}</span>`).join('')}
          </div>

          <button style="position:relative;height:172px;border-radius:20px;overflow:hidden;flex-shrink:0;width:100%;background:none;border:none;padding:0;text-align:left;color:var(--txt);display:block"
            data-action="nav" data-arg="${arg('#/fan/profile')}">
            <img src="${Data.IMG.medals}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
            <div style="position:absolute;left:0;right:0;bottom:0;height:75%;background:linear-gradient(180deg,rgba(15,17,16,0) 0%,rgba(15,17,16,0.94) 88%);pointer-events:none"></div>
            <div style="position:absolute;left:14px;right:14px;bottom:12px;display:flex;align-items:flex-end;justify-content:space-between;pointer-events:none">
              <div>
                <div style="font-size:9.5px;letter-spacing:0.18em;font-weight:800;color:var(--mint)">FEATURED THIS WEEK</div>
                <div style="font-size:19px;font-weight:900;margin-top:3px">Angela Ruggiero</div>
                <div style="font-size:11px;color:#B9C0BA;margin-top:1px">Hockey · Defense, Decoded — new season</div>
              </div>
              <span style="font-size:10px;font-weight:700;color:#D7DDD8;background:rgba(20,23,21,0.85);border:1px solid #2A2F2B;border-radius:999px;padding:4px 9px;flex-shrink:0">12,480 members</span>
            </div>
          </button>

          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="font-size:13px;font-weight:800;color:#B9C0BA">Trending now</div>
            ${Data.ATHLETES.map(a => `
              <div style="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:9px 12px">
                ${mono(a.mono, 34, a.color, 12)}
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:700">${esc(a.name)} · ${esc(a.sport)}</div>
                  <div style="font-size:11px;color:var(--dim2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.line)}</div>
                </div>
                ${s.fan.follows[a.id]
                  ? `<button style="background:none;color:var(--mint);border:1px solid var(--chip-line);border-radius:999px;padding:7px 12px;font-size:11.5px;font-weight:800;flex-shrink:0"
                      data-action="toggleFollow" data-arg="${arg({ id: a.id })}">Following ✓</button>`
                  : `<button style="background:var(--mint);color:var(--ink);border:none;border-radius:999px;padding:7px 14px;font-size:11.5px;font-weight:800;flex-shrink:0"
                      data-action="toggleFollow" data-arg="${arg({ id: a.id })}">Follow</button>`}
              </div>`).join('')}
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;padding-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <div style="font-size:13px;font-weight:800;color:#B9C0BA">Browse by sport</div>
              <span style="font-size:11px;font-weight:700;color:var(--mint)">All sports</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
              ${BROWSE.map(b => `
                <div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 12px">
                  <div style="font-size:13px;font-weight:800">${esc(b.sport)}</div>
                  <div style="font-size:10.5px;color:var(--dim2);margin-top:2px">${b.count} athletes</div>
                </div>`).join('')}
            </div>
          </div>

        </div>
      </div>`;
    },
  };
})();

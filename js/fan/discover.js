/* Fan · Discover — featured athlete + trending follows + live search (mockup 08) */
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

  // Angela is a 4th searchable row — she navigates to her profile instead of Follow.
  const ANGELA = { id: 'angela', name: 'Angela Ruggiero', sport: 'Hockey', mono: 'AR', color: '#9BB4C7', line: 'Defense, Decoded — new season', nav: true };

  // restore the scroll position after a filter re-render (browse tiles live at the bottom)
  let savedScroll = 0, restoreScroll = false;
  function stash(el) {
    const sc = el && el.closest('.p-scroll');
    if (sc) { savedScroll = sc.scrollTop; restoreScroll = true; }
  }

  Screens['fan/discover'] = {
    tab: 'discover',
    render(s) {
      const q = (s.discoverQuery || '').trim().toLowerCase();
      const sport = s.discoverSport || 'All';

      const rows = [ANGELA].concat(Data.ATHLETES);
      const matchRow = a =>
        (sport === 'All' || a.sport === sport) &&
        (!q || (a.name + ' ' + a.sport + ' ' + a.line).toLowerCase().includes(q));
      const shown = rows.filter(matchRow);

      // browse tiles stay as sport shortcuts — the query narrows them, the active sport just highlights
      const browseShown = BROWSE.filter(b => !q || b.sport.toLowerCase().includes(q));

      return `<div class="p-scroll" style="padding:70px 18px 8px">
        <div style="display:flex;flex-direction:column;gap:13px">

          <div style="font-size:24px;font-weight:800">Discover</div>

          <div style="position:relative">
            <span style="position:absolute;left:16px;top:50%;transform:translateY(-50%);display:flex;pointer-events:none">${icon.search()}</span>
            <input class="field-dark" style="width:100%;padding-left:40px" placeholder="Search athletes, sports, skills…"
              data-keep="discover-search" data-input-action="dscSearch" value="${esc(s.discoverQuery || '')}">
          </div>

          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${SPORTS.map(sp => {
              const on = sport === sp;
              return `<button data-action="dscSport" data-arg="${arg({ sport: sp })}"
                style="font-size:11.5px;font-weight:${on ? 800 : 700};border-radius:999px;padding:6px 12px;${on
                  ? 'color:var(--ink);background:var(--mint);border:none'
                  : 'color:var(--sub);background:none;border:1px solid var(--line2)'}">${esc(sp)}</button>`;
            }).join('')}
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
            ${shown.length ? shown.map(a => `
              <div style="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:9px 12px">
                ${mono(a.mono, 34, a.color, 12)}
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:700">${esc(a.name)} · ${esc(a.sport)}</div>
                  <div style="font-size:11px;color:var(--dim2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.line)}</div>
                </div>
                ${a.nav
                  ? `<button style="background:none;color:var(--mint);border:1px solid var(--chip-line);border-radius:999px;padding:7px 12px;font-size:11.5px;font-weight:800;flex-shrink:0"
                      data-action="nav" data-arg="${arg('#/fan/profile')}">View</button>`
                  : (s.fan.follows[a.id]
                    ? `<button style="background:none;color:var(--mint);border:1px solid var(--chip-line);border-radius:999px;padding:7px 12px;font-size:11.5px;font-weight:800;flex-shrink:0"
                        data-action="toggleFollow" data-arg="${arg({ id: a.id })}">Following ✓</button>`
                    : `<button style="background:var(--mint);color:var(--ink);border:none;border-radius:999px;padding:7px 14px;font-size:11.5px;font-weight:800;flex-shrink:0"
                        data-action="toggleFollow" data-arg="${arg({ id: a.id })}">Follow</button>`)}
              </div>`).join('')
            : `<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 14px;text-align:center">
                <div style="font-size:12.5px;color:var(--dim2)">No athletes match — try a sport like Tennis.</div>
              </div>`}
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;padding-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <div style="font-size:13px;font-weight:800;color:#B9C0BA">Browse by sport</div>
              <button data-action="dscReset" style="background:none;border:none;padding:0;font-size:11px;font-weight:700;color:var(--mint)">All sports</button>
            </div>
            ${browseShown.length ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
              ${browseShown.map(b => {
                const on = sport === b.sport;
                return `<button data-action="dscSport" data-arg="${arg({ sport: b.sport })}"
                  style="text-align:left;background:var(--card);border:1px solid ${on ? 'var(--chip-line)' : 'var(--line)'};border-radius:12px;padding:11px 12px;color:var(--txt)">
                  <div style="font-size:13px;font-weight:800;${on ? 'color:var(--mint)' : ''}">${esc(b.sport)}</div>
                  <div style="font-size:10.5px;color:var(--dim2);margin-top:2px">${b.count} athletes</div>
                </button>`;
              }).join('')}
            </div>` : `<div style="font-size:11.5px;color:var(--dim2)">No sports match — tap “All sports” to reset.</div>`}
          </div>

        </div>
      </div>`;
    },
    after() {
      if (!restoreScroll) return;
      restoreScroll = false;
      const sc = document.querySelector('.p-scroll');
      if (sc) sc.scrollTop = savedScroll;
    },
  };

  /* ---------- module-local actions ---------- */
  window.Actions.dscSearch = function (value, el) {
    stash(el);
    Store.set(s => { s.discoverQuery = value; });
  };
  window.Actions.dscSport = function (a, el) {
    stash(el);
    Store.set(s => { s.discoverSport = (a && a.sport) || 'All'; });
  };
  window.Actions.dscReset = function (a, el) {
    stash(el);
    Store.set(s => { s.discoverQuery = ''; s.discoverSport = 'All'; });
  };
})();

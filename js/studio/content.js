/* Studio · Content — schedule composer, scheduled drops, clip library (mockup 12) */
(function () {
  'use strict';
  const { esc } = UI;

  window.Screens = window.Screens || {};

  // image clip tile
  function clipImg(src, caption, pos) {
    return `<div>
      <img src="${esc(src)}" alt="" style="display:block;width:100%;height:118px;border-radius:10px;object-fit:cover;${pos ? `object-position:${pos};` : ''}">
      <div style="font-size:11.5px;color:var(--sub);margin-top:6px;font-weight:600">${esc(caption)}</div>
    </div>`;
  }

  // placeholder clip tile (dark card with a faint centered label)
  function clipPh(label, caption) {
    return `<div>
      <div class="card2" style="height:118px;border-radius:10px;display:flex;align-items:center;justify-content:center">
        <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:var(--faint)">${esc(label)}</span>
      </div>
      <div style="font-size:11.5px;color:var(--sub);margin-top:6px;font-weight:600">${esc(caption)}</div>
    </div>`;
  }

  function composer() {
    return `<div class="card" data-composer style="padding:18px;display:flex;flex-direction:column;gap:12px">
      <div style="font-size:14.5px;font-weight:800">Schedule a drop</div>
      <input class="field-rect" data-f="title" data-keep="composer-title" data-enter-action="scheduleDrop"
        placeholder="Drop title — e.g. Friday drop: Power play reads">
      <textarea class="field-rect" rows="4" data-f="script" data-keep="composer-script"
        placeholder="Write the script — these exact words get spoken in your voice."></textarea>
      <div style="display:flex;align-items:center;gap:10px">
        <select data-f="slot" style="background:var(--screen);border:1px solid var(--line2);border-radius:10px;
          padding:10px 12px;font:inherit;font-size:12.5px;font-weight:600;color:#D7DDD8;outline:none">
          <option value="now">Publish now</option>
          <option value="FRI 7:00 AM">FRI 7:00 AM</option>
          <option value="MON 7:00 AM">MON 7:00 AM</option>
          <option value="SAT 9:00 AM">SAT 9:00 AM</option>
        </select>
        <button class="btn btn-mint" data-action="scheduleDrop">Generate voice &amp; schedule</button>
        <button class="btn-quiet" style="padding:10px 12px;font-size:12.5px" data-action="toggleComposer">Cancel</button>
      </div>
      <div style="font-size:11px;color:var(--faint)">Voice is generated from your script — you approve before it ships.</div>
    </div>`;
  }

  Screens['studio/content'] = {
    url: 'content',
    render(s) {
      return `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:23px;font-weight:800">Content</div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-ghost" style="padding:10px 16px" data-action="toast" data-arg="${UI.arg({ msg: 'Clip upload isn’t wired in this concept demo.' })}">Upload clips</button>
            <button class="btn btn-mint" style="padding:10px 16px" data-action="toggleComposer">Schedule a drop</button>
          </div>
        </div>

        ${s.composerOpen ? composer() : ''}

        <div class="card" style="padding:18px;display:flex;flex-direction:column;gap:12px">
          <div style="font-size:14.5px;font-weight:800">Scheduled</div>
          ${s.scheduled.map((r, i) => `
            <div style="display:flex;align-items:center;gap:14px;${i < s.scheduled.length - 1 ? 'border-bottom:1px solid #1D221E;padding-bottom:12px;' : ''}">
              <span style="font-size:10.5px;font-weight:900;letter-spacing:0.06em;color:var(--azure);background:rgba(126,179,247,0.12);border-radius:8px;padding:6px 10px;flex-shrink:0">${esc(r.slot)}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700">${esc(r.title)}</div>
                <div style="font-size:11.5px;color:var(--dim2);margin-top:2px">${esc(r.sub)}</div>
              </div>
              <span style="font-size:11px;color:var(--faint)">${esc(r.dur)}</span>
            </div>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:14.5px;font-weight:800">Clip library</div>
            <span style="font-size:11.5px;color:var(--faint)">Drag clips into drops &amp; lessons</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
            ${clipImg(Data.IMG.medals, "Nagano '98 · gold medal shift")}
            ${clipPh('Locker talk', 'Worlds locker room talk')}
            ${clipImg(Data.IMG.head, 'Harvard leadership lecture', '50% 18%')}
            ${clipImg(Data.IMG.skate, 'Youth camp — gap drill', '50% 25%')}
            ${clipPh('HHOF', 'Hall of Fame induction')}
            ${clipPh('Tulsa shift', 'Tulsa Oilers — pro shift')}
          </div>
        </div>`;
    },
  };
})();

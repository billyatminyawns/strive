/* Studio · Content — schedule composer, scheduled drops, clip library (mockup 12) */
(function () {
  'use strict';
  const { esc } = UI;

  window.Screens = window.Screens || {};

  /* ---------- clip library state ----------
     Persisted uploads live in s.uploadedClips (newest first, cap 9). If localStorage
     is full, the clip can't be persisted — it's kept here for the session only. */
  let sessionClips = [];
  let quotaBlown = false;

  // stock (seeded) library — built lazily so Data is guaranteed loaded
  function stockClips() {
    return [
      { id: 'stock-medals', kind: 'img', src: Data.IMG.medals, caption: "Nagano '98 · gold medal shift" },
      { id: 'stock-locker', kind: 'ph', label: 'Locker talk', caption: 'Worlds locker room talk' },
      { id: 'stock-harvard', kind: 'img', src: Data.IMG.head, caption: 'Harvard leadership lecture', pos: '50% 18%' },
      { id: 'stock-camp', kind: 'img', src: Data.IMG.skate, caption: 'Youth camp — gap drill', pos: '50% 25%' },
      { id: 'stock-hhof', kind: 'ph', label: 'HHOF', caption: 'Hall of Fame induction' },
      { id: 'stock-tulsa', kind: 'ph', label: 'Tulsa shift', caption: 'Tulsa Oilers — pro shift' },
    ];
  }

  // uploaded clips visible this render (session-only first, then persisted), capped at 9
  function uploadedClips(s) {
    return [...sessionClips, ...((s && s.uploadedClips) || [])].slice(0, 9);
  }

  // resolve any tile id (uploaded or stock) to a normalized shape for the lightbox
  function findClip(s, id) {
    const up = [...sessionClips, ...((s && s.uploadedClips) || [])].find(c => c.id === id);
    if (up) return { id: up.id, name: up.name, src: up.src, mine: true };
    const st = stockClips().find(c => c.id === id);
    if (st) return { id: st.id, name: st.caption, src: st.kind === 'img' ? st.src : null, label: st.label, mine: false };
    return null;
  }

  /* ---------- tiles ---------- */

  // uploaded clip tile: image + mint YOURS chip + ✕ remove
  function uploadedTile(clip) {
    return `<div data-action="clipOpen" data-arg="${UI.arg({ id: clip.id })}" style="cursor:pointer">
      <div style="position:relative">
        <img src="${esc(clip.src)}" alt="" style="display:block;width:100%;height:118px;border-radius:10px;object-fit:cover">
        <span style="position:absolute;top:6px;left:6px;font-size:9px;font-weight:900;letter-spacing:0.06em;color:var(--ink);background:var(--mint);border-radius:6px;padding:3px 6px">YOURS</span>
        <button data-action="clipRemove" data-arg="${UI.arg({ id: clip.id })}" aria-label="Remove clip"
          style="position:absolute;top:6px;right:6px;width:22px;height:22px;border:none;border-radius:50%;background:rgba(11,12,11,0.72);color:#F3F5F3;font-size:12px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
      </div>
      <div style="font-size:11.5px;color:var(--sub);margin-top:6px;font-weight:600">${esc(clip.name)}</div>
    </div>`;
  }

  // stock clip tile (image or placeholder), clickable into the lightbox
  function stockTile(c) {
    const inner = c.kind === 'img'
      ? `<img src="${esc(c.src)}" alt="" style="display:block;width:100%;height:118px;border-radius:10px;object-fit:cover;${c.pos ? `object-position:${c.pos};` : ''}">`
      : `<div class="card2" style="height:118px;border-radius:10px;display:flex;align-items:center;justify-content:center">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:var(--faint)">${esc(c.label)}</span>
        </div>`;
    return `<div data-action="clipOpen" data-arg="${UI.arg({ id: c.id })}" style="cursor:pointer">
      ${inner}
      <div style="font-size:11.5px;color:var(--sub);margin-top:6px;font-weight:600">${esc(c.caption)}</div>
    </div>`;
  }

  // full-screen preview of a clip with "Use in drop" / "Close"
  function lightbox(s) {
    const id = s.clipLightbox;
    if (!id) return '';
    const clip = findClip(s, id);
    if (!clip) return '';
    const big = clip.src
      ? `<img src="${esc(clip.src)}" alt="" style="max-width:100%;max-height:460px;border-radius:14px;object-fit:contain;display:block">`
      : `<div class="card2" style="width:520px;max-width:100%;height:300px;border-radius:14px;display:flex;align-items:center;justify-content:center">
          <span style="font-size:15px;font-weight:800;letter-spacing:0.06em;color:var(--faint)">${esc(clip.label || clip.name)}</span>
        </div>`;
    return `<div data-action="clipClose" style="position:fixed;inset:0;z-index:90;background:rgba(6,8,7,0.82);display:flex;align-items:center;justify-content:center;padding:40px">
      <div data-action="clipStop" style="max-width:620px;width:100%;display:flex;flex-direction:column;align-items:center;gap:16px;cursor:default">
        ${big}
        <div style="font-size:14px;font-weight:700;color:#E7ECE8;text-align:center">${esc(clip.name)}${clip.mine ? ` <span style="font-size:10px;font-weight:900;letter-spacing:0.06em;color:var(--mint)">· YOURS</span>` : ''}</div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-mint" style="padding:11px 18px" data-action="clipUseInDrop" data-arg="${UI.arg({ id })}">Use in drop</button>
          <button class="btn btn-ghost" style="padding:11px 18px" data-action="clipClose">Close</button>
        </div>
      </div>
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
      const mine = uploadedClips(s);
      return `
        <input type="file" accept="image/*,video/*" multiple id="clip-file" style="display:none">

        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:23px;font-weight:800">Content</div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-ghost" style="padding:10px 16px" data-action="clipPick">Upload clips</button>
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
            <span style="font-size:11.5px;color:var(--faint)">Tap a clip to preview · drag into drops &amp; lessons</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
            ${mine.map(uploadedTile).join('')}
            ${stockClips().map(stockTile).join('')}
          </div>
        </div>

        ${lightbox(s)}`;
    },
    after() {
      // no data-change delegation in the app — wire the hidden file input here
      const input = document.getElementById('clip-file');
      if (input) input.onchange = function (e) {
        handleFiles(e.target.files);
        e.target.value = '';   // let the same file be re-picked later
      };
    },
  };

  /* ---------- file → dataURL processing ---------- */

  const MAX_W = 560;

  function prettify(filename) {
    const base = String(filename || '').replace(/\.[^./\\]+$/, '');   // strip extension
    const words = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!words) return 'Clip';
    return words.replace(/\b\w/g, c => c.toUpperCase());
  }

  function newId() {
    return 'clip-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function downscaleToJpeg(source, srcW, srcH) {
    const scale = Math.min(1, MAX_W / (srcW || MAX_W));
    const w = Math.max(1, Math.round((srcW || MAX_W) * scale));
    const h = Math.max(1, Math.round((srcH || MAX_W) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(source, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  function processImage(file, cb) {
    const reader = new FileReader();
    reader.onload = function () {
      const img = new Image();
      img.onload = function () {
        let data;
        try { data = downscaleToJpeg(img, img.naturalWidth, img.naturalHeight); }
        catch (e) { data = reader.result; }   // canvas may taint on odd inputs — fall back
        cb(data);
      };
      img.onerror = function () { cb(null); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }

  function processVideo(file, cb) {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    let done = false;
    function finish(data) { if (done) return; done = true; try { URL.revokeObjectURL(url); } catch (e) {} cb(data); }
    function grab() {
      try { finish(downscaleToJpeg(video, video.videoWidth, video.videoHeight)); }
      catch (e) { finish(null); }
    }
    video.onloadeddata = function () {
      try { video.currentTime = Math.min(0.5, Math.max(0, (video.duration || 1) - 0.05)); }
      catch (e) { grab(); }
    };
    video.onseeked = grab;
    video.onerror = function () { finish(null); };
    setTimeout(function () { if (!done) grab(); }, 4000);   // safety net if seek never fires
    video.src = url;
  }

  function handleFiles(list) {
    const files = Array.prototype.slice.call(list || [])
      .filter(f => /^image\//.test(f.type) || /^video\//.test(f.type));
    files.forEach(function (file) {
      const finalize = function (data) {
        if (!data) { Actions.toast({ msg: 'Couldn’t read that clip — try another file.' }); return; }
        addClip({ id: newId(), name: prettify(file.name), src: data, when: 'Just now', mine: true });
      };
      if (/^video\//.test(file.type)) processVideo(file, finalize);
      else processImage(file, finalize);
    });
  }

  // room for `payload` in localStorage? (self-cleaning probe; latches quotaBlown once full)
  function canPersist(payload) {
    if (quotaBlown) return false;
    try {
      const k = '__strive_clip_probe__';
      localStorage.setItem(k, payload);
      localStorage.removeItem(k);
      return true;
    } catch (e) { quotaBlown = true; return false; }
  }

  function addClip(clip) {
    if (canPersist(clip.src)) {
      Store.set(s => { s.uploadedClips = [clip, ...(s.uploadedClips || [])].slice(0, 9); });
    } else {
      // keep in-memory only for this session; nothing hits localStorage
      sessionClips = [clip, ...sessionClips].slice(0, 9);
      Actions.toast({ msg: 'Storage full — clip kept for this session only.' });
      if (window.App) App.render();
    }
  }

  /* ---------- module-local actions ---------- */
  window.Actions.clipPick = function () {
    const input = document.getElementById('clip-file');
    if (input) input.click();
  };
  window.Actions.clipRemove = function (a) {
    const id = a && a.id;
    sessionClips = sessionClips.filter(c => c.id !== id);
    Store.set(s => {
      s.uploadedClips = ((s.uploadedClips) || []).filter(c => c.id !== id);
      if (s.clipLightbox === id) s.clipLightbox = null;
    });
  };
  window.Actions.clipOpen = function (a) {
    const id = a && a.id;
    Store.set(s => { s.clipLightbox = id; });
  };
  window.Actions.clipClose = function () {
    Store.set(s => { s.clipLightbox = null; });
  };
  window.Actions.clipStop = function () { /* swallow clicks inside the lightbox card */ };
  window.Actions.clipUseInDrop = function (a) {
    const id = a && a.id;
    let title = '';
    Store.set(s => {
      const clip = findClip(s, id);
      title = clip ? clip.name + ' — drop' : '';
      s.clipLightbox = null;
      s.composerOpen = true;   // open the composer if it isn't already
    });
    const inp = document.querySelector('[data-composer] [data-f="title"]');
    if (inp) {
      inp.value = title;
      try { inp.focus(); inp.setSelectionRange(title.length, title.length); } catch (e) {}
    }
  };
})();

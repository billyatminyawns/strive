/* Studio · Voice Studio — voice model, delivery sliders, guardrails (mockup 10) */
(function () {
  'use strict';
  const { esc, arg, fmt, wave, playBtn, slider, toggle } = UI;

  window.Screens = window.Screens || {};

  /* ---------- source-line recorder (real mic via MediaRecorder) ---------- */
  const PROMPT_LINE = 'Big game tonight — remember, poise beats panic. Short memory, long habits — eyes up, next play.';
  let mr = null, chunks = [], micStream = null, recTimer = null, recStart = 0, recSecsAtStop = 0;
  let rec = { url: null, secs: 0 };   // module-held take (objectURL survives re-render, not reload)

  function stopTracks() {
    if (micStream) { micStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); micStream = null; }
  }
  function micUnavailable() {
    Actions.toast({ msg: 'Microphone unavailable — check browser permissions.' });
  }
  function finalizeRec() {
    stopTracks();
    const type = (chunks[0] && chunks[0].type) || 'audio/webm';
    const blob = new Blob(chunks, { type });
    if (rec.url) { try { URL.revokeObjectURL(rec.url); } catch (e) {} }
    const url = blob.size ? URL.createObjectURL(blob) : null;
    rec = { url, secs: recSecsAtStop || 0 };
    // persist small takes as a dataURL so playback survives re-render / reload
    if (url && blob.size < 250 * 1024) {
      const reader = new FileReader();
      reader.onload = () => { try { Store.silent(s => { s.vsRecording = reader.result; }); } catch (e) {} };
      try { reader.readAsDataURL(blob); } catch (e) {}
    } else {
      Store.silent(s => { s.vsRecording = null; });
    }
    Store.set(s => { s.vsRec = 'review'; s.vsRecSecs = rec.secs; });
  }

  function recorderPanel(s) {
    if (s.vsRec === 'rec') {
      return `<div class="card2 popin" style="padding:14px 16px;display:flex;flex-direction:column;gap:11px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="width:9px;height:9px;border-radius:50%;background:#FF5F57;animation:livepulse 1s infinite;flex-shrink:0"></span>
          <span style="font-size:11px;font-weight:900;letter-spacing:0.12em;color:#FF6E66">REC</span>
          <span data-rec-time style="font-size:12.5px;color:var(--dim2);font-variant-numeric:tabular-nums">${fmt(s.vsRecSecs || 0)}</span>
          <div style="flex:1"></div>
          <button class="btn btn-ghost" style="border-radius:9px;padding:8px 16px;font-size:12px;font-weight:700" data-action="vsRecStop">Stop</button>
        </div>
        <div style="font-size:10px;letter-spacing:0.12em;font-weight:800;color:var(--faint)">READ THIS ALOUD</div>
        <div style="font-size:14px;font-weight:600;line-height:1.55;color:var(--txt)">${esc(PROMPT_LINE)}</div>
      </div>`;
    }
    if (s.vsRec === 'review') {
      const src = rec.url || s.vsRecording;
      if (!src) return '';   // take gone after reload with nothing persisted
      return `<div class="card2 popin" style="padding:14px 16px;display:flex;flex-direction:column;gap:11px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:10px;letter-spacing:0.12em;font-weight:800;color:var(--mint)">TAKE READY</span>
          <span style="font-size:11px;color:var(--dim2)">${fmt(s.vsRecSecs || rec.secs || 0)}</span>
        </div>
        <audio controls src="${esc(src)}" style="width:100%;height:34px;border-radius:8px;filter:invert(0.92) hue-rotate(180deg)"></audio>
        <div style="display:flex;gap:10px">
          <button class="btn btn-mint" style="border-radius:9px;padding:9px 14px;font-size:12px" data-action="vsRecSave">Save to voice model</button>
          <button class="btn btn-ghost" style="border-radius:9px;padding:9px 14px;font-size:12px;font-weight:700" data-action="vsRecDiscard">Discard</button>
        </div>
      </div>`;
    }
    return '';
  }

  /* ---------- pronunciation library ---------- */
  const DEFAULT_PRON = [
    { term: 'Ruggiero', say: 'roo-JAIR-oh' },
    { term: 'Nagano', say: 'NAH-gah-noh' },
    { term: 'Chamonix', say: 'SHAM-oh-nee' },
  ];
  const pronId = term => 'pron-' + term;

  // play button wired to a module action (togglePlay's registry can't resolve pron-* ids)
  function pronPlayBtn(id, size) {
    size = size || 28;
    const iconSize = Math.round(size * 0.32);
    const on = window.Player && Player.isPlaying(id);
    return `<button class="playbtn" style="width:${size}px;height:${size}px"
      data-action="vsPronPlay" data-arg="${arg({ id })}" data-playbtn-for="${esc(id)}"
      aria-label="Play respelling">${on ? UI.icon.pause(iconSize) : UI.icon.play(iconSize)}</button>`;
  }
  function pronRow(p, i, n) {
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;${i < n - 1 ? 'border-bottom:1px solid var(--line2)' : ''}">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700">${esc(p.term)}</div>
        <div style="font-size:12px;color:var(--mint);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.02em;margin-top:2px">${esc(p.say)}</div>
      </div>
      ${pronPlayBtn(pronId(p.term), 28)}
      <button class="btn-quiet" style="font-size:16px;line-height:1;padding:2px 6px;color:var(--dim2)" data-action="vsPronDel" data-arg="${arg({ term: p.term })}" aria-label="Delete">✕</button>
    </div>`;
  }
  function pronPanel(s) {
    if (!s.vsPronOpen) return '';
    const pron = Array.isArray(s.pronunciations) ? s.pronunciations : DEFAULT_PRON;
    return `<div class="card2 popin" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:12.5px;font-weight:800">Pronunciation library</div>
        <button class="btn-quiet" style="font-size:16px;line-height:1;padding:2px 6px" data-action="vsPronToggle" aria-label="Close">✕</button>
      </div>
      <div style="font-size:11px;color:var(--faint);line-height:1.5">Names Angela's voice always gets right — applied every time these words appear.</div>
      ${pron.length ? `<div style="display:flex;flex-direction:column">${pron.map((p, i) => pronRow(p, i, pron.length)).join('')}</div>`
        : `<div style="font-size:12px;color:var(--dim2);padding:6px 0">No entries yet — add one below.</div>`}
      <div style="display:flex;gap:8px;align-items:center;border-top:1px solid var(--line2);padding-top:11px">
        <input class="field-rect" style="flex:1;min-width:0" data-keep="vs-pron-term" data-enter-action="vsPronAdd" placeholder="Term" value="">
        <input class="field-rect" style="flex:1;min-width:0" data-keep="vs-pron-say" data-enter-action="vsPronAdd" placeholder="roo-JAIR-oh" value="">
        <button class="btn btn-mint" style="padding:0 16px;flex-shrink:0" data-action="vsPronAdd">Add</button>
      </div>
    </div>`;
  }

  /* ---------- render helpers (unchanged) ---------- */
  function sliderRow(label, key, val) {
    return `<div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#B9C0BA;font-weight:700">
        <span>${esc(label)}</span><span style="color:var(--dim2)" data-slider-val="${esc(key)}">${esc(val)}</span>
      </div>
      <div style="margin-top:8px">${slider(val, 'setDelivery', { k: key })}</div>
    </div>`;
  }

  function guardRow(title, sub, key, on, last) {
    return `<div style="display:flex;align-items:center;gap:12px;${last ? '' : 'border-bottom:1px solid #1D221E;padding-bottom:13px'}">
      <div style="flex:1">
        <div style="font-size:12.5px;font-weight:700">${esc(title)}</div>
        <div style="font-size:11px;color:var(--faint);margin-top:2px">${esc(sub)}</div>
      </div>
      ${toggle(on, 'toggleGuard', { k: key })}
    </div>`;
  }

  Screens['studio/voice'] = {
    url: 'voice',
    render(s) {
      const sampleDur = fmt(Player.estimate(s.sample.text, 1));
      const subtitle = s.vsRecSaved
        ? 'Built from 53 minutes of studio recording · updated Just now'
        : 'Built from 52 minutes of studio recording · updated May 2026';

      return `
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:23px;font-weight:800">Voice Studio</div>
          <span class="pill" style="font-size:11px;font-weight:800;color:var(--mint);border:1px solid var(--chip-line);padding:4px 10px">
            <span style="width:6px;height:6px;border-radius:50%;background:var(--mint);animation:livepulse 2s infinite"></span>LIVE</span>
        </div>

        <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:22px;flex:1;min-height:0">
          <div style="display:flex;flex-direction:column;gap:20px;min-width:0">

            <div class="gradcard" style="border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <div>
                  <div style="font-size:17px;font-weight:800">Angela — Studio Voice</div>
                  <div style="font-size:12px;color:var(--sub);margin-top:3px">${esc(subtitle)}</div>
                </div>
                <span style="font-size:10.5px;letter-spacing:0.1em;font-weight:800;color:var(--mint);border:1px solid var(--chip-line);border-radius:999px;padding:5px 11px">VOICE BY WELLSAID</span>
              </div>
              <div>${wave(null, 60, 40, '#3C463E', 5)}</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="btn btn-ghost" style="border-radius:9px;padding:9px 14px;font-size:12px;font-weight:700${s.vsRec === 'rec' || s.vsRec === 'review' ? ';color:var(--mint);border-color:var(--chip-line)' : ''}" data-action="vsRecStart">Re-record source lines</button>
                <button class="btn btn-ghost" style="border-radius:9px;padding:9px 14px;font-size:12px;font-weight:700${s.vsPronOpen ? ';color:var(--mint);border-color:var(--chip-line)' : ''}" data-action="vsPronToggle">Pronunciation library</button>
                <button class="btn btn-ghost" style="border-radius:9px;padding:9px 14px;font-size:12px;font-weight:700"
                  data-action="nav" data-arg="${arg('#/studio/scan')}">View onboarding scan</button>
              </div>
              ${recorderPanel(s)}
              ${pronPanel(s)}
            </div>

            <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:16px">
              <div style="font-size:14.5px;font-weight:800">Delivery style</div>
              <div style="display:flex;flex-direction:column;gap:14px">
                ${sliderRow('Warmth', 'warmth', s.delivery.warmth)}
                ${sliderRow('Energy', 'energy', s.delivery.energy)}
                ${sliderRow('Pace', 'pace', s.delivery.pace)}
              </div>
              <div style="border-top:1px solid #1D221E;padding-top:14px;display:flex;flex-direction:column;gap:10px">
                <div style="font-size:12px;font-weight:800;color:#B9C0BA">Try a line</div>
                <div style="display:flex;gap:10px">
                  <input class="field-rect" style="flex:1;min-width:0" data-keep="sample-text"
                    data-input-action="sampleText" value="${esc(s.sample.text)}">
                  <button class="btn btn-mint" style="padding:0 16px;flex-shrink:0" data-action="genSample">Generate sample</button>
                </div>
                ${s.sample.ready ? `
                  <div class="popin" style="display:flex;align-items:center;gap:12px;background:var(--chip-bg);border:1px solid var(--chip-line);border-radius:12px;padding:10px 14px">
                    ${playBtn({ id: 'sample' }, 32)}
                    <div style="flex:1">${wave('sample', 18, 16)}</div>
                    <span style="font-size:11px;color:var(--dim2)" data-dur-for="sample">${sampleDur} · ready</span>
                  </div>` : ''}
              </div>
            </div>
          </div>

          <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px">
            <div>
              <div style="font-size:14.5px;font-weight:800">Guardrails</div>
              <div style="font-size:11.5px;color:var(--dim2);margin-top:3px;line-height:1.5">Coach Angela only says what Angela has said on the record or approved — and she can switch autopilot off anytime.</div>
            </div>
            ${guardRow('Approve every reply before it sends', Coach.guardSub(s.guards.review), 'review', s.guards.review)}
            ${Coach.serverLine(s)}
            ${guardRow('Stick to approved topics', 'Hockey · leadership · career · training', 'topics', s.guards.topics)}
            ${guardRow('Auto-decline sensitive asks', 'Medical, betting & legal questions get a polite pass', 'decline', s.guards.decline)}
            <div style="background:var(--screen);border:1px solid var(--line2);border-radius:12px;padding:13px 15px;font-size:11.5px;color:var(--sub);line-height:1.6;margin-top:auto">Every generated clip is watermarked and logged. Angela can revoke her voice model at any time — it's hers, contractually and technically.</div>
          </div>
          ${Coach.log(s)}
        </div>`;
    },
  };

  /* ---------- module-local actions ---------- */

  // 1) source-line recorder
  window.Actions.vsRecStart = function () {
    const s = Store.get();
    if (s.vsRec === 'rec') return;                       // already recording
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) {
      micUnavailable(); return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      micStream = stream;
      chunks = [];
      try { mr = new MediaRecorder(stream); } catch (e) { mr = null; }
      if (!mr) { micUnavailable(); stopTracks(); return; }
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => finalizeRec();
      try { mr.start(); } catch (e) { micUnavailable(); stopTracks(); return; }
      recStart = Date.now();
      Store.set(st => { st.vsRec = 'rec'; st.vsRecSecs = 0; });
      // tick the elapsed timer without a full re-render (silent state + direct DOM)
      clearInterval(recTimer);
      recTimer = setInterval(() => {
        const secs = Math.round((Date.now() - recStart) / 1000);
        Store.silent(st => { st.vsRecSecs = secs; });
        const el = document.querySelector('[data-rec-time]');
        if (el) el.textContent = fmt(secs);
      }, 250);
    }).catch(() => { micUnavailable(); });
  };

  window.Actions.vsRecStop = function () {
    clearInterval(recTimer); recTimer = null;
    recSecsAtStop = recStart ? Math.round((Date.now() - recStart) / 1000) : 0;
    if (mr && mr.state !== 'inactive') {
      try { mr.stop(); } catch (e) { finalizeRec(); }   // onstop → finalizeRec builds the blob
    } else {
      finalizeRec();
    }
  };

  window.Actions.vsRecSave = function () {
    Actions.toast({ msg: 'Source line added — model refresh queued ✓' });
    if (rec.url) { try { URL.revokeObjectURL(rec.url); } catch (e) {} }
    rec = { url: null, secs: 0 };
    Store.set(s => { s.vsRecSaved = true; s.vsRec = null; });
  };

  window.Actions.vsRecDiscard = function () {
    if (rec.url) { try { URL.revokeObjectURL(rec.url); } catch (e) {} }
    rec = { url: null, secs: 0 };
    Store.set(s => { s.vsRec = null; s.vsRecording = null; });
  };

  // 2) pronunciation library
  window.Actions.vsPronToggle = function () {
    Store.set(s => { s.vsPronOpen = !s.vsPronOpen; });
  };

  window.Actions.vsPronPlay = function (a) {
    const s = Store.get();
    const list = Array.isArray(s.pronunciations) ? s.pronunciations : DEFAULT_PRON;
    const entry = list.find(p => pronId(p.term) === a.id);
    const text = entry ? entry.say : String(a.id || '').replace(/^pron-/, '');
    Player.toggle({ id: a.id, text });
  };

  window.Actions.vsPronAdd = function () {
    const termEl = document.querySelector('[data-keep="vs-pron-term"]');
    const sayEl = document.querySelector('[data-keep="vs-pron-say"]');
    const term = ((termEl && termEl.value) || '').trim();
    const say = ((sayEl && sayEl.value) || '').trim();
    if (!term || !say) { Actions.toast({ msg: 'Add both a term and how to say it.' }); return; }
    const cur = Array.isArray(Store.get().pronunciations) ? Store.get().pronunciations : DEFAULT_PRON;
    if (cur.some(p => p.term.toLowerCase() === term.toLowerCase())) {
      Actions.toast({ msg: '“' + term + '” is already in the library.' }); return;
    }
    if (termEl) termEl.value = '';                       // clear before re-render so focus-keep restores empty
    if (sayEl) sayEl.value = '';
    Store.set(s => {
      const list = (Array.isArray(s.pronunciations) ? s.pronunciations : DEFAULT_PRON).slice();
      list.push({ term, say });
      s.pronunciations = list;
    });
  };

  window.Actions.vsPronDel = function (a) {
    if (window.Player && Player.isPlaying(pronId(a.term))) Player.stop();
    Store.set(s => {
      const list = (Array.isArray(s.pronunciations) ? s.pronunciations : DEFAULT_PRON).slice();
      s.pronunciations = list.filter(p => p.term !== a.term);
    });
  };
})();

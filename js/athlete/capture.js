/* Athlete · Capture — push-to-talk story & drop capture.
   Hold the orb, tell the story, release. Saves feed the twin's knowledge base (stories)
   or the drop schedule (drops). Real mic via MediaRecorder; graceful when denied. */
(function () {
  'use strict';
  const { esc, arg, fmt } = UI;
  window.Screens = window.Screens || {};

  /* module recording state (objectURLs don't survive reload; small takes persist as dataURL) */
  let mr = null, chunks = [], micStream = null, recTimer = null, recStart = 0;
  let take = { url: null, secs: 0, dataURL: null };

  const DROP_PROMPT = { id: 'drop', title: 'Record a drop', src: 'YOUR CALL · YOU APPROVE BEFORE IT SHIPS', hint: 'Speak it — your Coach drafts it clean, you approve, fans hear it in your voice.' };

  function promptById(id) {
    if (id === 'drop') return DROP_PROMPT;
    return Data.STORY_PROMPTS.find(p => p.id === id) || Data.STORY_PROMPTS[0];
  }

  function stopTracks() {
    if (micStream) { micStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); micStream = null; }
  }

  function statusChip(st) {
    if (st === 'queued') return `<span class="k-label" style="font-size:9px;color:var(--lav);display:inline-flex;align-items:center;gap:5px">
      <span style="width:5px;height:5px;border-radius:50%;background:var(--lav);animation:livepulse 1.1s infinite"></span>TRANSCRIBING…</span>`;
    if (st === 'drop') return `<span class="k-label" style="font-size:9px;color:var(--azure)">SCHEDULED · TOMORROW 7:00 AM</span>`;
    return `<span class="k-label" style="font-size:9px;color:var(--mint)">IN KNOWLEDGE BASE ✓</span>`;
  }

  Screens['athlete/capture'] = {
    tab: 'capture',
    render(s, params) {
      const dropMode = (params && params[0]) === 'drop' || s.captureSel === 'drop';
      const sel = dropMode ? DROP_PROMPT : promptById(s.captureSel);
      const rec = s.athRec || 'idle'; // idle | rec | review
      const stories = s.stories || [];

      const passed = s.passedPrompts || [];
      const chips = [DROP_PROMPT].concat(Data.STORY_PROMPTS).filter(p => !passed.includes(p.id)).map(p => {
        const on = p.id === sel.id;
        return `<button data-action="athCapSelect" data-arg="${arg({ id: p.id })}"
          style="flex-shrink:0;font-size:11.5px;font-weight:${on ? 800 : 700};padding:7px 13px;border-radius:999px;
            background:${on ? 'var(--mint)' : 'none'};color:${on ? 'var(--ink)' : 'var(--sub)'};
            border:1px solid ${on ? 'var(--mint)' : 'var(--line2)'}">${esc(p.title)}</button>`;
      }).join('');

      let stage = '';
      if (rec === 'rec') {
        stage = `<div style="display:flex;flex-direction:column;align-items:center;gap:10px">
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;color:var(--red)">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--red);animation:livepulse 1s infinite"></span>
            REC <span data-cap-time style="font-variant-numeric:tabular-nums">0:00</span>
          </div>
          <button data-action="athCapStop" id="cap-orb"
            style="width:96px;height:96px;border-radius:50%;background:var(--red);border:none;display:flex;align-items:center;justify-content:center;
              box-shadow:0 12px 40px rgba(240,138,138,0.35);animation:livepulse 1.6s infinite">${UI.icon.mic('#141614', 30)}</button>
          <div style="font-size:11.5px;color:var(--dim2)">Release to finish</div>
        </div>`;
      } else if (rec === 'review' && (take.url || take.dataURL)) {
        stage = `<div class="card2 popin" style="border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:11px;width:100%">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="k-label" style="font-size:10px;color:var(--mint)">TAKE READY · ${fmt(take.secs)}</span>
            <span style="font-size:10.5px;color:var(--faint)">${esc(sel.title)}</span>
          </div>
          <audio controls src="${esc(take.url || take.dataURL)}" style="width:100%;height:34px;border-radius:8px;filter:invert(0.92) hue-rotate(180deg)"></audio>
          <div style="display:flex;gap:9px">
            <button class="btn btn-mint" style="flex:1;padding:11px 0" data-action="athCapSave" data-arg="${arg({ id: sel.id })}">${sel.id === 'drop' ? 'Schedule as drop' : 'Save to knowledge base'}</button>
            <button class="btn btn-ghost" style="padding:11px 14px" data-action="athCapDiscard">Discard</button>
          </div>
        </div>`;
      } else {
        stage = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px">
          <button id="cap-orb" data-ptt="1"
            style="width:96px;height:96px;border-radius:50%;background:var(--mint);border:none;display:flex;align-items:center;justify-content:center;
              box-shadow:0 12px 40px rgba(124,226,165,0.3);touch-action:none">${UI.icon.mic('var(--ink)', 30)}</button>
          <div class="k-label" style="font-size:10.5px;color:var(--sub)">HOLD TO TALK</div>
        </div>`;
      }

      return `<div class="p-scroll" style="padding:64px 18px 8px">
        <div style="display:flex;flex-direction:column;gap:15px">

          <div>
            <div style="font-size:20px;font-weight:800">Capture</div>
            <div style="font-size:12px;color:var(--dim2);margin-top:2px">Your voice is the data — stories become answers.</div>
          </div>

          <div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:4px;margin:0 -18px;padding-left:18px;padding-right:18px" class="scroll">${chips}</div>

          <div class="gradcard" style="padding:16px 16px 14px;display:flex;flex-direction:column;gap:6px">
            <span class="k-label" style="font-size:9.5px;color:var(--lav)">${esc(sel.src || 'FROM YOUR GAP REPORT')}</span>
            <div style="font-size:17px;font-weight:800">${esc(sel.title)}</div>
            <div style="font-size:12px;color:var(--sub2);line-height:1.55">${esc(sel.hint)}</div>
            ${sel.id !== 'drop' && sel.id !== 'sp-free'
              ? `<button style="align-self:flex-start;background:none;border:none;padding:4px 0 0;font-size:11px;font-weight:700;color:var(--dim2);text-decoration:underline;text-underline-offset:2px"
                  data-action="athCapPass" data-arg="${arg({ id: sel.id })}">Pass — don't ask me this</button>`
              : ''}
          </div>

          <div style="display:flex;justify-content:center;padding:10px 0 4px;min-height:150px;align-items:center">${stage}</div>

          <div class="card2" style="padding:13px 14px;display:flex;flex-direction:column;gap:9px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <span class="k-label" style="font-size:10px;color:var(--lav)">WHERE YOUR COACH IS THIN</span>
              <span style="font-size:10px;color:var(--dim2)">prompts pull from here</span>
            </div>
            ${Data.COVERAGE.slice().sort((a, b) => a.pct - b.pct).slice(0, 3).map(c => `
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:11.5px;font-weight:700;width:80px;flex-shrink:0">${esc(c.bucket)}</span>
                <div class="progress" style="flex:1;height:4px"><div style="width:${c.pct}%"></div></div>
                <span style="font-size:10.5px;color:${c.pct < 30 ? 'var(--papaya)' : 'var(--dim2)'};width:64px;text-align:right;flex-shrink:0">${c.pct}% covered</span>
              </div>`).join('')}
          </div>

          ${stories.length ? `<div style="display:flex;flex-direction:column;gap:9px;padding-bottom:8px">
            <div style="font-size:13px;font-weight:800;color:#B9C0BA">Captured</div>
            ${stories.map(st => `
              <div class="card2" style="border-radius:14px;padding:11px 13px;display:flex;flex-direction:column;gap:7px">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                  <span style="font-size:13px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(st.title)}</span>
                  <span style="font-size:10.5px;color:var(--dim2);flex-shrink:0">${fmt(st.secs)} · ${esc(st.when)}</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                  ${statusChip(st.status)}
                  <button class="btn-quiet" style="font-size:10.5px;padding:2px 4px" data-action="athCapDelete" data-arg="${arg({ id: st.id })}">remove</button>
                </div>
                ${st.dataURL ? `<audio controls src="${esc(st.dataURL)}" style="width:100%;height:30px;border-radius:8px;filter:invert(0.92) hue-rotate(180deg)"></audio>` : ''}
              </div>`).join('')}
          </div>` : `<div style="text-align:center;font-size:11.5px;color:var(--dim);line-height:1.6;padding:0 20px 10px">
            Six stories from your gap report are queued — each one you capture becomes answers for every fan who asks.</div>`}

        </div>
      </div>`;
    },

    after() {
      const orb = document.querySelector('#cap-orb[data-ptt]');
      if (!orb) return;
      orb.addEventListener('pointerdown', e => { e.preventDefault(); window.Actions.athCapStart(); });
      orb.addEventListener('pointerup', () => window.Actions.athCapStop());
      orb.addEventListener('pointercancel', () => window.Actions.athCapStop());
      orb.addEventListener('pointerleave', () => { if (Store.get().athRec === 'rec') window.Actions.athCapStop(); });
    },
  };

  /* ---------- module actions ---------- */

  window.Actions.athCapSelect = function (a) {
    Store.set(s => { s.captureSel = a.id; s.athRec = 'idle'; });
  };

  // "don't ask me this" — retire the prompt; the pass itself is signal about her topics
  window.Actions.athCapPass = function (a) {
    Store.set(s => {
      s.passedPrompts = s.passedPrompts || [];
      if (!s.passedPrompts.includes(a.id)) s.passedPrompts.push(a.id);
      if (s.captureSel === a.id) s.captureSel = 'drop';
    });
    Actions.toast({ msg: 'Noted — we won’t push that one again.' });
  };

  window.Actions.athCapStart = function () {
    if (Store.get().athRec === 'rec') return;
    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      Actions.toast({ msg: 'Microphone unavailable in this browser.' });
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      micStream = stream;
      chunks = [];
      mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.start();
      recStart = performance.now();
      Store.set(s => { s.athRec = 'rec'; });
      clearInterval(recTimer);
      recTimer = setInterval(() => {
        const el = document.querySelector('[data-cap-time]');
        if (el) el.textContent = fmt((performance.now() - recStart) / 1000);
      }, 250);
    }).catch(() => {
      Actions.toast({ msg: 'Microphone blocked — allow mic access to capture.' });
    });
  };

  window.Actions.athCapStop = function () {
    if (Store.get().athRec !== 'rec' || !mr) return;
    clearInterval(recTimer);
    const secs = Math.max(1, Math.round((performance.now() - recStart) / 1000));
    const rec = mr;
    mr = null;
    rec.onstop = () => {
      stopTracks();
      const blob = new Blob(chunks, { type: (chunks[0] && chunks[0].type) || 'audio/webm' });
      if (take.url) { try { URL.revokeObjectURL(take.url); } catch (e) {} }
      take = { url: blob.size ? URL.createObjectURL(blob) : null, secs, dataURL: null };
      if (blob.size && blob.size < 250 * 1024) {
        const fr = new FileReader();
        fr.onload = () => { take.dataURL = fr.result; };
        try { fr.readAsDataURL(blob); } catch (e) {}
      }
      Store.set(s => { s.athRec = 'review'; });
    };
    try { rec.stop(); } catch (e) { stopTracks(); Store.set(s => { s.athRec = 'idle'; }); }
  };

  window.Actions.athCapDiscard = function () {
    if (take.url) { try { URL.revokeObjectURL(take.url); } catch (e) {} }
    take = { url: null, secs: 0, dataURL: null };
    Store.set(s => { s.athRec = 'idle'; });
  };

  window.Actions.athCapSave = function (a) {
    const sel = promptById(a.id);
    const secs = take.secs;
    const dataURL = take.dataURL && take.dataURL.length < 400000 ? take.dataURL : null;
    const sid = 'story-' + Date.now();
    if (sel.id === 'drop') {
      Store.set(s => {
        s.scheduled.unshift({ id: 'sch-' + Date.now(), slot: 'TOMORROW 7:00 AM', title: 'Voice drop — captured on the go', sub: 'Transcription queued · you approve before it ships', dur: fmt(secs) });
        s.stories = s.stories || [];
        s.stories.unshift({ id: sid, title: "Today's drop (voice)", secs, when: 'Just now', status: 'drop', dataURL });
        s.athRec = 'idle';
      });
      Actions.toast({ msg: 'Drop scheduled — it ships tomorrow at 7:00 AM ✓' });
    } else {
      Store.set(s => {
        s.stories = s.stories || [];
        s.stories.unshift({ id: sid, title: sel.title, secs, when: 'Just now', status: 'queued', dataURL });
        s.athRec = 'idle';
      });
      Actions.toast({ msg: 'Saved — transcribing into your knowledge base…' });
      // simulate the transcription pipeline finishing
      setTimeout(() => {
        Store.set(s => {
          const st = (s.stories || []).find(x => x.id === sid);
          if (st && st.status === 'queued') st.status = 'done';
        });
      }, 3200);
    }
    take = { url: null, secs: 0, dataURL: null };
  };

  window.Actions.athCapDelete = function (a) {
    Store.set(s => { s.stories = (s.stories || []).filter(x => x.id !== a.id); });
  };
})();

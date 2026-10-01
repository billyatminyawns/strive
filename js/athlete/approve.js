/* Athlete · Approve — swipe deck for the reply queue.
   Right = approve & send (fan hears it in Angela's voice) · Left = pass politely.
   Drag is pointer-based with rotate + stamp feedback; buttons mirror the gestures. */
(function () {
  'use strict';
  const { esc, arg, fmt, wave, playBtn, mono, tierBadge } = UI;
  window.Screens = window.Screens || {};

  const FLY_MS = 300;

  function card(q, i, total) {
    const draftId = 'draft:' + q.id;
    const dur = Player.estimate(q.draft, 1);
    const top = i === 0;
    return `<div data-swipe="${top ? q.id : ''}" style="position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;
        background:${top ? 'linear-gradient(150deg,#1A201B,#141715)' : 'var(--card)'};border:1px solid ${top ? '#273029' : 'var(--line)'};
        border-radius:22px;padding:20px 18px;box-shadow:0 18px 50px rgba(0,0,0,${top ? 0.45 : 0.2});
        transform:${top ? 'none' : `scale(${1 - i * 0.05}) translateY(${i * 16}px)`};
        opacity:${i > 1 ? 0 : 1 - i * 0.25};z-index:${10 - i};touch-action:none;will-change:transform;
        transition:transform 0.25s ease, opacity 0.25s ease">

      <div data-stamp="send" style="position:absolute;top:22px;left:18px;transform:rotate(-11deg);opacity:0;pointer-events:none;
        border:3px solid var(--mint);color:var(--mint);border-radius:10px;padding:5px 13px;font-size:19px;font-weight:900;letter-spacing:0.12em">SEND IT</div>
      <div data-stamp="pass" style="position:absolute;top:22px;right:18px;transform:rotate(11deg);opacity:0;pointer-events:none;
        border:3px solid var(--papaya);color:var(--papaya);border-radius:10px;padding:5px 13px;font-size:19px;font-weight:900;letter-spacing:0.12em">PASS</div>

      <div style="display:flex;align-items:center;gap:10px">
        ${mono(q.avatar, 34, q.color, 13)}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:800">${esc(q.from)}</div>
          <div style="font-size:10.5px;color:var(--faint)">${esc(q.ago)}${q.similar ? ` · ${q.similar} asked similar` : ''}</div>
        </div>
        ${tierBadge(q.tier)}
      </div>

      <div style="font-size:17.5px;font-weight:700;line-height:1.45">"${esc(q.text)}"</div>

      <div style="border-top:1px solid var(--line);padding-top:11px;display:flex;flex-direction:column;gap:8px;flex:1;min-height:0">
        <span class="k-label" style="font-size:10px;color:var(--lav)">${q.brain ? 'COACH ANGELA DRAFT · FROM YOUR RECORD' : (q.aiDrafted ? 'AI DRAFT · CLAUDE' : 'AI DRAFT') + ' · FROM YOUR PAST ANSWERS'}</span>
        ${q.brain && q.brain.reason ? `<div style="font-size:10.5px;color:var(--dim2);line-height:1.4">${esc(q.brain.reason)}</div>` : ''}
        <div style="font-size:13px;color:var(--sub2);line-height:1.6;overflow:hidden;flex:1;min-height:0;
          -webkit-mask-image:linear-gradient(180deg,#000 72%,transparent);mask-image:linear-gradient(180deg,#000 72%,transparent)">${esc(q.draft)}</div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;background:rgba(11,12,11,0.45);border:1px solid var(--line2);border-radius:12px;padding:9px 12px">
        ${playBtn({ id: draftId }, 34)}
        <div style="flex:1">${wave(draftId, 16, 18)}</div>
        <span style="font-size:10.5px;color:var(--dim2)"><span data-dur-for="${draftId}">${fmt(dur)}</span> · your voice</span>
      </div>

      ${top ? `<div style="text-align:center;font-size:10.5px;color:var(--dim)">← pass&nbsp;&nbsp;·&nbsp;&nbsp;send →</div>` : ''}
    </div>`;
  }

  /* in-app editor — typing edits + a voice note the AI weaves in (no desktop required) */
  function editor(s) {
    const ed = s.athEdit;
    const q = s.inbox.find(x => x.id === ed.id);
    if (!q) return '';
    const rec = s.athEditRec || 'idle';
    return `<div class="p-scroll" style="padding:64px 18px 8px">
      <div style="display:flex;flex-direction:column;gap:13px">
        <div style="display:flex;align-items:center;gap:10px">
          <button style="background:none;border:none;padding:0;display:flex" data-action="athEditCancel" aria-label="Back">${UI.icon.back}</button>
          <div style="font-size:18px;font-weight:800">Edit reply</div>
        </div>

        <div class="card2" style="padding:12px 14px;display:flex;flex-direction:column;gap:4px">
          <span class="k-label" style="font-size:9.5px;color:var(--dim2)">${esc(q.from.toUpperCase())} ASKED</span>
          <div style="font-size:13.5px;font-weight:700;line-height:1.45">"${esc(q.text)}"</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:7px">
          <span class="k-label" style="font-size:10px;color:var(--lav)">YOUR REPLY — TYPE OR TALK, SHIPS IN YOUR VOICE</span>
          <textarea class="field-dark" id="ath-edit-text" data-keep="ath-edit" data-input-action="athEditTyping"
            style="width:100%;min-height:150px;resize:vertical;line-height:1.55;font-size:13px;border-radius:12px;padding:12px 13px">${esc(ed.text)}</textarea>
        </div>

        ${ed.note
          ? `<div class="card2" style="border-color:var(--chip-line);padding:11px 13px;display:flex;align-items:center;gap:10px">
              <span style="font-size:16px">🎙</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:12.5px;font-weight:700">Voice note attached · ${fmt(ed.note.secs)}</div>
                <div style="font-size:10.5px;color:var(--dim2);margin-top:1px">Your Coach weaves it in before this ships.</div>
              </div>
              <button class="btn-quiet" style="font-size:11px" data-action="athEditNoteDrop">remove</button>
            </div>`
          : `<div class="card2" style="padding:11px 13px;display:flex;align-items:center;gap:11px">
              ${rec === 'rec'
                ? `<button id="ath-note-orb" data-action="athEditNoteStop"
                    style="width:44px;height:44px;border-radius:50%;background:var(--red);border:none;display:flex;align-items:center;justify-content:center;animation:livepulse 1.4s infinite;flex-shrink:0">${UI.icon.mic('#141614', 16)}</button>`
                : `<button id="ath-note-orb" data-ptt-note="1"
                    style="width:44px;height:44px;border-radius:50%;background:var(--chip-bg);border:1.5px solid var(--chip-line);display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:none">${UI.icon.mic('var(--mint)', 16)}</button>`}
              <div style="flex:1;min-width:0">
                <div style="font-size:12.5px;font-weight:700">${rec === 'rec' ? 'Recording — release to attach' : "Don't feel like typing?"}</div>
                <div style="font-size:10.5px;color:var(--dim2);margin-top:1px">Hold and say what to change — "mention I got cut at sixteen too" — the AI folds it in.</div>
              </div>
            </div>`}

        <div style="display:flex;gap:9px;margin-top:2px">
          <button class="btn btn-mint" style="flex:1;padding:13px 0" data-action="athEditSave">Save & approve →</button>
          <button class="btn btn-ghost" style="padding:13px 16px" data-action="athEditCancel">Cancel</button>
        </div>
        <button style="background:none;border:none;padding:6px 0 12px;font-size:12px;font-weight:700;color:var(--papaya)" data-action="athEditDelete">Delete — I don't want to answer this one</button>
      </div>
    </div>`;
  }

  Screens['athlete/approve'] = {
    tab: 'approve',
    render(s) {
      if (s.athEdit) return editor(s);
      const queue = s.inbox.filter(q => q.status === 'draft');
      const done = s.athApproved || 0;

      if (!queue.length) {
        return `<div class="p-scroll" style="padding:70px 18px 8px">
          <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding-top:90px">
            <div style="width:84px;height:84px;border-radius:50%;background:var(--chip-bg);border:1.5px solid var(--chip-line);display:flex;align-items:center;justify-content:center" class="popin">
              ${UI.icon.check('var(--mint)', 34)}
            </div>
            <div style="font-size:22px;font-weight:800">Queue clear</div>
            <div style="font-size:13px;color:var(--sub);line-height:1.6;max-width:280px">Every reply that needed your voice is out the door${done ? ` — ${done} approved this session` : ''}. ${s.inboxExtra} routine ones are drafted — review them here whenever.</div>
            <button class="btn btn-mint" style="margin-top:8px" data-action="nav" data-arg="${arg('#/athlete/capture')}">Capture a story instead</button>
            <button class="btn-quiet" style="font-size:12px" data-action="nav" data-arg="${arg('#/athlete/home')}">Back to Today</button>
          </div>
        </div>`;
      }

      return `<div style="flex:1;display:flex;flex-direction:column;padding:64px 18px 10px;min-height:0">
        <div style="display:flex;align-items:baseline;justify-content:space-between;padding:4px 2px 12px">
          <div style="font-size:20px;font-weight:800">Approve</div>
          <div style="font-size:11px;color:var(--dim2)">${queue.length} waiting · ${s.inboxExtra} more drafted</div>
        </div>

        <div style="position:relative;flex:1;min-height:0;max-height:520px" id="swipe-deck">
          ${queue.slice(0, 3).map((q, i) => card(q, i, queue.length)).reverse().join('')}
        </div>

        <div style="display:flex;align-items:flex-start;justify-content:center;gap:26px;padding:16px 0 6px">
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
            <button data-action="athSwipePass" data-arg="${arg({ id: queue[0].id })}" aria-label="Delete — no reply sent"
              style="width:54px;height:54px;border-radius:50%;background:none;border:1.5px solid #3A2E28;color:var(--papaya);font-size:20px;font-weight:800;display:flex;align-items:center;justify-content:center">✕</button>
            <span style="font-size:10px;color:var(--dim)">delete</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
            <button data-action="athEditOpen" data-arg="${arg({ id: queue[0].id })}" aria-label="Edit this reply"
              style="width:54px;height:54px;border-radius:50%;background:none;border:1.5px solid var(--line2);color:#D7DDD8;display:flex;align-items:center;justify-content:center">
              <svg width="18" height="18" viewBox="0 0 18 18"><path d="M2.5 13.2l-.7 3 3-.7 9.4-9.4a1.6 1.6 0 00-2.3-2.3L2.5 13.2z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>
            <span style="font-size:10px;color:var(--dim)">edit</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
            <button data-action="athSwipeApprove" data-arg="${arg({ id: queue[0].id })}" aria-label="Approve and send"
              style="width:66px;height:66px;border-radius:50%;background:var(--mint);border:none;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(124,226,165,0.3)">${UI.icon.check('var(--ink)', 24)}</button>
            <span style="font-size:10px;color:var(--dim)">approve</span>
          </div>
        </div>
      </div>`;
    },

    after(s) {
      // editor view: bind the hold-to-talk voice-note orb (release is handled window-level —
      // the re-render replaces this element mid-hold, so element pointerup never fires on mouse)
      const noteOrb = document.querySelector('#ath-note-orb[data-ptt-note]');
      if (noteOrb) {
        noteOrb.addEventListener('pointerdown', e => { e.preventDefault(); window.Actions.athEditNoteStart(); });
      }
      const deck = document.getElementById('swipe-deck');
      if (!deck) return;
      const cardEl = deck.querySelector('[data-swipe]:not([data-swipe=""])');
      if (!cardEl) return;
      const qid = cardEl.dataset.swipe;
      let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;

      const stamps = {
        send: cardEl.querySelector('[data-stamp="send"]'),
        pass: cardEl.querySelector('[data-stamp="pass"]'),
      };

      function setDrag(on) {
        cardEl.style.transition = on ? 'none' : 'transform 0.25s ease, opacity 0.25s ease';
      }
      function apply() {
        cardEl.style.transform = `translate(${dx}px, ${dy * 0.25}px) rotate(${dx / 14}deg)`;
        if (stamps.send) stamps.send.style.opacity = dx > 0 ? Math.min(1, dx / 90) : 0;
        if (stamps.pass) stamps.pass.style.opacity = dx < 0 ? Math.min(1, -dx / 90) : 0;
      }

      cardEl.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;   // don't hijack the play button
        dragging = true; startX = e.clientX; startY = e.clientY; dx = 0; dy = 0;
        setDrag(true);
        try { cardEl.setPointerCapture(e.pointerId); } catch (err) {}
      });
      cardEl.addEventListener('pointermove', e => {
        if (!dragging) return;
        dx = e.clientX - startX; dy = e.clientY - startY;
        apply();
      });
      function release() {
        if (!dragging) return;
        dragging = false;
        if (dx > 110) window.Actions.athFly(qid, 1, cardEl);
        else if (dx < -110) window.Actions.athFly(qid, -1, cardEl);
        else { setDrag(false); dx = 0; dy = 0; apply(); }
      }
      cardEl.addEventListener('pointerup', release);
      cardEl.addEventListener('pointercancel', release);
    },
  };

  /* ---------- module actions ---------- */

  // animate the top card off-screen, then commit the decision
  window.Actions.athFly = function (qid, dir, el) {
    const cardEl = el || document.querySelector(`[data-swipe="${qid}"]`);
    if (cardEl) {
      cardEl.style.transition = `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`;
      cardEl.style.transform = `translate(${dir * 580}px, ${dir * -40}px) rotate(${dir * 26}deg)`;
      cardEl.style.opacity = '0';
    }
    setTimeout(() => {
      const q = Store.get().inbox.find(x => x.id === qid);
      if (!q || q.status !== 'draft') return;
      if (dir > 0) {
        Store.silent(s => { s.athApproved = (s.athApproved || 0) + 1; });
        Actions.approve({ id: qid });   // sends, learns, renders voice, re-renders
        Actions.toast({ msg: `Sent to ${q.from.split(' ')[0]} — they hear it in your voice ✓` });
      } else {
        Actions.decline({ id: qid });
        Actions.toast({ msg: 'Passed politely — no reply sent.' });
      }
    }, FLY_MS - 40);
  };

  window.Actions.athSwipeApprove = function (a) { Actions.athFly(a.id, 1); };
  window.Actions.athSwipePass = function (a) { Actions.athFly(a.id, -1); };

  /* ---------- in-app editor actions ---------- */

  let noteMr = null, noteChunks = [], noteStream = null, noteStart = 0, noteHoldReleased = false;
  function noteStopTracks() {
    if (noteStream) { noteStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); noteStream = null; }
  }
  // hard-stop everything mic-related — safe to call from any state
  function noteKill() {
    if (noteMr) { try { noteMr.ondataavailable = null; noteMr.onstop = null; noteMr.stop(); } catch (e) {} noteMr = null; }
    noteStopTracks();
  }

  // release is global: the orb gets replaced mid-hold by the rec-state re-render, so an
  // element-bound pointerup never fires on mouse (no implicit capture) — listen on window.
  ['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, () => {
    noteHoldReleased = true;
    if (window.Store && Store.get().athEditRec === 'rec') window.Actions.athEditNoteStop();
  }));

  // reset demo must never leave a mic hot
  window.__resetHooks = window.__resetHooks || [];
  window.__resetHooks.push(noteKill);

  window.Actions.athEditOpen = function (a) {
    const q = Store.get().inbox.find(x => x.id === a.id);
    if (!q || q.status !== 'draft') return;   // a swipe may already be mid-flight on this card
    Store.set(s => { s.athEdit = { id: q.id, text: q.draft, note: null }; s.athEditRec = 'idle'; });
  };

  // keep typing in module state so note-attach re-renders don't lose edits
  window.Actions.athEditTyping = function (value) {
    Store.silent(s => { if (s.athEdit) s.athEdit.text = value; });
  };

  window.Actions.athEditNoteStart = function () {
    if (Store.get().athEditRec === 'rec') return;
    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      Actions.toast({ msg: 'Microphone unavailable in this browser.' });
      return;
    }
    noteHoldReleased = false;   // set on pointerdown; a release before the mic resolves aborts cleanly
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      if (noteHoldReleased || !Store.get().athEdit) {   // quick tap, or editor closed while permission was pending
        stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
        return;
      }
      noteStream = stream; noteChunks = [];
      noteMr = new MediaRecorder(stream);
      noteMr.ondataavailable = e => { if (e.data && e.data.size) noteChunks.push(e.data); };
      noteMr.start();
      noteStart = performance.now();
      Store.set(s => { s.athEditRec = 'rec'; });
    }).catch(() => Actions.toast({ msg: 'Microphone blocked — allow mic access to add a note.' }));
  };

  window.Actions.athEditNoteStop = function () {
    if (Store.get().athEditRec !== 'rec' || !noteMr) return;
    const secs = Math.max(1, Math.round((performance.now() - noteStart) / 1000));
    const rec = noteMr;
    noteMr = null;
    rec.onstop = () => {
      noteStopTracks();
      Store.set(s => {
        if (s.athEdit) s.athEdit.note = { secs };
        s.athEditRec = 'idle';
      });
      Actions.toast({ msg: 'Note attached — it ships woven into the reply ✓' });
    };
    try { rec.stop(); } catch (e) { noteStopTracks(); Store.set(s => { s.athEditRec = 'idle'; }); }
  };

  window.Actions.athEditNoteDrop = function () {
    Store.set(s => { if (s.athEdit) s.athEdit.note = null; });
  };

  window.Actions.athEditSave = function () {
    noteKill();   // saving while a note records must not leave the mic hot
    const s0 = Store.get();
    const ed = s0.athEdit;
    if (!ed) return;
    const q = s0.inbox.find(x => x.id === ed.id);
    if (q && q.status !== 'draft') {   // handled elsewhere (swipe/desktop) while the editor was open
      Store.set(s => { s.athEdit = null; s.athEditRec = 'idle'; });
      Actions.toast({ msg: 'Already handled — this one went out from another screen.' });
      return;
    }
    const text = String(ed.text || '').trim();
    if (!q || !text) { Actions.toast({ msg: 'The reply can’t be empty.' }); return; }
    const edited = text !== q.draft;
    const noted = !!ed.note;
    Store.silent(s => {
      const qq = s.inbox.find(x => x.id === ed.id);
      if (qq) qq.draft = text;
      s.athApproved = (s.athApproved || 0) + 1;
      s.athEdit = null; s.athEditRec = 'idle';
    });
    Actions.approve({ id: ed.id });   // sends, learns, renders voice, re-renders
    Actions.toast({ msg: noted ? 'Sent with your note woven in ✓' : edited ? 'Sent — edited on your phone ✓' : 'Sent ✓' });
  };

  window.Actions.athEditDelete = function () {
    noteKill();
    const s0 = Store.get();
    const ed = s0.athEdit;
    if (!ed) return;
    const q = s0.inbox.find(x => x.id === ed.id);
    const wasDraft = q && q.status === 'draft';
    Store.silent(s => { s.athEdit = null; s.athEditRec = 'idle'; });
    if (wasDraft) { Actions.decline({ id: ed.id }); Actions.toast({ msg: 'Deleted — no reply sent.' }); }
    else { App.render(); Actions.toast({ msg: 'Already handled — this one went out from another screen.' }); }
  };

  window.Actions.athEditCancel = function () {
    noteKill();
    Store.set(s => { s.athEdit = null; s.athEditRec = 'idle'; });
  };
})();

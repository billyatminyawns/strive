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
        <span class="k-label" style="font-size:10px;color:var(--lav)">${q.aiDrafted ? 'AI DRAFT · CLAUDE' : 'AI DRAFT'} · FROM YOUR PAST ANSWERS</span>
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

  Screens['athlete/approve'] = {
    tab: 'approve',
    render(s) {
      const queue = s.inbox.filter(q => q.status === 'draft');
      const done = s.athApproved || 0;

      if (!queue.length) {
        return `<div class="p-scroll" style="padding:70px 18px 8px">
          <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding-top:90px">
            <div style="width:84px;height:84px;border-radius:50%;background:var(--chip-bg);border:1.5px solid var(--chip-line);display:flex;align-items:center;justify-content:center" class="popin">
              ${UI.icon.check('var(--mint)', 34)}
            </div>
            <div style="font-size:22px;font-weight:800">Queue clear</div>
            <div style="font-size:13px;color:var(--sub);line-height:1.6;max-width:280px">Every reply that needed your voice is out the door${done ? ` — ${done} approved this session` : ''}. ${s.inboxExtra} routine ones are drafted for desktop review.</div>
            <button class="btn btn-mint" style="margin-top:8px" data-action="nav" data-arg="${arg('#/athlete/capture')}">Capture a story instead</button>
            <button class="btn-quiet" style="font-size:12px" data-action="nav" data-arg="${arg('#/athlete/home')}">Back to Today</button>
          </div>
        </div>`;
      }

      return `<div style="flex:1;display:flex;flex-direction:column;padding:64px 18px 10px;min-height:0">
        <div style="display:flex;align-items:baseline;justify-content:space-between;padding:4px 2px 12px">
          <div style="font-size:20px;font-weight:800">Approve</div>
          <div style="font-size:11px;color:var(--dim2)">${queue.length} waiting · ${s.inboxExtra} more on desktop</div>
        </div>

        <div style="position:relative;flex:1;min-height:0;max-height:520px" id="swipe-deck">
          ${queue.slice(0, 3).map((q, i) => card(q, i, queue.length)).reverse().join('')}
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:26px;padding:16px 0 6px">
          <button data-action="athSwipePass" data-arg="${arg({ id: queue[0].id })}" aria-label="Pass"
            style="width:54px;height:54px;border-radius:50%;background:none;border:1.5px solid #3A2E28;color:var(--papaya);font-size:20px;font-weight:800;display:flex;align-items:center;justify-content:center">✕</button>
          <button data-action="athSwipeApprove" data-arg="${arg({ id: queue[0].id })}" aria-label="Approve and send"
            style="width:66px;height:66px;border-radius:50%;background:var(--mint);border:none;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(124,226,165,0.3)">${UI.icon.check('var(--ink)', 24)}</button>
          <button class="btn-quiet" data-action="reviewInbox" data-arg="${arg({ id: queue[0].id })}"
            style="width:54px;font-size:10.5px;line-height:1.3;color:var(--dim)">edit on desktop</button>
        </div>
      </div>`;
    },

    after(s) {
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
})();

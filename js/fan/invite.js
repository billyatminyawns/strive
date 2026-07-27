/* Fan · Invite — invite-only gate (mockup 07) */
(function () {
  'use strict';
  const { esc, arg, ava } = UI;

  window.Screens = window.Screens || {};

  const CODE = ['A', 'N', 'G', 'E', 'L', 'A'];

  Screens['fan/invite'] = {
    noTabbar: true,
    render(s) {
      const other = !!s.inviteOther;
      const err = !!s.inviteErr;

      // the gate: either the six ANGELA boxes + her-code button, or a real code input
      let gate;
      if (other) {
        gate = `
        <style>@keyframes invShake{0%,100%{transform:translateX(0)}18%{transform:translateX(-8px)}36%{transform:translateX(7px)}54%{transform:translateX(-5px)}72%{transform:translateX(4px)}90%{transform:translateX(-2px)}}</style>

        <input class="field-dark" id="invite-code-input" data-keep="invite-code"
          data-enter-action="invSubmit" data-input-action="invTyping"
          maxlength="12" placeholder="ENTER CODE" autocomplete="off" autocapitalize="characters" spellcheck="false"
          style="width:100%;margin-top:26px;text-align:center;text-transform:uppercase;letter-spacing:0.28em;font-size:16px;font-weight:800;border-radius:12px;padding:14px 16px;${err ? 'border-color:var(--papaya);animation:invShake 0.42s' : ''}">

        <button class="btn btn-mint" style="width:100%;margin-top:14px;border-radius:12px;padding:14px 0;font-size:14.5px"
          data-action="invUnlock">Unlock</button>

        <button data-action="invBack"
          style="background:none;border:none;padding:0;font-size:12.5px;font-weight:700;color:var(--mint);margin-top:14px">Back to Angela’s code</button>`;
      } else {
        const boxes = CODE.map((ch, i) => {
          const last = i === CODE.length - 1;
          return `<span class="fadeup" style="width:42px;height:50px;border:1px solid ${last ? 'var(--mint)' : 'var(--chip-line)'};border-radius:10px;background:${last ? 'var(--chip-bg)' : 'var(--card)'};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;${last ? 'color:var(--mint);' : ''}animation-delay:${(i * 0.07).toFixed(2)}s">${esc(ch)}</span>`;
        }).join('');

        gate = `
        <div style="display:flex;gap:8px;margin-top:26px">${boxes}</div>

        <button class="btn btn-mint" style="width:100%;margin-top:22px;border-radius:12px;padding:14px 0;font-size:14.5px"
          data-action="unlock">Unlock with her code</button>

        <button data-action="invOther"
          style="background:none;border:none;padding:0;font-size:12.5px;font-weight:700;color:var(--mint);margin-top:14px">Have a different code?</button>`;
      }

      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;background:radial-gradient(120% 70% at 50% 0%,#182019 0%,#0F1110 60%);color:var(--txt);padding:110px 30px 44px">

        <div style="display:flex;align-items:baseline;gap:8px">
          <span style="font-size:30px;font-weight:900;letter-spacing:0.16em">STRIVE</span>
          <span style="width:11px;height:11px;background:var(--mint);display:inline-block"></span>
        </div>

        <div style="margin-top:40px">${ava(Data.IMG.head, 118)}</div>

        <div style="font-size:23px;font-weight:800;margin-top:20px">Angela invited you</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-top:8px">Strive is invite-only while the first athletes build their rooms. Every member arrives through an athlete.</div>

        ${gate}

        <div style="margin-top:auto;font-size:11px;color:var(--dim);line-height:1.6;padding-bottom:12px">Athletes sharing their code is the launch — no ads, no store. Discovery opens in phase two.</div>

      </div>`;
    },
  };

  /* ---------- module-local actions ---------- */

  // swap the ANGELA boxes for a real code field
  window.Actions.invOther = function () {
    Store.set(s => { s.inviteOther = true; s.inviteErr = false; });
  };

  // back to the pre-filled ANGELA path
  window.Actions.invBack = function () {
    Store.set(s => { s.inviteOther = false; s.inviteErr = false; });
  };

  // clear the error styling the moment the fan starts fixing the code (no re-render)
  window.Actions.invTyping = function (value, el) {
    if (el) { el.style.animation = ''; el.style.borderColor = ''; }
    Store.silent(s => { if (s.inviteErr) s.inviteErr = false; });
  };

  // Unlock button reads the field, then runs the same check as Enter
  window.Actions.invUnlock = function () {
    const el = document.getElementById('invite-code-input');
    Actions.invSubmit(el ? el.value : '', el);
  };

  // validate a typed code: ANGELA / MARCUS3 unlock; anything else shakes + toasts
  window.Actions.invSubmit = function (value) {
    const code = String(value || '').trim().toUpperCase();
    if (!code) return;
    if (code === 'ANGELA' || code === 'MARCUS3') { Actions.unlock(); return; }
    Store.set(s => { s.inviteErr = true; });
    Actions.toast({ msg: 'That code isn’t active in this demo — try ANGELA.' });
  };
})();

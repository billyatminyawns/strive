/* Fan · Invite — invite-only gate (mockup 07) */
(function () {
  'use strict';
  const { esc, arg, ava } = UI;

  window.Screens = window.Screens || {};

  const CODE = ['A', 'N', 'G', 'E', 'L', 'A'];

  Screens['fan/invite'] = {
    noTabbar: true,
    render(s) {
      const boxes = CODE.map((ch, i) => {
        const last = i === CODE.length - 1;
        return `<span class="fadeup" style="width:42px;height:50px;border:1px solid ${last ? 'var(--mint)' : 'var(--chip-line)'};border-radius:10px;background:${last ? 'var(--chip-bg)' : 'var(--card)'};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;${last ? 'color:var(--mint);' : ''}animation-delay:${(i * 0.07).toFixed(2)}s">${esc(ch)}</span>`;
      }).join('');

      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;background:radial-gradient(120% 70% at 50% 0%,#182019 0%,#0F1110 60%);color:var(--txt);padding:110px 30px 44px">

        <div style="display:flex;align-items:baseline;gap:8px">
          <span style="font-size:30px;font-weight:900;letter-spacing:0.16em">STRIVE</span>
          <span style="width:11px;height:11px;background:var(--mint);display:inline-block"></span>
        </div>

        <div style="margin-top:40px">${ava(Data.IMG.head, 118)}</div>

        <div style="font-size:23px;font-weight:800;margin-top:20px">Angela invited you</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-top:8px">Strive is invite-only while the first athletes build their rooms. Every member arrives through an athlete.</div>

        <div style="display:flex;gap:8px;margin-top:26px">${boxes}</div>

        <button class="btn btn-mint" style="width:100%;margin-top:22px;border-radius:12px;padding:14px 0;font-size:14.5px"
          data-action="unlock">Unlock with her code</button>

        <button data-action="toast" data-arg="${arg({ msg: 'This demo unlocks with Angela’s code — tap “Unlock with her code” above.' })}"
          style="background:none;border:none;padding:0;font-size:12.5px;font-weight:700;color:var(--mint);margin-top:14px">Have a different code?</button>

        <div style="margin-top:auto;font-size:11px;color:var(--dim);line-height:1.6;padding-bottom:12px">Athletes sharing their code is the launch — no ads, no store. Discovery opens in phase two.</div>

      </div>`;
    },
  };
})();

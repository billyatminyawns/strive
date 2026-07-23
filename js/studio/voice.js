/* Studio · Voice Studio — voice model, delivery sliders, guardrails (mockup 10) */
(function () {
  'use strict';
  const { esc, arg, fmt, wave, playBtn, slider, toggle } = UI;

  window.Screens = window.Screens || {};

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
                  <div style="font-size:12px;color:var(--sub);margin-top:3px">Built from 52 minutes of studio recording · updated May 2026</div>
                </div>
                <span style="font-size:10.5px;letter-spacing:0.1em;font-weight:800;color:var(--mint);border:1px solid var(--chip-line);border-radius:999px;padding:5px 11px">VOICE BY WELLSAID</span>
              </div>
              <div>${wave(null, 60, 40, '#3C463E', 5)}</div>
              <div style="display:flex;gap:10px">
                <button class="btn btn-ghost" style="border-radius:9px;padding:9px 14px;font-size:12px;font-weight:700" data-action="toast" data-arg="${arg({ msg: 'Re-recording isn’t wired in this concept demo.' })}">Re-record source lines</button>
                <button class="btn btn-ghost" style="border-radius:9px;padding:9px 14px;font-size:12px;font-weight:700" data-action="toast" data-arg="${arg({ msg: 'Pronunciation library isn’t wired in this concept demo.' })}">Pronunciation library</button>
                <button class="btn btn-ghost" style="border-radius:9px;padding:9px 14px;font-size:12px;font-weight:700"
                  data-action="nav" data-arg="${arg('#/studio/scan')}">View onboarding scan</button>
              </div>
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
              <div style="font-size:11.5px;color:var(--dim2);margin-top:3px;line-height:1.5">Angela's voice never says anything she hasn't written or approved.</div>
            </div>
            ${guardRow('Approve every reply before it sends', 'Required for personal replies', 'review', s.guards.review)}
            ${guardRow('Stick to approved topics', 'Hockey · leadership · career · training', 'topics', s.guards.topics)}
            ${guardRow('Auto-decline sensitive asks', 'Medical, betting & legal questions get a polite pass', 'decline', s.guards.decline)}
            <div style="background:var(--screen);border:1px solid var(--line2);border-radius:12px;padding:13px 15px;font-size:11.5px;color:var(--sub);line-height:1.6;margin-top:auto">Every generated clip is watermarked and logged. Angela can revoke her voice model at any time — it's hers, contractually and technically.</div>
          </div>
        </div>`;
    },
  };
})();

/* Studio · Onboarding scan — the profile pre-builds itself (walkthrough scene S6 "AI Scan") */
(function () {
  'use strict';
  const { esc, arg } = UI;
  window.Screens = window.Screens || {};

  const ITEMS = [
    '247 interviews, podcasts & press clips indexed',
    'Career stats & milestones compiled',
    'Draft Q&A knowledge base — 312 answers',
    "Gap report — 6 stories she's never told publicly",
    'Avatar & bio assembled for her review',
  ];

  Screens['studio/scan'] = {
    url: 'onboarding/scan',
    render(s) {
      const run = s.scanRun || 0; // bump to replay the animation
      return `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div class="k-label" style="font-size:12px;letter-spacing:0.2em;color:var(--mint)">ATHLETE ONBOARDING · DEEP AI SCAN</div>
            <div style="font-size:26px;font-weight:800;margin-top:8px">The profile builds itself</div>
          </div>
          <button class="btn btn-mint" data-action="rerunScan">Re-run scan</button>
        </div>

        <div class="card" data-scan="${run}" style="padding:26px;display:flex;flex-direction:column;gap:22px;max-width:900px">
          <div style="display:flex;gap:28px;align-items:center">
            <div style="position:relative;width:150px;height:150px;flex-shrink:0">
              <img src="${Data.IMG.head}" alt="" style="width:150px;height:150px;border-radius:50%;object-fit:cover;object-position:50% 18%;border:3px solid var(--mint);box-sizing:border-box">
              <div class="scan-beam" style="position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none">
                <div style="position:absolute;left:0;right:0;height:3px;background:var(--mint);box-shadow:0 0 18px 6px rgba(124,226,165,0.55);animation:scanline 2.2s ease-in-out ${run ? '3' : '2'}"></div>
              </div>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:13px">
              ${ITEMS.map((label, i) => `
                <div class="fadeup" style="display:flex;align-items:center;gap:12px;animation-delay:${(i * 0.28).toFixed(2)}s">
                  <div style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--mint)">
                    ${UI.icon.check('var(--ink)', 12)}
                  </div>
                  <span style="font-size:16px;font-weight:600;color:#D7DDD8">${esc(label)}</span>
                </div>`).join('')}
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--sub)">
              <span>Profile ready — Angela reviews &amp; edits before launch</span>
              <span style="color:var(--mint)" data-scan-pct>100%</span>
            </div>
            <div class="progress" style="height:6px;margin-top:9px"><div data-scan-bar style="width:0%;transition:width 1.4s cubic-bezier(.2,.7,.2,1)"></div></div>
          </div>

          <div style="display:flex;align-items:center;gap:18px;border-top:1px solid var(--line);padding-top:20px">
            <span class="k-label" style="font-size:12px;letter-spacing:0.16em;color:var(--faint)">SCAN SERVICED BY</span>
            <div style="background:#F4F7F5;border-radius:14px;padding:10px 18px;display:flex;align-items:center">
              <img src="${Data.IMG.ciLogo}" alt="Continuity Intelligence" style="height:44px;display:block">
            </div>
            <span style="font-size:14px;color:var(--sub);font-weight:600">Continuity Intelligence · Forever Accurate Learning</span>
          </div>
        </div>

        <div style="font-size:11.5px;color:var(--faint);max-width:760px;line-height:1.6">Scope set by Angela · off-limits topics excluded · everything reviewed before launch.</div>`;
    },
    after() {
      const bar = document.querySelector('[data-scan-bar]');
      if (bar) requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '100%'; }));
    },
  };

  window.Actions.rerunScan = function () { Store.set(s => { s.scanRun = (s.scanRun || 0) + 1; }); };
})();

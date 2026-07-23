/* Studio · Earnings — revenue, tier split, payout history (system-matched; no mockup) */
(function () {
  'use strict';
  const { esc } = UI;
  window.Screens = window.Screens || {};

  function stat(val, label, delta, mint) {
    return `<div style="border-left:2px solid var(--lav);padding-left:14px">
      <div style="font-size:27px;font-weight:900">${esc(val)}</div>
      <div class="k-label" style="font-size:10.5px;letter-spacing:0.12em;color:var(--sub);margin-top:3px">${esc(label)}</div>
      <div style="font-size:11.5px;color:${mint ? 'var(--mint)' : 'var(--dim2)'};font-weight:${mint ? 700 : 600};margin-top:3px">${esc(delta)}</div>
    </div>`;
  }

  const MONTHS = [
    ['Feb', 18.1], ['Mar', 22.4], ['Apr', 26.0], ['May', 29.8], ['Jun', 34.1], ['Jul', 38.2],
  ];
  const MAX = 40;
  const TIERS = [
    ['All-Access', '$21.9K', 57], ['Inner Circle', '$12.1K', 32], ['Rookie', '$4.2K', 11],
  ];
  const PAYOUTS = [
    ['Jul 1', '$27.3K'], ['Jun 1', '$24.6K'], ['May 1', '$21.8K'], ['Apr 1', '$18.7K'],
  ];

  Screens['studio/earnings'] = {
    url: 'earnings',
    render() {
      return `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:23px;font-weight:800">Earnings</div>
          <span class="pill" style="border:1px solid var(--chip-line);color:var(--mint);padding:8px 15px;font-size:12px;font-weight:800">Payouts to: •••• 4417</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:22px">
          ${stat('$38.2K', 'THIS MONTH', '+12% vs June', true)}
          ${stat('$30.5K', 'YOUR SHARE', 'athletes keep 80%', false)}
          ${stat('$214K', 'LIFETIME', 'since March 2026', false)}
          ${stat('Aug 1', 'NEXT PAYOUT', 'auto · monthly', false)}
        </div>

        <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:22px">
          <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:16px">
            <div style="font-size:14.5px;font-weight:800">Revenue — last 6 months</div>
            <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:14px;height:170px;padding-top:14px">
              ${MONTHS.map((m, i) => {
                const last = i === MONTHS.length - 1;
                const h = Math.round((m[1] / MAX) * 130);
                return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:flex-end">
                  <div style="font-size:10px;color:var(--dim2);font-weight:700">$${m[1].toFixed(1)}K</div>
                  <div style="width:100%;max-width:46px;height:${h}px;background:var(--mint);opacity:${last ? 1 : 0.42};border-radius:6px 6px 0 0"></div>
                  <div style="font-size:11px;color:${last ? 'var(--txt)' : 'var(--faint)'};font-weight:${last ? 700 : 600}">${esc(m[0])}</div>
                </div>`;
              }).join('')}
            </div>
          </div>
          <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px">
            <div style="font-size:14.5px;font-weight:800">Revenue by tier</div>
            <div style="display:flex;flex-direction:column;gap:14px">
              ${TIERS.map(t => `<div>
                <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="font-weight:700">${esc(t[0])}</span><span style="color:var(--dim2)">${esc(t[1])}</span></div>
                <div class="progress" style="margin-top:6px"><div style="width:${t[2]}%"></div></div>
              </div>`).join('')}
            </div>
            <div style="font-size:11px;color:var(--faint);margin-top:auto">Inner Circle is 7% of members and 32% of revenue.</div>
          </div>
        </div>

        <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:12px">
          <div style="font-size:14.5px;font-weight:800">Payout history</div>
          ${PAYOUTS.map((p, i) => `
            <div style="display:flex;align-items:center;gap:14px;${i < PAYOUTS.length - 1 ? 'border-bottom:1px solid #1D221E;padding-bottom:12px' : ''}">
              <span style="font-size:12.5px;font-weight:700;width:60px;flex-shrink:0">${esc(p[0])}</span>
              <span style="flex:1;font-size:13px;font-weight:800">${esc(p[1])}</span>
              <span style="font-size:11.5px;font-weight:800;color:var(--mint)">Paid ✓</span>
              <span style="font-size:10.5px;color:var(--faint);width:54px;text-align:right">Stripe</span>
            </div>`).join('')}
        </div>`;
    },
  };
})();

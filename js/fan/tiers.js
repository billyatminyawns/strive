/* Fan · Tiers — membership plans + billing toggle (mockup 06) */
(function () {
  'use strict';
  const { esc, arg, icon } = UI;

  window.Screens = window.Screens || {};

  const PRICES = {
    monthly: { rookie: '$9.99', allaccess: '$19.99', inner: '$49.99' },
    annual: { rookie: '$7.99', allaccess: '$15.99', inner: '$39.99' },
  };

  function price(val) {
    return `<div style="font-size:18px;font-weight:900">${esc(val)}<span style="font-size:11px;color:var(--dim2);font-weight:600"> /mo</span></div>`;
  }

  function yourPlan() {
    return `<div style="margin-top:8px;border:1px solid var(--chip-line);color:var(--mint);border-radius:11px;padding:11px 0;font-size:13px;font-weight:800;text-align:center">Your plan ✓</div>`;
  }

  Screens['fan/tiers'] = {
    tab: 'you',
    noTabbar: true,
    render(s) {
      const annual = !!s.billingAnnual;
      const p = annual ? PRICES.annual : PRICES.monthly;
      const onTier = t => s.trialTier === t || s.fan.tier === t;

      const tglOn = 'background:var(--mint);color:var(--ink);border:none;border-radius:999px;padding:7px 18px;font-size:12px;font-weight:800';
      const tglOff = 'background:none;color:var(--sub);border:none;border-radius:999px;padding:7px 18px;font-size:12px;font-weight:700';

      return `
        <button data-action="back" data-arg="${arg({ to: '#/fan/you' })}" aria-label="Back"
          style="position:absolute;top:60px;left:12px;z-index:50;background:none;border:none;padding:8px 10px;display:flex">${icon.back}</button>

        <div class="p-scroll">
          <div style="min-height:100%;display:flex;flex-direction:column;padding:80px 20px 36px">

            <div style="text-align:center">
              <div style="font-size:24px;font-weight:900">Train with Angela</div>
              <div style="font-size:13px;color:var(--sub);margin-top:5px">Choose how close you want to get.</div>
            </div>

            <div style="display:flex;justify-content:center;margin-top:16px">
              <div style="display:flex;background:var(--card2);border:1px solid var(--line2);border-radius:999px;padding:3px;gap:2px">
                <button style="${annual ? tglOff : tglOn}" data-action="setBilling" data-arg="${arg({ annual: false })}">Monthly</button>
                <button style="${annual ? tglOn : tglOff}" data-action="setBilling" data-arg="${arg({ annual: true })}">Annual · −20%</button>
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:12px;margin-top:18px">

              <div style="background:var(--card);border:1px solid var(--line2);border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                  <div style="font-size:15px;font-weight:800">Rookie</div>
                  ${price(p.rookie)}
                </div>
                <div style="font-size:12px;color:var(--sub);line-height:1.55">Weekly audio drops · first lesson of every masterclass · community feed</div>
              </div>

              <div style="position:relative;background:linear-gradient(140deg,#1B231D,#141814);border:1.5px solid var(--mint);border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:6px">
                <div style="position:absolute;top:-9px;left:16px;background:var(--mint);color:var(--ink);font-size:9.5px;font-weight:900;letter-spacing:0.1em;border-radius:999px;padding:3px 9px">MOST POPULAR</div>
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                  <div style="font-size:15px;font-weight:800">All-Access</div>
                  ${price(p.allaccess)}
                </div>
                <div style="font-size:12px;color:var(--sub);line-height:1.55">Every masterclass &amp; drill sheet · daily drops · monthly live Q&amp;A · ask questions, hear her answer</div>
                ${onTier('All-Access')
                  ? yourPlan()
                  : `<button style="margin-top:8px;background:var(--mint);color:var(--ink);border:none;border-radius:11px;padding:11px 0;font-size:13px;font-weight:800"
                      data-action="startTrial" data-arg="${arg({ tier: 'All-Access' })}">Start 7-day free trial</button>`}
              </div>

              <div style="background:var(--card);border:1px solid var(--line2);border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                  <div style="font-size:15px;font-weight:800">Inner Circle</div>
                  ${price(p.inner)}
                </div>
                <div style="font-size:12px;color:var(--sub);line-height:1.55">Everything in All-Access · 2 personal voice replies from Angela each month · early access · limited to 500 members</div>
                ${onTier('Inner Circle')
                  ? yourPlan()
                  : `<button class="btn-ghost" style="margin-top:8px;border-radius:11px;padding:10px 0;font-size:12.5px;font-weight:700;width:100%"
                      data-action="startTrial" data-arg="${arg({ tier: 'Inner Circle' })}">Upgrade</button>`}
              </div>

            </div>

            <div style="text-align:center;font-size:11px;color:var(--dim);margin-top:auto;padding-top:18px;line-height:1.6">${annual ? 'Billed annually — save 20%' : 'Billed monthly'} · Cancel anytime.<br>Athletes keep 80% of membership revenue.</div>

          </div>
        </div>`;
    },
  };
})();

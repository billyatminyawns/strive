/* Athlete · You — Angela's own profile & pocket-studio controls (system match, studio-side lav accents) */
(function () {
  'use strict';
  const { esc, arg, ava, toggle } = UI;

  window.Screens = window.Screens || {};

  // right-pointing chevron (matches fan/you.js settings rows)
  const chevron = `<svg width="7" height="12" viewBox="0 0 8 14" style="transform:scaleX(-1);flex-shrink:0"><path d="M7 1L1.5 7 7 13" stroke="#5C635D" stroke-width="1.8" fill="none"/></svg>`;

  // lavender section kicker (studio side)
  function kicker(txt) {
    return `<span class="k-label" style="font-size:10.5px;color:var(--lav)">${esc(txt)}</span>`;
  }

  // one "Your week" stat line: small label left, value right
  function weekRow(label, val) {
    return `<div style="display:flex;align-items:baseline;justify-content:space-between">
      <span style="font-size:12.5px;color:var(--sub)">${esc(label)}</span>
      <span style="font-size:15px;font-weight:800">${esc(val)}</span>
    </div>`;
  }

  // static tappable control row: label (+ optional sub) left, chevron right
  function tapRow(action, opts) {
    opts = opts || {};
    return `<div data-action="${esc(action)}"${opts.argv != null ? ` data-arg="${arg(opts.argv)}"` : ''}
      style="display:flex;align-items:center;justify-content:space-between;padding:14px 2px;cursor:pointer">
      <div>
        <div style="font-size:13.5px;font-weight:600;color:#D7DDD8">${esc(opts.label)}</div>
        ${opts.sub ? `<div style="font-size:11px;color:var(--dim2);margin-top:2px">${esc(opts.sub)}</div>` : ''}
      </div>
      ${chevron}
    </div>`;
  }

  Screens['athlete/profile'] = {
    tab: 'profile',
    render(s) {
      const members = (s.stats && s.stats.members || 12480).toLocaleString();
      const revenue = (s.stats && s.stats.revenue) || '$38.2K';
      const storiesCaptured = ((s.stories || []).length) + 4;
      const paused = !!s.pauseQuestions;

      return `<div class="p-scroll" style="padding:70px 18px 8px">
        <div style="display:flex;flex-direction:column;gap:16px">

          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding-top:6px;text-align:center">
            ${ava(Data.IMG.head, 76)}
            <div style="font-size:19px;font-weight:800;margin-top:4px">Angela Ruggiero</div>
            <div style="font-size:12px;color:var(--dim2)">Hockey · Defense — pilot athlete</div>
            <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:4px">
              <span class="pill" style="font-size:11.5px;color:var(--mint);border:1px solid var(--chip-line);background:var(--chip-bg);padding:6px 12px"><span style="color:var(--mint);font-size:9px">●</span> LIVE — ${esc(members)} members</span>
              <span class="pill" style="font-size:11.5px;color:var(--sub);border:1px solid var(--line2);padding:6px 12px">Earning ${esc(revenue)}/mo</span>
            </div>
          </div>

          <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
            ${kicker('YOUR WEEK')}
            <div style="display:flex;flex-direction:column;gap:11px">
              ${weekRow('Replies approved', '12')}
              ${weekRow('Stories captured', String(storiesCaptured))}
              ${weekRow('Drops shipped', '5')}
            </div>
            <div style="font-size:11.5px;color:var(--faint);line-height:1.5;border-top:1px solid var(--line);padding-top:11px">Angela runs it all in about an hour a week.</div>
          </div>

          <div class="card2" style="padding:16px;display:flex;flex-direction:column;gap:8px">
            ${kicker('PAYOUT')}
            <div style="font-size:17px;font-weight:800">$30.5K heading your way Aug 1</div>
            <div style="font-size:12px;color:var(--dim2)">80% athlete share · Stripe •••• 4417</div>
            <div style="font-size:11px;color:var(--faint);margin-top:2px">Full earnings on desktop</div>
          </div>

          <div style="display:flex;flex-direction:column;gap:9px">
            ${kicker('CONTROLS')}
            <div class="card" style="padding:0 16px">

              <div style="border-bottom:1px solid #1D221E">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 2px">
                  <span style="font-size:13.5px;font-weight:600;color:#D7DDD8">Pause new questions</span>
                  ${toggle(paused, 'athPPause', {})}
                </div>
                ${paused ? `<div style="font-size:11.5px;color:var(--papaya);padding:0 2px 12px;margin-top:-4px">Fans see: back after the road trip</div>` : ''}
              </div>

              <div style="border-bottom:1px solid #1D221E">
                ${tapRow('nav', { label: 'Voice model', sub: 'Delivery, samples & guardrails', argv: '#/athlete/studio' })}
              </div>

              <div>
                ${tapRow('toast', { label: 'Notifications', argv: { msg: 'Managed in your phone settings in production.' } })}
              </div>

            </div>
          </div>

          <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:6px 0 10px">
            <button class="btn-quiet" style="font-size:12.5px;padding:8px 14px;cursor:pointer" data-action="nav" data-arg="${arg('#/fan/home')}">Switch to fan view</button>
            <div style="font-size:10px;color:var(--faint);text-align:center">Strive concept demo · all content illustrative</div>
          </div>

        </div>
      </div>`;
    },
  };

  // Controls: pause/resume new fan questions (created on first write). Toggling toasts.
  window.Actions.athPPause = function () {
    const now = !Store.get().pauseQuestions;
    Store.set(s => { s.pauseQuestions = now; });
    Actions.toast({ msg: now ? 'New questions paused — fans see your away note.' : 'Questions open again — fans can ask.' });
  };
})();

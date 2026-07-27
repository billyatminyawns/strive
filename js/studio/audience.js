/* Studio · Audience — membership breakdown + newest members (system-matched; no mockup) */
(function () {
  'use strict';
  const { esc, mono, tierBadge } = UI;
  window.Screens = window.Screens || {};

  function stat(val, label, delta, mint) {
    return `<div style="border-left:2px solid var(--lav);padding-left:14px">
      <div style="font-size:27px;font-weight:900">${esc(val)}</div>
      <div class="k-label" style="font-size:10.5px;letter-spacing:0.12em;color:var(--sub);margin-top:3px">${esc(label)}</div>
      <div style="font-size:11.5px;color:${mint ? 'var(--mint)' : 'var(--dim2)'};font-weight:${mint ? 700 : 600};margin-top:3px">${esc(delta)}</div>
    </div>`;
  }

  function bar(label, right, pct, color, note) {
    return `<div>
      <div style="display:flex;justify-content:space-between;font-size:12.5px">
        <span style="font-weight:700">${esc(label)}</span><span style="color:var(--dim2)">${esc(right)}</span></div>
      <div class="progress" style="margin-top:6px"><div style="width:${pct}%;${color ? `background:${color};` : ''}"></div></div>
      ${note ? `<div style="font-size:10.5px;color:var(--mint);margin-top:4px">${esc(note)}</div>` : ''}
    </div>`;
  }

  // shared source-of-truth arrays — render + CSV export read the same data
  const STATS = [
    ['1,024', 'NEW MEMBERS', '+18% this month', true],
    ['2.1%', 'MONTHLY CHURN', '−0.4pt vs June', true],
    ['4,890', 'DAILY ACTIVE', '39% of members', false],
    ['38%', 'INVITE CONVERSION', 'code → member', false],
  ];
  const TIERS = [
    ['Rookie', '6,120', 49, null, null],
    ['All-Access', '5,480', 44, null, null],
    ['Inner Circle', '880', 7, 'var(--mint)', '500 cap + 380 waitlist'],
  ];
  const GEO = [['United States', 62], ['Canada', 21], ['Sweden', 5], ['Czechia', 3], ['Other', 9]];
  const NEW = [
    ['JT', 'Jordan T.', 'Rookie', '2m ago', 'var(--lav)'],
    ['SR', 'Sasha R.', 'All-Access', '9m ago', 'var(--azure)'],
    ['KO', 'Kai O.', 'All-Access', '14m ago', 'var(--papaya)'],
    ['PW', 'Priya W.', 'Inner Circle', '1h ago', 'var(--mint)'],
    ['DL', 'Dana L.', 'Rookie', '3h ago', 'var(--lav)'],
  ];

  Screens['studio/audience'] = {
    url: 'audience',
    render() {
      return `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:23px;font-weight:800">Audience</div>
          <button class="btn btn-ghost" style="padding:10px 16px" data-action="audExport">Export CSV</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:22px">
          ${STATS.map(t => stat(t[0], t[1], t[2], t[3])).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px">
          <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:16px">
            <div style="font-size:14.5px;font-weight:800">Membership by tier</div>
            <div style="display:flex;flex-direction:column;gap:14px">
              ${TIERS.map(t => bar(t[0], t[1], t[2], t[3], t[4])).join('')}
            </div>
            <div style="font-size:11px;color:var(--faint);margin-top:auto">Inner Circle waitlist opens again in August.</div>
          </div>
          <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px">
            <div style="font-size:14.5px;font-weight:800">Where members train</div>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${GEO.map(g => `<div>
                <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="font-weight:700">${esc(g[0])}</span><span style="color:var(--dim2)">${g[1]}%</span></div>
                <div class="progress" style="height:5px;margin-top:5px"><div style="width:${g[1]}%"></div></div>
              </div>`).join('')}
            </div>
          </div>
        </div>

        <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:12px">
          <div style="font-size:14.5px;font-weight:800">Newest members</div>
          ${NEW.map((m, i) => `
            <div style="display:flex;align-items:center;gap:12px;${i < NEW.length - 1 ? 'border-bottom:1px solid #1D221E;padding-bottom:12px' : ''}">
              ${mono(m[0], 34, m[4], 12)}
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700">${esc(m[1])} <span style="margin-left:6px">${tierBadge(m[2])}</span></div>
                <div style="font-size:11px;color:var(--faint);margin-top:2px">${esc(m[3])} · <span class="k-label" style="letter-spacing:0.08em">via ANGELA code</span></div>
              </div>
            </div>`).join('')}
        </div>`;
    },
  };

  // Export CSV — build a real file from the same on-screen arrays and download it
  window.Actions.audExport = function () {
    const cell = v => {
      v = String(v == null ? '' : v);
      return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const row = cells => cells.map(cell).join(',');
    const lines = [];
    lines.push('# Strive — Audience export · 2026-07 · all figures illustrative');
    lines.push('');
    lines.push('Summary');
    lines.push(row(['Metric', 'Value', 'Change']));
    STATS.forEach(t => lines.push(row([t[1], t[0], t[2]])));
    lines.push('');
    lines.push('Membership by tier');
    lines.push(row(['Tier', 'Members', 'Share', 'Note']));
    TIERS.forEach(t => lines.push(row([t[0], t[1], t[2] + '%', t[4] || ''])));
    lines.push('');
    lines.push('Where members train');
    lines.push(row(['Region', 'Share']));
    GEO.forEach(g => lines.push(row([g[0], g[1] + '%'])));
    lines.push('');
    lines.push('Newest members');
    lines.push(row(['Name', 'Tier', 'Joined', 'Source']));
    NEW.forEach(m => lines.push(row([m[1], m[2], m[3], 'via ANGELA code'])));

    const csv = lines.join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strive-audience-2026-07.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Actions.toast({ msg: 'Audience export downloaded ✓' });
  };
})();

/* Studio · Overview — stats + approval queue (mockup 09 + walkthrough StudioOverview) */
(function () {
  'use strict';
  const { esc, arg, wave, playBtn } = UI;

  window.Screens = window.Screens || {};

  function stat(val, label, delta, deltaMint) {
    return `<div style="border-left:2px solid var(--lav);padding-left:14px">
      <div style="font-size:27px;font-weight:900" data-count="${esc(val)}">${esc(val)}</div>
      <div class="k-label" style="font-size:10.5px;letter-spacing:0.12em;color:var(--sub);margin-top:3px">${esc(label)}</div>
      <div style="font-size:11.5px;color:${deltaMint ? 'var(--mint)' : 'var(--dim2)'};font-weight:${deltaMint ? 700 : 600};margin-top:3px">${esc(delta)}</div>
    </div>`;
  }

  Screens['studio/overview'] = {
    url: 'overview',
    render(s) {
      const waiting = s.inbox.filter(q => q.status === 'draft');
      const waitingCount = waiting.length + s.inboxExtra;
      const queue = waiting.slice(0, 3);

      return `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:23px;font-weight:800">Good morning, Angela</div>
            <div style="font-size:12.5px;color:var(--dim2);margin-top:2px">Wednesday, July 22 · ${waitingCount} questions waiting · next drop scheduled Friday 7:00 AM</div>
          </div>
          <button class="btn btn-mint" data-action="ovRecordDrop">Record a drop</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:22px">
          ${stat(s.stats.members.toLocaleString('en-US'), 'MEMBERS', s.stats.membersDelta, true)}
          ${stat(s.stats.revenue, 'MONTHLY REVENUE', s.stats.revenueDelta, true)}
          ${stat(s.stats.answered, 'QUESTIONS ANSWERED', 'median reply ' + s.stats.reply, false)}
          ${stat(s.stats.listen, 'AVG DAILY LISTEN', s.stats.listenDelta, true)}
        </div>

        <div style="display:grid;grid-template-columns:1.25fr 1fr;gap:22px;flex:1;min-height:0">
          <div class="card" style="padding:18px;display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:14.5px;font-weight:800">Waiting for your approval</div>
              <span style="font-size:11px;color:var(--lav);font-weight:700">${queue.length} drafts ready</span>
            </div>
            ${queue.map((q, i) => `
              <div style="display:flex;align-items:center;gap:12px;${i < queue.length - 1 ? 'border-bottom:1px solid #1D221E;padding-bottom:12px' : ''}">
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:700">"${esc(q.text)}" — ${esc(q.from)}, ${esc(q.tier)}</div>
                  <div style="font-size:11.5px;color:var(--dim2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Draft: "${esc(q.draft.slice(0, 78))}…"</div>
                </div>
                ${i === 0
                  ? `<button class="btn btn-mint" style="padding:8px 13px;font-size:11.5px;flex-shrink:0" data-action="approve" data-arg="${arg({ id: q.id })}">Approve</button>`
                  : `<button class="btn btn-ghost" style="padding:8px 13px;font-size:11.5px;flex-shrink:0" data-action="reviewInbox" data-arg="${arg({ id: q.id })}">Review</button>`}
              </div>`).join('')}
            ${s.inbox.filter(q => q.status === 'sent').slice(0, 2).map(q => `
              <div style="display:flex;align-items:center;gap:12px;opacity:0.75">
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:700">"${esc(q.text)}" — ${esc(q.from)}</div>
                  <div style="font-size:11.5px;color:var(--dim2);margin-top:2px">Sent in your voice${q.similar ? ` · heard by ${q.similar} similar askers` : ''}</div>
                </div>
                <span style="font-size:11.5px;font-weight:800;color:var(--mint);flex-shrink:0">Sent ✓</span>
              </div>`).join('')}
            <button class="btn-quiet" style="align-self:flex-start;margin-top:auto;padding:4px 0;font-size:12px" data-action="nav" data-arg="${arg('#/studio/inbox')}">Open the inbox →</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:22px;min-height:0">
            <div class="card" style="padding:18px;display:flex;flex-direction:column;gap:12px;flex:1">
              <div style="font-size:14.5px;font-weight:800">This week's drops</div>
              <div style="display:flex;flex-direction:column;gap:11px">
                ${s.drops.slice(0, 3).map(d => `
                  <div>
                    <div style="display:flex;justify-content:space-between;font-size:12.5px">
                      <span style="font-weight:700">${esc(d.title)}</span><span style="color:var(--dim2)">${d.listens.toLocaleString('en-US')} listens</span></div>
                    <div class="progress" style="margin-top:6px"><div style="width:${d.completion}%"></div></div>
                  </div>`).join('')}
              </div>
              <div style="font-size:11px;color:var(--faint);margin-top:auto">Completion rate shown. Inner Circle listens 2.3× longer than average.</div>
            </div>
            ${s.activity.length ? `<div class="card scroll" style="padding:14px 18px;display:flex;flex-direction:column;gap:8px;max-height:150px;overflow-y:auto">
              <div style="font-size:12px;font-weight:800;color:#B9C0BA">Just now</div>
              ${s.activity.slice(0, 4).map(a => `<div style="font-size:11.5px;color:var(--sub);line-height:1.45"><span style="color:var(--dim)">${esc(a.t)}</span> · ${esc(a.text)}</div>`).join('')}
            </div>` : ''}
          </div>
        </div>`;
    },
  };

  // Review → jump to inbox with the item selected
  window.Actions.reviewInbox = function (a) {
    Store.set(s => { s.inboxSelected = a.id; });
    location.hash = '#/studio/inbox';
  };

  // Record a drop → open Content with the composer already expanded (title auto-kept via data-keep)
  window.Actions.ovRecordDrop = function () {
    Store.set(s => { s.composerOpen = true; });
    location.hash = '#/studio/content';
  };
})();

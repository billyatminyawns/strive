/* Studio · Inbox — question queue, AI drafts, approve & send (mockup 11) */
(function () {
  'use strict';
  const { esc, arg, fmt, wave, playBtn, mono, tierBadge } = UI;

  window.Screens = window.Screens || {};

  Screens['studio/inbox'] = {
    url: 'inbox',
    render(s) {
      const all = s.inbox.filter(q => q.status !== 'declined');
      const rawQuery = s.inboxSearch || '';
      const query = rawQuery.trim().toLowerCase();
      const base = s.inboxFilter === 'inner' ? all.filter(q => q.tier === 'Inner Circle')
        : s.inboxFilter === 'flagged' ? all.filter(q => q.flagged)
        : all;
      const items = query
        ? base.filter(q => String(q.text || '').toLowerCase().includes(query)
            || String(q.from || '').toLowerCase().includes(query))
        : base;
      const sel = s.inbox.find(q => q.id === s.inboxSelected) || items[0];
      const waitingCount = s.inbox.filter(q => q.status === 'draft').length + s.inboxExtra;
      const innerCount = all.filter(q => q.tier === 'Inner Circle').length + 4;
      const flaggedCount = all.filter(q => q.flagged).length || 1;

      const list = `
        <div style="width:330px;flex-shrink:0;border-right:1px solid #1D221E;padding:0 16px 22px 0;display:flex;flex-direction:column;gap:14px;overflow:hidden">
          <div style="position:relative">
            <input class="field-dark" style="border-radius:10px;width:100%;padding-right:34px" placeholder="Search questions…"
              data-keep="inbox-search" data-input-action="inbSearch" value="${esc(rawQuery)}">
            ${rawQuery ? `<button data-action="inbClearSearch" aria-label="Clear search"
              style="position:absolute;right:6px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;border:none;background:none;color:var(--dim);font-size:13px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button data-action="setInboxFilter" data-arg="${arg({ f: 'all' })}"
              style="font-size:11px;font-weight:${s.inboxFilter === 'all' ? 800 : 700};background:${s.inboxFilter === 'all' ? 'var(--chip-bg)' : 'none'};color:${s.inboxFilter === 'all' ? 'var(--mint)' : 'var(--sub)'};border:1px solid ${s.inboxFilter === 'all' ? 'var(--chip-line)' : 'var(--line2)'};border-radius:999px;padding:5px 11px">All ${waitingCount}</button>
            <button data-action="setInboxFilter" data-arg="${arg({ f: 'inner' })}"
              style="font-size:11px;font-weight:${s.inboxFilter === 'inner' ? 800 : 700};background:${s.inboxFilter === 'inner' ? 'var(--chip-bg)' : 'none'};color:${s.inboxFilter === 'inner' ? 'var(--mint)' : 'var(--sub)'};border:1px solid ${s.inboxFilter === 'inner' ? 'var(--chip-line)' : 'var(--line2)'};border-radius:999px;padding:5px 11px">Inner Circle ${innerCount}</button>
            <button data-action="setInboxFilter" data-arg="${arg({ f: 'flagged' })}"
              style="font-size:11px;font-weight:700;background:${s.inboxFilter === 'flagged' ? 'var(--chip-bg)' : 'none'};color:var(--papaya);border:1px solid ${s.inboxFilter === 'flagged' ? 'var(--chip-line)' : 'var(--line2)'};border-radius:999px;padding:5px 11px">Flagged ${flaggedCount}</button>
          </div>
          <div class="scroll" style="display:flex;flex-direction:column;gap:8px;overflow-y:auto;padding-right:2px">
            ${items.length ? items.map(q => {
              const on = sel && q.id === sel.id;
              return `<button data-action="selectInbox" data-arg="${arg({ id: q.id })}"
                style="text-align:left;background:${on ? 'var(--chip-bg)' : 'var(--card)'};border:1px solid ${on ? 'var(--chip-line)' : 'var(--line)'};border-radius:12px;padding:12px 14px;color:var(--txt)">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                  <span style="font-size:12.5px;font-weight:800">${esc(q.from)}</span>
                  <span style="display:flex;align-items:center;gap:5px">${q.flagged ? `<span style="font-size:9px;font-weight:900;color:var(--papaya)">⚑</span>` : ''}${tierBadge(q.tier)}</span>
                </div>
                <div style="font-size:11.5px;color:var(--sub2);margin-top:4px;line-height:1.45">${esc(q.text)}</div>
                <div style="font-size:10px;color:var(--dim);margin-top:5px">${esc(q.ago)} · ${q.status === 'sent' ? 'sent ✓' : q.flagged ? 'needs your call' : 'draft ready'}</div>
              </button>`;
            }).join('') : `<div style="text-align:center;font-size:11.5px;color:var(--dim);padding:22px 8px">No questions match.</div>`}
            ${!query && s.inboxExtra ? `<div style="text-align:center;font-size:11px;color:var(--dim);padding:8px 0">+ ${s.inboxExtra} more in the queue</div>` : ''}
          </div>
        </div>`;

      if (!sel) {
        return `<div style="display:flex;gap:0;flex:1;min-height:0;margin:-26px -30px -20px 0">${list}
          <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--dim)">No question selected</div></div>`;
      }

      const draftId = 'draft:' + sel.id;
      const dur = Player.estimate(sel.draft, 1);
      const detail = `
        <div class="scroll" style="flex:1;padding:0 0 24px 28px;display:flex;flex-direction:column;gap:16px;min-width:0;overflow-y:auto">
          <div>
            <div style="display:flex;align-items:center;gap:10px">
              ${mono(sel.avatar, 34, sel.color, 13)}
              <div>
                <div style="font-size:13.5px;font-weight:800">${esc(sel.from)} <span class="k-label" style="font-size:10px;color:var(--mint);margin-left:6px">${esc(sel.tier.toUpperCase())}</span></div>
                <div style="font-size:11px;color:var(--faint)">${esc(sel.meta || '')} · ${esc(sel.ago)}</div>
              </div>
            </div>
            <div style="font-size:17px;font-weight:700;line-height:1.5;margin-top:12px">"${esc(sel.text)}"</div>
          </div>

          <div class="card" style="padding:18px;display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span class="k-label" style="font-size:10.5px;color:var(--lav)">${sel.aiDrafted ? 'AI DRAFT · CLAUDE · FROM YOUR PAST ANSWERS' : 'AI DRAFT · FROM YOUR PAST ANSWERS'}</span>
              ${sel.status === 'sent'
                ? `<span class="k-label" style="font-size:10.5px;color:var(--mint)">SENT ✓</span>`
                : sel.drafting
                  ? `<span class="k-label" style="font-size:10.5px;color:var(--lav);display:inline-flex;align-items:center;gap:6px"><span style="width:6px;height:6px;border-radius:50%;background:var(--lav);animation:livepulse 1.1s infinite"></span>CLAUDE IS DRAFTING…</span>`
                  : `<span class="k-label" style="font-size:10.5px;color:var(--papaya)">AWAITING APPROVAL</span>`}
            </div>
            ${sel.editing
              ? `<textarea class="field-rect" rows="5" data-keep="draft-edit" data-input-action="editDraft" data-qid="${sel.id}">${esc(sel.draft)}</textarea>`
              : `<div style="font-size:13.5px;color:#D7DDD8;line-height:1.65;${sel.drafting ? 'opacity:0.55' : ''}">${esc(sel.draft)}</div>`}
            <div style="display:flex;align-items:center;gap:12px;background:var(--screen);border:1px solid var(--line2);border-radius:12px;padding:10px 14px">
              ${playBtn({ id: draftId }, 32)}
              <div style="flex:1">${wave(draftId, 26, 20)}</div>
              <span style="font-size:11px;color:var(--dim2)"><span data-dur-for="${draftId}">${fmt(dur)}</span> · your voice</span>
            </div>
            <div style="display:flex;gap:10px">
              ${sel.status === 'sent'
                ? `<span class="pill" style="border:1px solid var(--chip-line);color:var(--mint);border-radius:10px;padding:11px 18px;font-size:12.5px;font-weight:800">Sent to ${esc(sel.from.split(' ')[0])} ✓</span>`
                : `<button class="btn btn-mint" data-action="approve" data-arg="${arg({ id: sel.id })}">Approve &amp; send</button>`}
              <button class="btn btn-ghost" data-action="toggleEditDraft" data-arg="${arg({ id: sel.id })}">${sel.editing ? 'Done editing' : 'Edit answer'}</button>
              ${sel.status !== 'sent' ? `<button class="btn-quiet" style="padding:11px 12px;font-size:12.5px" data-action="decline" data-arg="${arg({ id: sel.id })}">Decline politely</button>` : ''}
            </div>
            ${Coach.why(sel)}
            ${sel.flagged ? `<div style="font-size:11.5px;color:var(--papaya);background:rgba(252,164,111,0.07);border:1px solid rgba(252,164,111,0.25);border-radius:10px;padding:10px 13px;line-height:1.5">
              ⚑ Flagged by guardrails — this ask touched a sensitive topic. Your call whether to answer, soften, or pass.</div>` : ''}
          </div>

          ${sel.similar ? `<div style="background:var(--card);border:1px dashed #2A2F2B;border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:14px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">${sel.similar} fans asked something similar this week</div>
              <div style="font-size:11.5px;color:var(--dim2);margin-top:2px">${esc(sel.similarLabel || '')} · answer once — every fan who asks next hears it</div>
            </div>
            ${sel.sentToAll
              ? `<span style="font-size:12px;font-weight:800;color:var(--mint);flex-shrink:0">Sent to all ${sel.similar} ✓</span>`
              : `<button class="btn btn-mint-line" style="padding:10px 15px;font-size:12px" data-action="sendToAll" data-arg="${arg({ id: sel.id })}">Send to all ${sel.similar}</button>`}
          </div>` : ''}

          ${sel.fromFan && sel.status === 'sent' ? `<div style="font-size:11.5px;color:var(--mint);display:flex;align-items:center;gap:8px">
            ${UI.icon.check('var(--mint)', 12)} Delivered — open the fan app's Ask tab to hear it land.</div>` : ''}
        </div>`;

      return `<div style="display:flex;flex:1;min-height:0;gap:0;margin-right:-6px">${list}${detail}</div>`;
    },
  };

  // ---- module-local actions ----
  // live filter of the inbox list by question text or sender name
  window.Actions.inbSearch = function (value) {
    Store.set(s => { s.inboxSearch = value; });
  };
  window.Actions.inbClearSearch = function () {
    Store.set(s => { s.inboxSearch = ''; });
  };
})();

/* STRIVE — Coach Angela UI pieces shared by the fan chat, both studios, the inbox and the approve
   deck: the autopilot status line, cited sources, "why this came to you", and the log of replies
   Coach Angela sent on its own (each one Angela can keep or retract). */
(function () {
  'use strict';
  const { esc, arg } = UI;

  const yearOf = d => String(d || '').slice(0, 4);

  // "Sports Business Journal · 2023" chips; links open the original source
  function sources(list, max) {
    const items = (list || []).filter(x => x && (x.title || x.outlet)).slice(0, max || 3);
    if (!items.length) return '';
    return items.map(x => {
      const label = esc((x.outlet || x.title) + (yearOf(x.date) ? ' · ' + yearOf(x.date) : ''));
      return /^https?:\/\//.test(x.url || '')
        ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" data-action="noop" style="color:var(--azure);text-decoration:none">${label}</a>`
        : `<span>${label}</span>`;
    }).join('<span style="color:var(--faint)"> · </span>');
  }

  // What the server will actually allow, so the studio toggle never overstates what happens.
  function serverLine(s) {
    const b = window.Api && Api.brain;
    const on = !s.guards.review;
    let text, color;
    if (!b) { text = 'Coach Angela’s brain is offline — new questions come straight to you with a template draft.'; color = 'var(--faint)'; }
    else if (!b.configured) { text = 'Brain not switched on yet (no Claude key on the server) — new questions come to you.'; color = 'var(--faint)'; }
    else if (b.autopilot !== 'grounded') { text = on ? 'Autopilot is locked to review on the server until you sign off — Coach Angela drafts, you approve.' : 'Coach Angela drafts every new answer from your public record; you approve.'; color = 'var(--papaya)'; }
    else { text = on ? `Autopilot live · answers only from your verified record (${b.entries} sourced notes). Anything new comes to you.` : 'Coach Angela drafts every new answer from your public record; you approve.'; color = 'var(--mint)'; }
    return `<div style="font-size:10.5px;color:${color};line-height:1.5;margin-top:-6px">${esc(text)}</div>`;
  }

  // Inbox / approve deck: why the brain routed this question to her
  function why(q) {
    if (!q || !q.brain) return '';
    const src = sources(q.brain.sources, 2);
    return `<div style="font-size:11px;color:var(--sub);background:var(--screen);border:1px solid var(--line2);border-radius:10px;padding:9px 12px;line-height:1.5">
      <span style="font-weight:800;color:var(--azure)">Why it’s with you:</span> ${esc(q.brain.reason || 'New ground for Coach Angela')}
      ${src ? `<div style="margin-top:4px;color:var(--dim2)">Drafted from: ${src}</div>` : ''}
    </div>`;
  }

  // Replies Coach Angela sent on its own — keep (becomes an approved answer) or retract
  function log(s, compact) {
    const items = (s.autoLog || []).slice(0, compact ? 3 : 6);
    const live = (s.autoLog || []).filter(x => x.status === 'live').length;
    return `<div class="card" style="padding:${compact ? 16 : 20}px;display:flex;flex-direction:column;gap:12px">
      <div>
        <div style="font-size:${compact ? 11 : 14.5}px;font-weight:800;${compact ? 'letter-spacing:0.08em;color:var(--lav,var(--azure))' : ''}">${compact ? 'COACH ANSWERED ON ITS OWN' : 'Coach Angela answered on its own'}</div>
        <div style="font-size:11.5px;color:var(--dim2);margin-top:3px;line-height:1.5">${items.length
          ? `${live ? live + ' to review' : 'All reviewed'} · keep one and it becomes an approved answer; retract it and the question comes back to you.`
          : 'Nothing yet. When autopilot answers a fan from your record, it shows up here for you to keep or retract.'}</div>
      </div>
      ${items.map(e => `
        <div style="border-top:1px solid #1D221E;padding-top:11px;display:flex;flex-direction:column;gap:6px">
          <div style="font-size:12px;font-weight:700">“${esc(e.q)}”</div>
          <div style="font-size:11.5px;color:var(--sub2);line-height:1.55;${e.status === 'retracted' ? 'text-decoration:line-through;opacity:0.5' : ''}">${esc(e.reply)}</div>
          ${sources(e.sources, 2) ? `<div style="font-size:10.5px;color:var(--dim2)">From: ${sources(e.sources, 2)}</div>` : ''}
          ${e.status === 'live' ? `<div style="display:flex;gap:8px;margin-top:2px">
              <button class="btn-mint" style="font-size:11px;padding:6px 12px" data-action="coachKeep" data-arg="${arg({ id: e.id })}">Keep</button>
              <button style="font-size:11px;font-weight:700;padding:6px 12px;background:none;border:1px solid var(--line2);border-radius:999px;color:var(--papaya)" data-action="coachRetract" data-arg="${arg({ id: e.id })}">Retract</button>
            </div>`
            : `<div style="font-size:10.5px;font-weight:800;color:${e.status === 'kept' ? 'var(--mint)' : 'var(--papaya)'}">${e.status === 'kept' ? 'KEPT · now an approved answer' : 'RETRACTED · back in your inbox'}</div>`}
        </div>`).join('')}
    </div>`;
  }

  // the review-guard row's sub-label tracks what the toggle actually does
  const guardSub = on => on
    ? 'Coach Angela drafts everything — nothing sends without you'
    : 'Autopilot: Coach Angela answers on its own when it’s grounded in your verified record';

  window.Coach = { sources, serverLine, why, log, guardSub };
})();

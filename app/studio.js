// Athlete studio: Today · Approve (+ reply editor) · Capture · Coach (autopilot oversight) · Settings.
import { esc, attr, icon, clock, rel, greeting, today, ava, initial, wave, playBtn, toast, sheet, busy, emptyState, hours, spinner } from './ui.js';
import { state, set, render, firstName, signOut } from './state.js';
import { api, message } from './api.js';
import { player, replyItem } from './player.js';
import { startRecording, canRecord, canTranscribe, dictate, toBase64 } from './recorder.js';

const ui = { previewing: null, rec: null, recording: false, take: null, live: '', saving: false, selected: 'drop', dragX: 0, working: null };

// ---------- data ----------
export async function loadToday() {
  try { set({ today: await api.get('studio/today'), todayError: null }); }
  catch (e) { if (!state.today) set({ todayError: message(e) }); }
}
export async function loadQueue() {
  try { const r = await api.get('studio/queue'); set({ queue: r.questions, queueLoaded: true }); } catch {}
}
const loadSDrops = async () => { try { set({ sdrops: await api.get('studio/drops') }); } catch {} };
const loadSettings = async () => { try { set({ settings: await api.get('studio/settings') }); } catch {} };
const loadPrompts = async () => { try { const r = await api.get('studio/prompts'); set({ prompts: r.prompts, coverage: r.coverage }); } catch {} };
const loadStories = async () => { try { set({ stories: (await api.get('studio/stories')).stories }); } catch {} };
const loadBio = async () => { try { set({ bio: await api.get('studio/bio') }); } catch {} };
const loadCoach = async () => { try { set({ coach: (await api.get('studio/coach')).answers || [], coachLoaded: true }); } catch { set({ coachLoaded: true }); } };

export const queueCount = () => (state.queueLoaded ? state.queue.length : state.today?.queueCount || 0);

/** Renders text in the athlete's voice and plays it — nothing is sent. */
async function preview(text, id, title) {
  const t = String(text || '').trim();
  if (!t) return;
  ui.previewing = id;
  render();
  try {
    const r = await api.post('studio/preview', { text: t });
    player.toggle({ id: `preview:${id}:${r.audioKey}`, title, subtitle: 'Preview · not sent', key: r.audioKey, duration: r.duration });
  } catch (e) {
    toast(e.status === 503 ? 'Voice previews for new text are switched off right now.' : message(e), 'error');
  }
  ui.previewing = null;
  render();
}
const previewBtn = (id, label = 'Hear it in your voice') =>
  `<button class="btn line sm" style="color:var(--lav);border-color:rgba(203,169,247,.35)" data-act="preview" data-arg="${attr(id)}" ${ui.previewing === id ? 'disabled' : ''}>
    ${ui.previewing === id ? spinner() : `<span style="width:14px;height:14px;display:inline-flex">${icon.play}</span>`} ${label}</button>`;

// ---------- screens ----------
export const screens = {
  studio: {
    tab: 'studio', wide: true,
    enter: () => { loadToday(); loadQueue(); },
    render() {
      const t = state.today;
      const n = queueCount();
      if (!t) {
        return `<div class="wrap wide stack gap20">${header()}${state.todayError
          ? `<div class="card empty"><p class="muted" style="margin:0">${esc(state.todayError)}</p><button class="btn line sm" data-act="reloadToday">Try again</button></div>`
          : '<div class="skeleton" style="height:180px"></div><div class="skeleton" style="height:120px"></div>'}</div>`;
      }
      const s = t.stats;
      return `<div class="wrap wide stack gap28">${header()}
        ${n ? `<section class="card hero stack gap14" style="padding:22px">
            <div class="kicker lav">Your queue</div>
            <div class="row" style="align-items:baseline"><b style="font-size:54px;line-height:1;font-weight:900">${n}</b>
              <span style="font-weight:700;color:var(--txt2)">question${n === 1 ? '' : 's'} waiting<br>for your voice</span></div>
            <a class="btn block" href="#/studio/approve">Start approving →</a></section>`
          : `<section class="card row"><span style="color:var(--mint);width:28px;height:28px;display:inline-flex">${icon.check}</span>
            <div class="grow"><b style="font-size:17px">Queue clear</b><div class="small dim">${state.config.autopilot && state.settings?.autopilot ? 'New fan questions land here — your Coach only answers on its own when your public record covers it.' : 'New fan questions land here — nothing reaches a fan until you approve it.'}</div></div></section>`}
        <div class="stats">
          ${stat(s.members, 'Members', s.membersWeek ? `+${s.membersWeek} this week` : 'fans in your room')}
          ${stat(s.answeredPct == null ? '—' : `${Math.round(s.answeredPct)}%`, 'Answered', 'of fan questions')}
          ${stat(hours(s.medianReplyHours), 'Median reply', 'wait for fans')}
          ${stat(s.listensWeek, 'Listens', 'this week')}
        </div>
        ${t.bioStatus !== 'approved' ? `<button class="card row lav" data-act="openBio" style="text-align:left;width:100%">
            <span style="width:22px;height:22px;color:var(--lav);display:inline-flex">${icon.you}</span>
            <div class="grow"><b>Your voice bio needs your OK</b><div class="small dim">It's the first thing a new fan hears. Nobody hears it until you approve it.</div></div>
            <span style="width:16px;height:16px;color:var(--dim);display:inline-flex">${icon.chev}</span></button>` : ''}
        ${t.draftDrops.length ? `<section class="stack gap10"><div class="section-head"><h2>Drafted for you</h2><span class="tiny">approve in one sitting</span></div>
            <p class="small dim" style="margin:0">Your Coach drafts drops so you don't have to create them. Hear each one, then approve, edit, or send it back.</p>
            ${t.draftDrops.map(draftCard).join('')}</section>` : ''}
        ${t.queued.length ? `<section class="stack gap10"><div class="section-head"><h2>Up next</h2><span class="tiny">one ships each morning at 7 AM Pacific</span></div>
            ${t.queued.map((d, i) => `<div class="drop-row"><span class="pill azure">${esc(shipLabel(i, t.nextPublishAt))}</span>
              <div class="grow"><div class="t ellipsis">${esc(d.title)}</div><div class="tiny dim">Approved · ${clock(d.duration)}</div></div></div>`).join('')}</section>` : ''}
        ${state.config.autopilot ? `<a class="card row" href="#/studio/coach" style="text-decoration:none;color:var(--txt)">
            <span style="width:22px;height:22px;color:var(--lav);display:inline-flex">${icon.spark}</span>
            <div class="grow"><b>Coach answers</b><div class="small dim">Review what your AI Coach said on autopilot — keep it or pull it back.</div></div>
            <span style="width:16px;height:16px;color:var(--dim);display:inline-flex">${icon.chev}</span></a>` : ''}
      </div>`;
    },
  },

  approve: {
    tab: 'approve', wide: true,
    enter: () => loadQueue(),
    mount: bindSwipe,
    render() {
      const q = state.queue[0];
      const head = `<header class="section-head"><h1>Approve</h1>${state.queue.length ? `<span class="small dim">${state.queue.length} waiting</span>` : ''}</header>`;
      if (!state.queueLoaded) return `<div class="wrap stack gap20">${head}<div class="skeleton" style="height:360px"></div></div>`;
      if (!q) {
        return `<div class="wrap stack gap20">${head}${emptyState(icon.check, 'Queue clear',
          'Every question that needed you is handled. New ones land here the moment fans ask.', '<a class="btn line sm" href="#/studio/capture">Capture a story instead</a>')}</div>`;
      }
      return `<div class="wrap stack gap14">${head}
        <article class="qcard" id="swipe-card" style="touch-action:pan-y">
          <div class="row">${q.kind === 'starter' ? '<span class="kicker lav">Common fan question</span>'
            : `${initial(q.fanName || 'Fan', 30, 'var(--azure)')}<div class="grow"><b>${esc(q.fanName || 'A fan')}</b><div class="tiny dim">asked ${esc(rel(q.createdAt))}</div></div>`}</div>
          <div class="q">“${esc(q.text)}”</div>
          <hr class="divider">
          <div class="kicker lav">${esc(draftLabel(q))}</div>
          <div class="draft ${q.draft ? '' : 'empty'}">${q.draft ? esc(q.draft) : q.drafting ? 'Your Coach is drafting a reply…' : 'Tap Edit to write or dictate your answer — it ships in your voice.'}</div>
          ${q.reason ? `<div class="note" style="max-width:100%">${icon.info}<span><b>Why it needs you:</b> ${esc(q.reason)}</span></div>` : ''}
          ${q.sources?.length ? `<div class="sources"><span class="tiny dim">Grounded in</span>${q.sources.map((s) => s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>` : '').join('')}</div>` : ''}
          ${q.kind === 'starter' ? '<p class="tiny dim" style="margin:0">Approving adds this to your instant answers — fans who ask something like it hear your reply right away.</p>' : ''}
          ${q.draft ? `<div>${previewBtn('q:' + q.id, 'Hear it in your voice')}</div>` : ''}
        </article>
        <div class="controls">
          <div class="ctl no"><button data-act="decline" data-arg="${attr(q.id)}" aria-label="Delete — no reply">${icon.x}</button>Delete</div>
          <div class="ctl edit"><a class="btn" style="width:58px;height:58px;min-height:0;padding:0;border-radius:50%;background:var(--card);border:1.5px solid var(--line2);color:var(--txt2)" href="#/studio/reply/${esc(q.id)}" aria-label="Edit reply"><span style="width:22px;height:22px;display:inline-flex">${icon.edit}</span></a>Edit</div>
          <div class="ctl go"><button data-act="approve" data-arg="${attr(q.id)}" aria-label="Approve and send">${icon.check}</button>Approve</div>
        </div>
        <p class="tiny dim center" style="margin:0">Swipe right to send · left to pass</p>
      </div>`;
    },
  },

  reply: {
    tab: 'approve',
    enter: (id) => { if (!state.queueLoaded) loadQueue(); ui.replyId = id; },
    render(id) {
      const q = state.queue.find((x) => x.id === id);
      if (!q) {
        return `<div class="wrap stack gap14"><a class="link dim" href="#/studio/approve">← Approve</a>${state.queueLoaded
          ? emptyState(icon.check, 'Already handled', 'This question is no longer waiting.', '<a class="btn line sm" href="#/studio/approve">Back to the queue</a>')
          : '<div class="skeleton" style="height:240px"></div>'}</div>`;
      }
      return `<div class="wrap stack gap14"><a class="link dim" href="#/studio/approve">← Approve</a>
        <div class="card alt stack gap6"><span class="kicker dim">${q.kind === 'starter' ? 'Common fan question' : `${esc(q.fanName || 'A fan')} asked`}</span><b style="font-size:17px">${esc(q.text)}</b></div>
        <form data-form="approveEdited" data-id="${esc(q.id)}" class="stack gap14" novalidate>
          <label class="kicker lav" for="reply-text">Your reply · type, dictate, or rewrite with a note</label>
          <textarea id="reply-text" name="text" class="field" rows="7" data-keep="reply-${esc(q.id)}">${esc(q.draft || '')}</textarea>
          <div class="row" style="flex-wrap:wrap;gap:8px">
            ${canTranscribe ? `<button type="button" class="btn line sm plain" data-act="dictateReply">${icon.mic && `<span style="width:15px;height:15px;display:inline-flex">${icon.mic}</span>`} Dictate</button>` : ''}
            ${previewBtn('edit:' + q.id)}
          </div>
          ${state.config.drafting ? `<div class="card alt stack gap10"><label class="label" for="revise-note">Or tell your Coach what to change</label>
            <div class="row"><input id="revise-note" class="field" placeholder="e.g. mention I got cut at sixteen too" data-keep="revise-note">
            <button type="button" class="btn line sm" data-act="revise" data-arg="${attr(q.id)}">Rewrite</button></div></div>` : ''}
          <button class="btn block" type="submit">Approve &amp; send in my voice</button>
          <button class="btn danger block" type="button" data-act="decline" data-arg="${attr(q.id)}">Delete — I won't answer this one</button>
        </form></div>`;
    },
  },

  capture: {
    tab: 'capture', wide: true,
    enter: () => { loadPrompts(); loadStories(); if (!state.queueLoaded) loadQueue(); },
    render() {
      const prompts = [{ id: 'drop', title: 'Record a drop', src: 'Your call · you approve before it ships', hint: "Say what's on your mind — it lands in your drafts, you approve it, and fans hear it in your voice." }, ...state.prompts];
      const sel = prompts.find((p) => p.id === ui.selected) || prompts[0];
      const take = ui.take;
      return `<div class="wrap stack gap20">
        <header><h1>Capture</h1><p class="small dim" style="margin:4px 0 0">Teach your Coach — your stories become answers.</p></header>
        <div class="scroller">${prompts.map((p) => `<button class="chip ${p.id === sel.id ? 'on' : ''}" data-act="selectPrompt" data-arg="${attr(p.id)}" ${ui.recording || take ? 'disabled' : ''}>${esc(p.title)}</button>`).join('')}</div>
        <section class="card hero stack gap6"><span class="kicker lav">${esc(sel.src || 'Starter prompt')}</span><b style="font-size:19px">${esc(sel.title)}</b>
          ${sel.hint ? `<p class="small muted" style="margin:0">${esc(sel.hint)}</p>` : ''}
          ${sel.id !== 'drop' && sel.id !== 'free' && !take ? `<button class="link dim" style="align-self:flex-start;margin-top:4px" data-act="passPrompt" data-arg="${attr(sel.id)}">Pass — don't ask me this</button>` : ''}</section>
        ${take ? takeReview(take, sel) : recorder()}
        ${state.coverage.length ? `<section class="card stack gap10"><div class="section-head"><span class="kicker lav">How much your Coach knows</span><span class="tiny">from what you've approved</span></div>
          <div class="coverage">${[...state.coverage].sort((a, b) => a.pct - b.pct).map((c) => `<b>${esc(c.bucket)}</b>
            <span class="meter"><i class="${c.pct < 30 ? 'low' : ''}" style="width:${Math.max(3, Math.min(100, c.pct))}%"></i></span>
            <span class="tiny ${c.pct < 30 ? '' : 'dim'}" style="${c.pct < 30 ? 'color:var(--papaya)' : ''};text-align:right">${Math.round(c.pct)}%</span>`).join('')}</div></section>` : ''}
        ${state.stories.length ? `<section class="stack gap10"><div class="section-head"><h2>Captured</h2><span class="tiny">${state.stories.length} so far</span></div>
          ${state.stories.map((st) => `<div class="card tight stack gap6"><div class="row"><b class="grow ellipsis">${esc(st.title)}</b><span class="tiny dim">${clock(st.duration)} · ${esc(rel(st.createdAt))}</span></div>
            ${st.transcript ? `<p class="small muted" style="margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(st.transcript)}</p>` : ''}
            <div class="row"><span class="tiny" style="color:var(--mint)">✓ In your Coach's knowledge</span><span class="grow"></span><button class="link dim" data-act="deleteStory" data-arg="${attr(st.id)}">Remove</button></div></div>`).join('')}</section>` : ''}
      </div>`;
    },
  },

  coach: {
    tab: 'studio', wide: true,
    enter: () => { loadCoach(); if (!state.queueLoaded) loadQueue(); },
    render() {
      const list = state.coach;
      return `<div class="wrap stack gap14"><a class="link dim" href="#/studio">← Today</a><h1>Coach answers</h1>
        <p class="small muted" style="margin:0">When autopilot is on, your AI Coach answers questions it can ground in your public record — labelled as AI for fans. Keep what sounds like you; retract anything that doesn't and it comes back to your queue.</p>
        ${!state.coachLoaded ? '<div class="skeleton" style="height:140px"></div>' : list.length ? list.map((c) => `<article class="card stack gap10">
            <div class="row"><span class="kicker ${c.reviewed ? 'dim' : 'lav'}">${c.reviewed ? 'Kept' : 'New'} · ${esc(rel(c.answeredAt))}</span><span class="grow"></span>${c.confidence != null ? `<span class="tiny dim">confidence ${Math.round(c.confidence * 100)}%</span>` : ''}</div>
            <b>${esc(c.text)}</b>${c.fanName ? `<span class="tiny dim">asked by ${esc(c.fanName)}</span>` : ''}
            ${(() => { const it = replyItem(c, state.athlete); return it ? `<div class="row">${playBtn(it, 'sm')}${wave(it.id, 22)}<span class="time" data-time="${esc(it.id)}" data-dur="${c.duration || 0}">${clock(c.duration)}</span></div>` : ''; })()}
            <p class="small muted" style="margin:0;line-height:1.6">${esc(c.answer || '')}</p>
            ${c.sources?.length ? `<div class="sources">${c.sources.map((s) => s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>` : '').join('')}</div>` : ''}
            <div class="row">${c.reviewed ? '' : `<button class="btn sm" data-act="keepCoach" data-arg="${attr(c.id)}">Keep</button>`}
              <button class="btn line warn sm" data-act="retractCoach" data-arg="${attr(c.id)}">Retract</button></div></article>`).join('')
          : emptyState(icon.spark, 'Nothing yet', state.config.autopilot ? 'When your Coach answers on its own, it shows up here for you to review.' : 'Autopilot is off — every answer waits for you.')}
      </div>`;
    },
  },

  settings: {
    tab: 'settings', wide: true,
    enter: () => { loadSettings(); loadSDrops(); loadBio(); if (!state.queueLoaded) loadQueue(); },
    render() {
      const s = state.settings;
      const c = state.config;
      const published = [...(state.sdrops?.published || [])].sort((a, b) => (b.listens || 0) - (a.listens || 0));
      const tog = (key, label, sub, opts = {}) => `<div class="setting"><div class="grow"><b>${esc(label)}</b>${opts.locked ? ' <span class="tiny dim">· always on</span>' : ''}<div class="small dim">${esc(sub)}</div></div>
        <label class="toggle"><input type="checkbox" ${opts.checked ? 'checked' : ''} ${opts.disabled ? 'disabled' : ''} data-act="${opts.locked ? 'noop' : 'setting'}" data-arg="${attr(key)}" aria-label="${esc(label)}"><span></span></label></div>`;
      return `<div class="wrap stack gap20"><h1>Studio</h1>
        <section class="card hero stack gap10"><span class="kicker lav">Your Coach · voice model</span>
          <div class="row">${ava(state.athlete, 46)}<div class="grow"><b style="font-size:18px">${esc(state.athlete?.coachName || `Coach ${firstName()}`)}</b><div class="small dim">Your digital twin — fans hear you, trained by you</div></div></div>
          <div class="row tiny" style="gap:14px">${cap('Drafting', c.drafting)}${cap('Voice', c.voice)}${cap('Autopilot', c.autopilot)}</div>
          <p class="small dim" style="margin:0">Your Coach only ever says words you wrote or approved — unless you turn autopilot on, and then it's labelled AI for fans.</p></section>
        <section class="card" style="padding:4px 16px"><div class="kicker lav" style="padding:12px 0 4px">Guardrails</div>
          ${tog('review', 'Approve every reply before it sends', c.autopilot && s?.autopilot ? 'Everything except the grounded answers your Coach sends on autopilot' : 'Nothing reaches fans without you', { locked: true, checked: true, disabled: true })}
          ${tog('guardTopics', 'Stick to your topics', 'Training, mindset, leadership, career and the game', { checked: s?.guardTopics, disabled: !s })}
          ${tog('guardDecline', 'Auto-decline sensitive asks', 'Medical, betting and legal questions get a polite pass', { checked: s?.guardDecline, disabled: !s })}
          ${tog('autopilot', 'Let my Coach answer on autopilot', c.autopilot ? "Only answers grounded in your public record; labelled AI for fans; you can retract any of them" : 'Needs your written OK first — ask the Strive team to switch it on', { checked: s?.autopilot, disabled: !s || !c.autopilot })}
        </section>
        <section class="card" style="padding:4px 16px">
          ${tog('paused', 'Pause new questions', 'Fans can still listen to everything — they just can’t ask for now', { checked: s?.paused, disabled: !s })}
          ${s?.paused ? `<p class="small" style="color:var(--papaya);margin:0 0 12px">Fans see: ${esc(firstName())} is away for a bit — questions reopen soon.</p>` : ''}</section>
        <button class="card row" data-act="openBio" style="text-align:left;width:100%"><span style="width:20px;height:20px;color:var(--lav);display:inline-flex">${icon.you}</span>
          <div class="grow"><b>Voice bio</b><div class="small" style="color:${state.bio?.status === 'approved' ? 'var(--dim2)' : 'var(--papaya)'}">${state.bio?.status === 'approved' ? 'Approved — the first thing new fans hear' : 'Needs your OK before fans hear it'}</div></div>
          <span class="link">${state.bio?.status === 'approved' ? 'Edit' : 'Review'}</span></button>
        <section class="card stack gap10"><div class="section-head"><span class="kicker lav">Your drops · by listens</span><span class="tiny">pin your best to your profile</span></div>
          ${published.length ? published.map((d) => `<div class="row"><div class="grow"><b class="ellipsis" style="display:block">${esc(d.title)}</b><span class="tiny dim">${d.listens || 0} listens · ${esc(rel(d.publishedAt))}</span></div>
              <button class="btn ${d.pinned ? '' : 'line'} sm" data-act="pin" data-arg="${attr({ id: d.id, pinned: !d.pinned })}">${d.pinned ? 'Pinned' : 'Pin'}</button></div>`).join('')
            : '<p class="small muted" style="margin:0">Nothing published yet. Approve a drafted drop on Today and it ships at 7 AM.</p>'}</section>
        <section class="card" style="padding:4px 14px">
          <a class="list-row" href="privacy.html">Privacy Policy</a><a class="list-row" href="terms.html">Terms of Use</a><a class="list-row" href="support.html">Help &amp; support</a>
          <button class="list-row" style="width:100%;color:var(--red)" data-act="signOut">Sign out</button></section>
      </div>`;
    },
  },
};

// ---------- pieces ----------
function header() {
  return `<header class="row"><div class="grow"><h1>${esc(greeting())}, ${esc(firstName())}</h1><div class="small dim">${esc(today())}</div></div>${ava(state.athlete, 44)}</header>`;
}
const stat = (v, label, note) => `<div class="stat"><b>${esc(v)}</b><span class="kicker dim">${esc(label)}</span><div class="tiny dim">${esc(note)}</div></div>`;
const cap = (label, on) => `<span style="display:inline-flex;align-items:center;gap:6px;font-weight:700;color:${on ? 'var(--txt2)' : 'var(--dim2)'}"><span class="dot" style="background:${on ? 'var(--mint)' : 'var(--dim)'}"></span>${esc(label)}</span>`;
function draftLabel(q) {
  if (q.draftSource === 'coach') return 'Coach draft · grounded in your record';
  if (q.draftSource === 'claude') return 'AI draft · from your past answers';
  if (q.draftSource === 'starter') return 'Starter draft · make it yours';
  return q.draft ? 'Draft' : 'No draft yet';
}
function shipLabel(i, first) {
  if (!first) return i === 0 ? 'NEXT' : 'LATER';
  const d = new Date(first + i * 86400000);
  const now = new Date();
  const days = Math.round((new Date(d.toDateString()) - new Date(now.toDateString())) / 86400000);
  return days <= 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}
function draftCard(d) {
  return `<article class="card stack gap10"><div><b style="font-size:16px">${esc(d.title)}</b>${d.source ? `<div class="tiny dim">${esc(d.source)}</div>` : ''}</div>
    <p class="small muted" style="margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(d.script)}</p>
    <div>${previewBtn('drop:' + d.id)}</div>
    <div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn sm" data-act="approveDrop" data-arg="${attr(d.id)}">Approve → queue</button>
      <button class="btn line plain sm" data-act="editDrop" data-arg="${attr(d.id)}">Edit</button>
      <button class="btn line warn sm" data-act="rejectDrop" data-arg="${attr(d.id)}">Redraft</button></div></article>`;
}
function recorder() {
  if (!canRecord) return `<div class="card empty"><p class="muted" style="margin:0">This browser can't record audio. Open Strive in Safari or Chrome to capture.</p></div>`;
  return `<section class="stack gap10" style="align-items:center;padding:6px 0">
    <span class="kicker ${ui.recording ? 'papaya' : 'dim'}" data-rec-label>${ui.recording ? '● Recording' : 'Tap to talk'}</span>
    <button class="rec-orb ${ui.recording ? 'on' : ''}" data-act="${ui.recording ? 'stopRec' : 'startRec'}" aria-label="${ui.recording ? 'Stop recording' : 'Start recording'}">${ui.recording ? icon.stop : icon.mic}</button>
    ${ui.recording ? `<p class="small muted center" data-live style="margin:0;min-height:42px;max-width:520px">${esc(ui.live || (canTranscribe ? 'Listening…' : 'Recording — you can type the words after.'))}</p>`
      : '<p class="tiny dim center" style="margin:0">30 seconds or three minutes — whatever the story needs.</p>'}
  </section>`;
}
function takeReview(take, sel) {
  const isDrop = sel.id === 'drop';
  const item = { id: 'take:' + take.id, title: 'Your take', subtitle: 'Not saved yet', url: take.url, duration: take.duration };
  return `<form class="card stack gap14" data-form="saveTake" novalidate>
    <div class="row">${playBtn(item, 'subtle sm')}${wave(item.id, 26, 'lav')}<span class="time" data-time="${esc(item.id)}" data-dur="${take.duration}">${clock(take.duration)}</span></div>
    <label class="kicker lav" for="take-text">${take.transcript ? 'What we heard — fix anything' : 'Type what you said'}</label>
    ${isDrop ? '<input name="title" class="field" placeholder="Title (optional)" maxlength="80" data-keep="take-title">' : ''}
    <textarea id="take-text" name="transcript" class="field" rows="5" data-keep="take-text">${esc(take.transcript || '')}</textarea>
    <div class="row" style="gap:10px"><button class="btn sm" type="submit">${isDrop ? 'Send to drafts' : 'Save to your Coach'}</button><button type="button" class="btn line warn sm" data-act="discardTake">Discard</button></div>
    <p class="tiny dim" style="margin:0">${isDrop ? 'Nothing ships until you approve it on Today.' : "Stories stay private — they teach your Coach what you'd say. Fans only hear what you approve."}</p>
  </form>`;
}

// ---------- swipe ----------
function bindSwipe() {
  const card = document.getElementById('swipe-card');
  if (!card) return;
  let x0 = 0, y0 = 0, dx = 0, dragging = false, decided = false;
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, input, textarea')) return;
    dragging = true; decided = false; x0 = e.clientX; y0 = e.clientY; dx = 0;
    card.style.transition = 'none';
  });
  card.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (!decided) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { dragging = false; return; } // a scroll
      if (Math.abs(dx) > 10) { decided = true; try { card.setPointerCapture(e.pointerId); } catch {} }
    }
    if (decided) card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = 'transform .25s ease';
    const id = state.queue[0]?.id;
    if (decided && dx > 110 && id) { card.style.transform = 'translateX(120vw) rotate(20deg)'; setTimeout(() => approve(id), 180); }
    else if (decided && dx < -110 && id) { card.style.transform = 'translateX(-120vw) rotate(-20deg)'; setTimeout(() => decline(id), 180); }
    else card.style.transform = '';
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

// ---------- decisions ----------
async function approve(id, textOverride) {
  const q = state.queue.find((x) => x.id === id);
  if (!q) return;
  const text = (textOverride ?? q.draft ?? '').trim();
  if (!text) {
    toast('Add your words first — then approve.');
    location.hash = `#/studio/reply/${id}`;
    return;
  }
  const s = sheet(`<div class="stack gap14 center" style="align-items:center;padding:16px 0"><span class="spin" style="width:34px;height:34px;color:var(--mint)"></span>
    <h2 style="color:var(--txt)">Voicing your reply…</h2><p class="small muted" style="margin:0">${q.kind === 'starter' ? 'Adding it to your instant answers.' : 'Your fan will hear it in your voice.'}</p></div>`);
  try {
    await api.post(`studio/questions/${id}/approve`, { text });
    toast(q.kind === 'starter' ? 'Added to your instant answers ✓' : q.fanName ? `Sent to ${q.fanName} — in your voice ✓` : 'Sent — in your voice ✓');
    state.queue = state.queue.filter((x) => x.id !== id);
  } catch (e) {
    if (e.status === 409) { state.queue = state.queue.filter((x) => x.id !== id); toast('Already handled — it went out from another screen.'); }
    else toast(message(e), 'error');
  }
  s.close();
  if (location.hash.startsWith('#/studio/reply/')) location.hash = '#/studio/approve';
  render();
  loadToday();
}
async function decline(id) {
  try { await api.post(`studio/questions/${id}/decline`); }
  catch (e) { if (e.status !== 409 && e.status !== 404) { toast(message(e), 'error'); render(); return; } }
  const q = state.queue.find((x) => x.id === id);
  state.queue = state.queue.filter((x) => x.id !== id);
  toast(q?.kind === 'starter' ? 'Removed.' : 'Passed — no reply sent.');
  if (location.hash.startsWith('#/studio/reply/')) location.hash = '#/studio/approve';
  render();
  loadToday();
}

function dropById(id) { return state.today?.draftDrops.find((d) => d.id === id) || state.sdrops?.drafts.find((d) => d.id === id); }

export const acts = {
  reloadToday: () => loadToday(),
  noop() {},
  preview(el) {
    const id = JSON.parse(el.dataset.arg);
    const [kind, ref] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
    if (kind === 'q') { const q = state.queue.find((x) => x.id === ref); return preview(q?.draft, id, 'Reply preview'); }
    if (kind === 'edit') return preview(document.getElementById('reply-text')?.value, id, 'Reply preview');
    if (kind === 'drop') { const d = dropById(ref); return preview(d?.script, id, d?.title || 'Drop preview'); }
    if (kind === 'dropedit') return preview(document.getElementById('drop-script')?.value, id, 'Drop preview');
    if (kind === 'bio') return preview(document.getElementById('bio-text')?.value, id, 'Your voice bio');
  },
  approve(el) { approve(JSON.parse(el.dataset.arg)); },
  decline(el) { decline(JSON.parse(el.dataset.arg)); },
  dictateReply(el) {
    const field = document.getElementById('reply-text');
    if (!field) return;
    const base = field.value.trim();
    el.disabled = true;
    const sr = dictate((t, final) => { field.value = (base ? base + ' ' : '') + t; if (final) el.disabled = false; });
    if (sr) sr.onend = () => { el.disabled = false; };
  },
  async revise(el) {
    const id = JSON.parse(el.dataset.arg);
    const note = document.getElementById('revise-note')?.value.trim();
    const field = document.getElementById('reply-text');
    if (!note || !field) return toast('Tell your Coach what to change first.');
    await busy(el, async () => {
      try {
        const r = await api.post(`studio/questions/${id}/revise`, { text: field.value, note });
        field.value = r.draft;
        const q = state.queue.find((x) => x.id === id);
        if (q) q.draft = r.draft;
        document.getElementById('revise-note').value = '';
        toast('Draft rewritten — give it a read.');
      } catch (e) { toast(message(e), 'error'); }
    });
  },
  async approveDrop(el) {
    const id = JSON.parse(el.dataset.arg);
    await busy(el, async () => {
      try { await api.post(`studio/drops/${id}/approve`, { publishNow: false }); toast('Approved — queued in your voice'); await loadToday(); }
      catch (e) { toast(message(e), 'error'); }
    });
  },
  async rejectDrop(el) {
    const id = JSON.parse(el.dataset.arg);
    await busy(el, async () => {
      try { await api.post(`studio/drops/${id}/reject`); toast('Sent back — your Coach will take another angle.'); await loadToday(); }
      catch (e) { toast(message(e), 'error'); }
    });
  },
  editDrop(el) {
    const d = dropById(JSON.parse(el.dataset.arg));
    if (!d) return;
    const s = sheet(`<form class="stack gap14" data-form="saveDrop" data-id="${esc(d.id)}" novalidate><h1 style="font-size:22px">Edit drop</h1>
      <label class="label" for="drop-title">Title</label><input id="drop-title" name="title" class="field" value="${esc(d.title)}" maxlength="80">
      <label class="label" for="drop-script">What fans will hear</label><textarea id="drop-script" name="script" class="field" rows="8">${esc(d.script)}</textarea>
      <div>${previewBtn('dropedit:' + d.id)}</div>
      <button class="btn block" type="submit" name="when" value="queue">Approve &amp; queue</button>
      <button class="btn line block" type="submit" name="when" value="now">Publish now instead</button>
      <button class="btn quiet" type="button" data-close>Cancel</button></form>`);
    ui.closeSheet = s.close;
  },
  openBio() {
    const s = sheet(`<form class="stack gap14" data-form="saveBio" novalidate><h1 style="font-size:22px">Voice bio</h1>
      <p class="small muted" style="margin:0">The first thing a new fan hears — who you are, in your own words. Keep it short and yours.</p>
      <textarea id="bio-text" name="text" class="field" rows="8">${esc(state.bio?.text || '')}</textarea>
      ${state.bio?.status === 'approved' ? '<p class="tiny" style="color:var(--mint);margin:0">✓ Approved — fans hear this on your profile</p>' : ''}
      <div>${previewBtn('bio:me')}</div>
      <button class="btn block" type="submit">Approve</button><button class="btn quiet" type="button" data-close>Cancel</button></form>`);
    ui.closeSheet = s.close;
    if (!state.bio) loadBio().then(() => { const t = document.getElementById('bio-text'); if (t && !t.value) t.value = state.bio?.text || ''; });
  },
  async setting(el) {
    const key = JSON.parse(el.dataset.arg);
    const value = el.checked;
    const prev = state.settings;
    state.settings = { ...prev, [key]: value };
    try { set({ settings: await api.patch('studio/settings', { [key]: value }) }); }
    catch (e) { set({ settings: prev }); toast(message(e), 'error'); }
  },
  async pin(el) {
    const { id, pinned } = JSON.parse(el.dataset.arg);
    await busy(el, async () => {
      try { await api.post(`studio/drops/${id}/pin`, { pinned }); toast(pinned ? 'Pinned to your profile' : 'Unpinned'); await loadSDrops(); }
      catch (e) { toast(message(e), 'error'); }
    });
  },
  async keepCoach(el) {
    const id = JSON.parse(el.dataset.arg);
    await busy(el, async () => {
      try { await api.post(`studio/questions/${id}/keep`); toast('Kept'); await loadCoach(); } catch (e) { toast(message(e), 'error'); }
    });
  },
  async retractCoach(el) {
    const id = JSON.parse(el.dataset.arg);
    await busy(el, async () => {
      try { await api.post(`studio/questions/${id}/retract`); toast('Retracted — it’s back in your queue.'); await Promise.all([loadCoach(), loadQueue()]); }
      catch (e) { toast(message(e), 'error'); }
    });
  },
  signOut() {
    const s = sheet(`<div class="stack gap14"><h1 style="font-size:22px">Sign out of your studio?</h1>
      <button class="btn danger block" data-act="confirmSignOut">Sign out</button><button class="btn line plain block" data-close>Stay signed in</button></div>`);
    ui.closeSheet = s.close;
  },
  async confirmSignOut() { ui.closeSheet && ui.closeSheet(); await signOut(); },
  selectPrompt(el) { ui.selected = JSON.parse(el.dataset.arg); render(); },
  async passPrompt(el) {
    const id = JSON.parse(el.dataset.arg);
    state.prompts = state.prompts.filter((p) => p.id !== id);
    ui.selected = 'drop';
    render();
    try { await api.post(`studio/prompts/${id}/pass`); toast("Noted — we won't ask you that again."); } catch {}
  },
  async startRec() {
    if (ui.recording) return;
    try {
      ui.live = '';
      ui.rec = await startRecording({ onText: (t) => { ui.live = t; const p = document.querySelector('[data-live]'); if (p) p.textContent = t; } });
      ui.recording = true;
      render();
    } catch {
      toast('Microphone is off for this site — allow it in your browser settings to record.', 'error');
    }
  },
  async stopRec() {
    if (!ui.rec) return;
    const rec = ui.rec;
    ui.rec = null;
    ui.recording = false;
    render();
    const take = await rec.stop();
    if (take.duration < 0.8 || !take.blob.size) { toast('That was very short — try again.'); return render(); }
    ui.take = { ...take, id: String(Date.now()), url: URL.createObjectURL(take.blob) };
    render();
  },
  discardTake() {
    if (ui.take) { if (player.isCurrent('take:' + ui.take.id)) player.stop(); URL.revokeObjectURL(ui.take.url); }
    ui.take = null;
    render();
  },
  async deleteStory(el) {
    const id = JSON.parse(el.dataset.arg);
    state.stories = state.stories.filter((s) => s.id !== id);
    render();
    try { await api.del(`studio/stories/${id}`); } catch {}
  },
};

export const forms = {
  approveEdited(form) { approve(form.dataset.id, form.text.value); },
  async saveDrop(form, e) {
    const now = e.submitter?.value === 'now';
    const btn = e.submitter || form.querySelector('[type=submit]');
    await busy(btn, async () => {
      try {
        await api.post(`studio/drops/${form.dataset.id}/approve`, { title: form.title.value.trim(), script: form.script.value.trim(), publishNow: now });
        toast(now ? 'Published — fans can hear it now' : 'Approved — queued in your voice');
        ui.closeSheet && ui.closeSheet();
        await Promise.all([loadToday(), loadSDrops()]);
      } catch (err) { toast(message(err), 'error'); }
    });
  },
  async saveBio(form) {
    const text = form.text.value.trim();
    if (!text) return;
    await busy(form.querySelector('[type=submit]'), async () => {
      try { set({ bio: await api.post('studio/bio', { text }) }); toast('Bio approved — fans hear it on your profile'); ui.closeSheet && ui.closeSheet(); loadToday(); }
      catch (e) { toast(message(e), 'error'); }
    });
  },
  async saveTake(form) {
    const take = ui.take;
    const transcript = form.transcript.value.trim();
    if (!take) return;
    if (!transcript) return toast('Add the words first so your Coach can learn from them.');
    const sel = ui.selected;
    await busy(form.querySelector('[type=submit]'), async () => {
      try {
        if (sel === 'drop') {
          const title = form.title?.value.trim() || transcript.slice(0, 42);
          await api.post('studio/drops', { title, script: transcript });
          toast('In your drafts — approve it on Today');
          loadToday();
        } else {
          const prompt = state.prompts.find((p) => p.id === sel);
          const audio = take.blob.size < 15e6 ? await toBase64(take.blob) : null;
          const r = await api.post('studio/stories', { promptId: sel, title: prompt?.title || 'Story', transcript, duration: take.duration, audio });
          state.stories.unshift(r.story);
          toast('Saved — your Coach learns from this');
          ui.selected = 'drop';
          loadPrompts();
        }
        acts.discardTake();
      } catch (e) { toast(message(e), 'error'); }
    });
  },
};

export function poll(route) {
  loadQueue();   // keeps the Approve badge current on every studio screen
  if (route === 'studio') loadToday();
}

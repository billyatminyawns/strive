// Fan app: Home · Ask · Library · You · Notifications. Everything shown is athlete-approved (or clearly
// labelled AI when Coach Angela answers on autopilot).
import { esc, attr, icon, clock, rel, greeting, today, ava, initial, photo, wave, playBtn, disclose, toast, sheet, busy, emptyState, spinner } from './ui.js';
import { state, set, render, firstName, cache, updateProfile, updateAthlete, deleteAccount, signOut } from './state.js';
import { api, message } from './api.js';
import { player, dropItem, replyItem, bioItem } from './player.js';
import { INTERESTS } from './onboard.js';
import { identitiesCard, available as signInAvailable, isIOS, inAppBrowser, standalone } from './signin.js';

const ui = { libraryTab: 'saved', sending: false, askedOnce: false };

// ---------- data ----------
export async function loadHome() {
  try {
    const home = await api.get('home');
    updateAthlete(home.athlete);
    cache('home', home);
    set({ home, homeError: null, unread: home.unread });
  } catch (e) {
    if (!state.home) set({ homeError: message(e) });
  }
}
export async function loadQuestions() {
  try {
    const r = await api.get('questions');
    cache('questions', r);
    set({ questions: r.questions, paused: r.paused, threadLoaded: true });
  } catch {}
}
export async function loadDrops() {
  try {
    const r = await api.get('drops');
    set({ drops: r.drops, dropsLoaded: true });
  } catch {}
}
export async function loadNotifications() {
  try {
    const r = await api.get('notifications');
    set({ notifications: r.notifications, unread: r.unread });
  } catch {}
}
export function hydrate() {
  const home = cache('home');
  const q = cache('questions');
  if (home) state.home = home;
  if (q) Object.assign(state, { questions: q.questions, paused: q.paused });
}

player.onCredit((dropId) => {
  const mark = (list) => (list || []).forEach((d) => { if (d.id === dropId) d.listened = true; });
  if (state.home) { mark(state.home.picks); mark(state.home.suggested); if (state.home.today?.id === dropId) state.home.today.listened = true; }
  mark(state.drops);
  api.post(`drops/${dropId}/listen`).catch(() => {});
});

const suggestions = () => {
  const asked = new Set(state.questions.map((q) => q.text.toLowerCase()));
  return (state.home?.suggestions || []).filter((s) => !asked.has(s.toLowerCase()));
};

// ---------- shared pieces ----------
function dropRow(d, badge = '') {
  const item = dropItem(d, state.athlete);
  return `<div class="drop-row">
    ${item ? playBtn(item, 'subtle sm') : ''}
    <div class="grow"><div class="t ellipsis">${esc(d.title)}</div>
      <div class="tiny dim"><span class="time" data-time="${esc(item?.id || '')}" data-dur="${d.duration || 0}">${clock(d.duration)}</span>${d.listened ? ' · <span style="color:var(--mint)">✓ Played</span>' : ''}</div></div>
    ${badge ? `<span class="pill">${esc(badge)}</span>` : item ? `<span style="width:64px">${wave(item.id, 12)}</span>` : ''}
  </div>`;
}

function replyCard(q, compact = false) {
  const item = replyItem(q, state.athlete);
  const coach = q.answeredBy === 'coach';
  const label = coach ? '<span class="pill lav">AI Coach</span>' : q.status === 'instant' || q.answeredBy === 'library' ? '<span class="pill lav">Instant</span>' : '';
  const sources = coach && q.sources?.length
    ? `<div class="sources"><span class="tiny dim">From ${esc(firstName())}'s public record</span>${q.sources.map((s) => s.url
        ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>` : `<span class="tiny dim">${esc(s.title || '')}</span>`).join('')}</div>` : '';
  return `<article class="reply" aria-label="${coach ? 'AI Coach' : esc(firstName())} reply">
    <div class="row" style="gap:8px">${ava(state.athlete, 26)}
      <b style="font-size:14px">${coach ? `Coach ${esc(firstName())}` : esc(firstName())}</b>
      <span style="color:var(--mint);width:13px;height:13px;display:inline-flex">${icon.seal}</span>
      ${label}<span class="grow"></span>
      <button class="play subtle sm" data-act="save" data-arg="${attr(q.id)}" aria-label="${q.saved ? 'Remove from Library' : 'Save to Library'}" style="box-shadow:none">${q.saved ? icon.bookmarkOn : icon.bookmark}</button>
    </div>
    ${compact ? `<div style="font-weight:700;color:var(--txt2)">${esc(q.text)}</div>` : ''}
    ${item ? `<div class="row">${playBtn(item)}${wave(item.id, 26)}<span class="time" data-time="${esc(item.id)}" data-dur="${q.duration || 0}">${clock(q.duration)}</span></div>` : ''}
    ${q.answer ? `<details><summary class="link dim" style="cursor:pointer;list-style:none">Read along</summary><p class="words" style="margin:8px 0 0">${esc(q.answer)}</p></details>` : ''}
    ${sources}
    ${coach ? `<span class="disclose">${icon.spark}AI in ${esc(firstName())}'s voice · grounded in her public record</span>` : disclose(firstName())}
  </article>`;
}

function exchange(q) {
  const me = `<div class="bubble-me">${esc(q.text)}</div>`;
  if (q.status === 'answered' || q.status === 'instant') return me + replyCard(q);
  if (q.status === 'pending') return me + `<div class="note wait">${icon.clock}<span>${esc(q.note || (state.config.autopilot ? `With ${firstName()} — her AI Coach answers what her public record covers, and she answers the rest herself.` : `With ${firstName()} — she reviews every answer before it's sent.`))}</span></div>`;
  if (q.status === 'guarded' || q.status === 'declined') return me + `<div class="note stop">${icon.hand}<span>${esc(q.note || `${firstName()} passed on this one.`)}</span></div>`;
  return me;
}

// On iPhone the Home Screen app has its own storage, so it only helps once the seat is saved.
const installCard = () => {
  if (standalone() || inAppBrowser || cache('installHidden')) return '';
  const share = `<span style="color:var(--mint);width:22px;height:22px;display:inline-flex">${icon.share}</span>`;
  const dismiss = `<button class="btn quiet" data-act="hideInstall" aria-label="Dismiss">${icon.x}</button>`;
  if (window.__installPrompt) {
    return `<div class="card row">${share}
      <div class="grow"><b>Install Strive</b><div class="tiny dim">One tap to open, like any app.</div></div>
      <button class="btn sm" data-act="install">Install</button>${dismiss}</div>`;
  }
  if (!isIOS) return '';
  const saved = state.identities.length;
  if (!saved && !signInAvailable()) return ''; // the Home Screen app would start a brand-new account
  if (!saved) {
    return `<div class="card row">${share}
      <div class="grow"><b>Save your seat, then add Strive to your Home Screen</b><div class="tiny dim">On iPhone the Home Screen app signs in separately — save your seat first so you can get back in there.</div></div>
      <button class="btn sm" data-act="openSignin">Save</button>${dismiss}</div>`;
  }
  const email = state.identities.find((i) => i.email)?.email;
  return `<div class="card row">${share}
    <div class="grow"><b>Add Strive to your Home Screen</b><div class="tiny dim">In Safari, tap Share, then “Add to Home Screen”. Open it and sign in${email ? ` with an email code to ${esc(email)}` : ''}.</div></div>
    ${dismiss}</div>`;
};

// ---------- screens ----------
export const screens = {
  home: {
    tab: 'home',
    enter: () => loadHome(),
    render() {
      const h = state.home;
      const a = h?.athlete || state.athlete;
      const name = state.user?.name;
      let body;
      if (!h && state.homeError) {
        body = `<div class="card empty"><p class="muted" style="margin:0">${esc(state.homeError)}</p><button class="btn line sm" data-act="reloadHome">Try again</button></div>`;
      } else if (!h) {
        body = `<div class="skeleton" style="height:290px"></div><div class="skeleton" style="height:120px"></div>`;
      } else {
        const t = h.today;
        const item = t && dropItem(t, a);
        const bio = a.bio && bioItem(a);
        body = `
          ${t ? `<article class="card hero" style="padding:0;overflow:hidden">
              <div class="hero-img" style="height:210px"><img src="${esc(photo(a, 'hero'))}" alt="" style="object-position:50% 22%">
                <div class="over"><div class="kicker">${t.listened ? "Today's drop · played" : "Today's drop"}</div>
                <div style="font-size:24px;font-weight:800;line-height:1.2;margin-top:4px">${esc(t.title)}</div></div></div>
              ${item ? `<div class="row" style="padding:14px 18px 18px">${playBtn(item, 'lg')}<div class="grow stack gap6">${wave(item.id, 32)}${disclose(a.firstName)}</div>
                <span class="time" data-time="${esc(item.id)}" data-dur="${t.duration || 0}">${clock(t.duration)}</span></div>` : ''}
            </article>` : ''}
          ${a.bio ? `<section class="card stack gap10">
              <div class="kicker">Who is ${esc(a.firstName)} · in her own voice</div>
              <div class="row">${ava(a, 46)}<div class="grow"><b style="font-size:16px">${esc(a.name)}</b><div class="tiny dim ellipsis">${esc(a.headline || '')}</div></div>${bio ? playBtn(bio) : ''}</div>
              ${a.badges?.length ? `<div class="chips">${a.badges.map((b) => `<span class="pill" style="color:var(--txt2)">${esc(b)}</span>`).join('')}</div>` : ''}
              <details><summary class="link" style="cursor:pointer;list-style:none">Read her intro</summary><p class="muted" style="margin:8px 0 0;line-height:1.6">${esc(a.bio.text)}</p></details>
            </section>` : ''}
          ${h.picks.length ? `<section class="stack gap10"><div class="section-head"><h2>${esc(a.firstName)}'s picks</h2><span class="tiny">pinned by her</span></div>${h.picks.map((d) => dropRow(d, 'Pinned')).join('')}</section>` : ''}
          ${h.suggested.length ? `<section class="stack gap10"><div class="section-head"><h2>Suggested for you</h2><span class="tiny">things you didn't know to ask</span></div>${h.suggested.map((d) => dropRow(d)).join('')}</section>` : ''}
          ${!t && !h.picks.length && !h.suggested.length ? emptyState(icon.wave, `${a.firstName}'s first drops are on the way`,
            'She approves every one before it reaches you. In the meantime, ask her anything.', `<a class="btn line sm" href="#/ask">Ask ${esc(a.firstName)}</a>`) : ''}
          <a class="card row" href="#/ask" style="text-decoration:none;color:var(--txt)">
            <span style="width:44px;height:44px;border-radius:50%;background:var(--chip-bg);color:var(--mint);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0"><span style="width:20px;height:20px;display:inline-flex">${icon.ask}</span></span>
            <div class="grow"><b>Got a question for ${esc(a.firstName)}?</b><div class="tiny dim">${state.config.autopilot ? 'She replies in her voice — her AI Coach handles what her record covers.' : 'She reviews every answer and replies in her voice.'}</div></div>
            <span style="width:18px;height:18px;color:var(--dim);display:inline-flex">${icon.chev}</span></a>
          ${installCard()}`;
      }
      return `<div class="wrap stack gap28">
        <header class="row">
          <div class="grow"><h1>${esc(greeting())}${name ? `, ${esc(name)}` : ''}</h1><div class="small dim">${esc(today())}</div></div>
          <a href="#/notifications" class="play subtle" style="position:relative;box-shadow:none;color:var(--txt2)" aria-label="Notifications${state.unread ? `, ${state.unread} unread` : ''}">
            <span style="width:20px;height:20px;display:inline-flex">${icon.bell}</span>
            ${state.unread ? '<span class="dot" style="position:absolute;top:6px;right:7px;border:2px solid var(--bg)"></span>' : ''}</a>
        </header>
        ${body}
      </div>`;
    },
  },

  ask: {
    tab: 'ask',
    enter: () => { loadQuestions(); if (!state.home) loadHome(); },
    mount() {
      const t = document.getElementById('thread');
      if (t && !ui.scrolledOnce) { ui.scrolledOnce = true; window.scrollTo(0, document.body.scrollHeight); }
    },
    render() {
      const a = state.athlete;
      const first = firstName();
      const sugg = suggestions();
      return `<div class="wrap ask-screen" style="max-width:680px">
        <header class="row" style="margin-bottom:16px">${ava(a, 40)}
          <div class="grow"><h1 style="font-size:22px">Ask ${esc(first)}</h1>
          <div class="tiny dim">${state.config.autopilot ? 'Anything her AI Coach says on its own is labelled.' : 'She reviews every answer before it’s sent.'}</div></div></header>
        <div class="thread" id="thread" aria-live="polite">
          <div class="note" style="max-width:100%;background:var(--card2)">${ava(a, 30)}
            <span>Ask anything about training, mindset, leadership, or the game. ${esc(first)} reviews ${state.config.autopilot ? 'her replies before they’re sent (her AI Coach labels the ones it answers from her public record)' : 'every reply before it’s sent'} — and answers she's already approved come back instantly, in her voice.</span></div>
          ${!state.threadLoaded && !state.questions.length ? `<div class="skeleton" style="height:70px"></div>` : state.questions.map(exchange).join('')}
        </div>
        <div class="composer">
          ${state.paused ? `<div class="note" style="max-width:100%;margin-bottom:10px"><span style="color:var(--papaya)">●</span><span>${esc(first)} is away for a bit — questions reopen soon. Everything she's shared is still here.</span></div>`
            : sugg.length && state.questions.length < 8 ? `<div class="scroller" style="margin-bottom:10px">${sugg.map((s) => `<button class="chip ask" data-act="askSuggestion" data-arg="${attr(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
          <form data-form="ask" novalidate>
            <label class="sr" for="ask-text">Your question</label>
            <textarea id="ask-text" name="text" class="field" rows="1" maxlength="300" placeholder="Ask ${esc(first)} anything…"
              enterkeyhint="send" data-keep="ask-text" data-input="askTyping" ${state.paused ? 'disabled' : ''}></textarea>
            <button class="send" type="submit" aria-label="Send question" ${state.paused ? 'disabled' : ''}>${ui.sending ? spinner() : `<span style="width:20px;height:20px;display:inline-flex">${icon.up}</span>`}</button>
          </form>
        </div>
      </div>`;
    },
  },

  library: {
    tab: 'library',
    enter: () => { if (!state.threadLoaded) loadQuestions(); loadDrops(); },
    render() {
      const saved = state.questions.filter((q) => q.saved && q.audioKey && (q.status === 'answered' || q.status === 'instant')).reverse();
      const tab = ui.libraryTab;
      const seg = (id, label) => `<button class="chip ${tab === id ? 'on' : ''}" data-act="libraryTab" data-arg="${attr(id)}" aria-pressed="${tab === id}">${label}</button>`;
      let body;
      if (tab === 'saved') {
        body = saved.length ? saved.map((q) => replyCard(q, true)).join('')
          : emptyState(icon.bookmark, 'Nothing saved yet', `Tap the bookmark on any reply from ${firstName()} to keep it here.`, '<a class="btn line sm" href="#/ask">Ask a question</a>');
      } else {
        body = !state.dropsLoaded ? '<div class="skeleton" style="height:64px"></div>'.repeat(3)
          : state.drops.length ? state.drops.map((d) => dropRow(d, d.pinned ? 'Pinned' : '')).join('')
          : emptyState(icon.wave, 'No drops yet', `Every drop is approved by ${firstName()} before it's published. The first ones are on the way.`);
      }
      return `<div class="wrap stack gap20"><h1>Library</h1><div class="chips">${seg('saved', 'Saved replies')}${seg('drops', 'All drops')}</div>
        <div class="stack gap10">${body}</div></div>`;
    },
  },

  you: {
    tab: 'you',
    render() {
      const u = state.user || {};
      const a = state.athlete;
      const since = u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '';
      const picked = u.interests || [];
      return `<div class="wrap stack gap20">
        <header class="row">${initial(u.name || 'F', 58)}<div class="grow"><h1 style="font-size:23px">${esc(u.name || 'Founding fan')}</h1>
          <div class="small dim">Founding fan of ${esc(a?.name || 'Angela Ruggiero')}${since ? ` · since ${esc(since)}` : ''}</div></div></header>
        ${identitiesCard('fan')}
        <form class="card stack gap10" data-form="saveName" novalidate>
          <label class="label" for="you-name">What ${esc(firstName())} calls you</label>
          <div class="row"><input id="you-name" name="name" class="field" value="${esc(u.name || '')}" placeholder="Your first name" maxlength="40" autocomplete="given-name" data-keep="you-name">
          <button class="btn sm" type="submit">Save</button></div>
        </form>
        <section class="card stack gap10"><span class="label">Your interests</span>
          <div class="chips">${INTERESTS.map((t) => `<button class="chip ${picked.includes(t) ? 'on' : ''}" data-act="toggleInterest" data-arg="${attr(t)}" aria-pressed="${picked.includes(t)}">${esc(t)}</button>`).join('')}</div>
          <p class="tiny dim" style="margin:0">Suggestions and drops tune to these.</p></section>
        ${installCard()}
        <section class="card stack gap10"><span class="label">How Strive works</span>
          <p class="small muted" style="margin:0">Every ${state.config.autopilot ? 'drop and every reply not marked “AI Coach”' : 'reply and drop'} is written or approved by ${esc(firstName())} before anyone hears it, and you hear it in her voice — an AI voice model made with her permission, labelled wherever it plays.${state.config.autopilot ? ' When her AI Coach answers on its own, it’s marked “AI Coach”, sticks to her public record, and shows where the answer comes from.' : ''}</p>
          <p class="small muted" style="margin:0">Your questions are only seen by ${esc(firstName())} and the Strive team. Medical, betting and legal questions get a polite pass.</p></section>
        <section class="card" style="padding:4px 14px">
          <a class="list-row" href="privacy.html">Privacy Policy <span style="width:16px;height:16px;color:var(--dim);display:inline-flex">${icon.chev}</span></a>
          <a class="list-row" href="terms.html">Terms of Use <span style="width:16px;height:16px;color:var(--dim);display:inline-flex">${icon.chev}</span></a>
          <a class="list-row" href="support.html">Help &amp; support <span style="width:16px;height:16px;color:var(--dim);display:inline-flex">${icon.chev}</span></a></section>
        ${state.identities.length ? `<button class="btn line plain block" data-act="fanSignOut">Sign out</button>` : ''}
        <p class="tiny dim center" style="margin:0">${state.identities.length
          ? 'Deleting your account removes your profile, questions, saved replies and sign-in details for good.'
          : 'Your account lives in this browser. Deleting it removes your profile, questions and saved replies for good.'}</p>
        <button class="btn danger block" data-act="deleteAccount">Delete my account</button>
      </div>`;
    },
  },

  notifications: {
    tab: 'home',
    enter: () => loadNotifications().then(() => setTimeout(() => {
      if (state.unread > 0 || state.notifications.some((n) => !n.read)) {
        api.post('notifications/read').then(() => { state.notifications.forEach((n) => { n.read = true; }); set({ unread: 0 }); }).catch(() => {});
      }
    }, 1200)),
    render() {
      const list = state.notifications;
      return `<div class="wrap stack gap14"><a class="link dim" href="#/home">← Home</a><h1>Notifications</h1>
        ${list.length ? list.map((n) => `<a class="card row" href="${n.link === 'ask' ? '#/ask' : '#/home'}" style="text-decoration:none;color:var(--txt);${n.read ? '' : 'border-color:var(--chip-line);background:var(--chip-bg)'}">
            ${n.read ? '' : '<span class="dot"></span>'}<div class="grow"><b>${esc(n.text)}</b>${n.sub ? `<div class="small muted ellipsis">${esc(n.sub)}</div>` : ''}<div class="tiny dim">${esc(rel(n.createdAt))}</div></div></a>`).join('')
          : emptyState(icon.bell, "You're all caught up", `When ${firstName()} answers you or ships a new drop, it shows up here.`)}
      </div>`;
    },
  },
};

// ---------- actions ----------
export const acts = {
  fanSignOut() {
    const how = state.identities.map((i) => (i.provider === 'google' ? 'Google' : i.email)).join(' or ');
    const s = sheet(`<div class="stack gap14"><h2 style="margin:0;color:var(--txt);font-size:20px">Sign out?</h2>
      <p class="small muted" style="margin:0">Sign back in anytime with ${esc(how)}.</p>
      <button class="btn block" id="confirm-signout">Sign out</button><button class="btn quiet" data-close>Stay signed in</button></div>`);
    s.el.querySelector('#confirm-signout').addEventListener('click', async (e) => { await busy(e.currentTarget, signOut); s.close(); });
  },
  reloadHome: () => loadHome(),
  libraryTab(el) { ui.libraryTab = JSON.parse(el.dataset.arg); render(); },
  askSuggestion(el) { send(JSON.parse(el.dataset.arg)); },
  async save(el) {
    const id = JSON.parse(el.dataset.arg);
    const q = state.questions.find((x) => x.id === id);
    if (!q) return;
    const next = !q.saved;
    q.saved = next;
    render();
    try {
      const r = await api.post(`questions/${id}/save`, { saved: next });
      Object.assign(q, r.question);
      toast(next ? 'Saved to your Library' : 'Removed from your Library');
    } catch (e) {
      q.saved = !next;
      toast(message(e), 'error');
    }
    render();
  },
  async toggleInterest(el) {
    const tag = JSON.parse(el.dataset.arg);
    const list = [...(state.user?.interests || [])];
    const i = list.indexOf(tag);
    i >= 0 ? list.splice(i, 1) : list.push(tag);
    try { await updateProfile({ interests: list }); } catch (e) { toast(message(e), 'error'); }
  },
  install() {
    const p = window.__installPrompt;
    if (!p) return;
    p.prompt();
    p.userChoice.finally(() => { window.__installPrompt = null; render(); });
  },
  hideInstall() { cache('installHidden', true); render(); },
  deleteAccount() {
    const s = sheet(`<div class="stack gap14"><h1 style="font-size:22px">Delete your Strive account?</h1>
      <p class="muted" style="margin:0">This permanently deletes your profile, your questions and saved replies. It can't be undone.</p>
      <button class="btn danger block" data-act="confirmDelete">Delete account</button>
      <button class="btn line plain block" data-close>Keep my account</button></div>`);
    ui.closeSheet = s.close;
  },
  async confirmDelete(el) {
    await busy(el, async () => {
      try { await deleteAccount(); ui.closeSheet && ui.closeSheet(); toast('Your account was deleted.'); }
      catch (e) { toast(message(e), 'error'); }
    });
  },
};

export const inputs = {
  askTyping(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  },
};

export const keys = {
  // Enter sends; Shift+Enter makes a new line.
  'ask-text'(e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(e.target.value); } },
};

export const forms = {
  ask(form) { send(form.text.value); },
  async saveName(form) {
    const name = form.name.value.trim().slice(0, 40);
    try { await updateProfile({ name }); toast(name ? `Saved — ${firstName()} will call you ${name}` : 'Saved'); }
    catch (e) { toast(message(e), 'error'); }
  },
};

async function send(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text || ui.sending || state.paused) return;
  if (text.length > 300) return toast('Keep questions under 300 characters.', 'error');
  ui.sending = true;
  const field = document.getElementById('ask-text');
  if (field) { field.value = ''; field.style.height = ''; }
  render();
  try {
    const r = await api.post('questions', { text });
    state.questions.push(r.question);
    cache('questions', { questions: state.questions, paused: state.paused });
    if (r.question.status === 'pending' && !ui.askedOnce) { ui.askedOnce = true; toast(state.config.autopilot ? `Sent — ${firstName()}'s answer will show up here.` : `Sent — ${firstName()} reviews every answer. We'll show it here.`); }
  } catch (e) {
    if (field) field.value = text;
    toast(message(e), 'error');
  }
  ui.sending = false;
  render();
  requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
}

/** Called on a timer by the shell: keep the thread fresh while something waits on the athlete. */
export function poll(route) {
  if (route === 'ask' && state.questions.some((q) => q.status === 'pending')) loadQuestions();
  loadNotificationsQuiet();
}
async function loadNotificationsQuiet() {
  try { const r = await api.get('notifications'); if (r.unread !== state.unread) set({ unread: r.unread, notifications: r.notifications }); } catch {}
}

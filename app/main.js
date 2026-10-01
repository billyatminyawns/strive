// Strive web app shell: routing, layout (tabs on phones, sidebar on desktop), event delegation, polling.
import { esc, icon, ava, playBtn, sheet, clock, disclose } from './ui.js';
import { state, onRender, boot, firstName } from './state.js';
import { player, sync } from './player.js';
import * as onboard from './onboard.js';
import * as fan from './fan.js';
import * as studio from './studio.js';

const root = document.getElementById('app');
const acts = { ...onboard.acts, ...fan.acts, ...studio.acts };
const forms = { ...onboard.forms, ...fan.forms, ...studio.forms };
const inputs = { ...onboard.inputs, ...fan.inputs };
const keys = { ...fan.keys };

// ---------- routing ----------
const FAN = { home: fan.screens.home, ask: fan.screens.ask, library: fan.screens.library, you: fan.screens.you, notifications: fan.screens.notifications };
const STUDIO = { '': studio.screens.studio, approve: studio.screens.approve, reply: studio.screens.reply, capture: studio.screens.capture,
  coach: studio.screens.coach, settings: studio.screens.settings };
const splash = { bare: true, render: () => `<div class="center stack gap14" style="align-items:center;padding-top:30vh"><span class="brand big">STRIVE<i></i></span><span class="spin" style="color:var(--mint)"></span></div>` };

function resolve() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/');
  const phase = state.phase;
  if (phase === 'loading') return { name: 'loading', screen: splash };
  if (phase === 'signedOut') {
    if (parts[0] === 'studio-sign-in') return { name: 'studioSignIn', screen: onboard.screens.studioSignIn };
    return redirect('', { name: 'welcome', screen: onboard.screens.welcome });
  }
  if (phase === 'interests') return { name: 'interests', screen: onboard.screens.interests };
  if (phase === 'athlete') {
    if (parts[0] !== 'studio') return redirect('studio', { name: 'studio', screen: STUDIO[''] });
    const sub = parts[1] || '';
    return { name: sub || 'studio', screen: STUDIO[sub] || STUDIO[''], arg: parts[2] };
  }
  const name = FAN[parts[0]] ? parts[0] : 'home';
  if (!FAN[parts[0]]) return redirect('home', { name, screen: FAN.home });
  return { name, screen: FAN[name] };
}
function redirect(path, r) {
  const want = '#/' + path;
  if (location.hash !== want && !(path === '' && (location.hash === '' || location.hash === '#/'))) history.replaceState(null, '', want);
  return r;
}

// ---------- layout ----------
const NAV = {
  fan: [['#/home', 'Home', icon.home, 'home'], ['#/ask', 'Ask', icon.ask, 'ask'], ['#/library', 'Library', icon.library, 'library'], ['#/you', 'You', icon.you, 'you']],
  athlete: [['#/studio', 'Today', icon.sun, 'studio'], ['#/studio/approve', 'Approve', icon.approve, 'approve'], ['#/studio/capture', 'Capture', icon.mic, 'capture'], ['#/studio/settings', 'Studio', icon.sliders, 'settings']],
};

function navItems(role, active) {
  return NAV[role].map(([href, label, ico, tab]) => {
    const badge = tab === 'approve' && studio.queueCount() ? `<span class="badge">${studio.queueCount()}</span>`
      : tab === 'home' && role === 'fan' && state.unread ? `<span class="badge">${state.unread}</span>` : '';
    return `<a href="${href}" class="${active === tab ? 'on' : ''}" ${active === tab ? 'aria-current="page"' : ''}>${ico}<span>${label}</span>${badge}</a>`;
  }).join('');
}

function shell(r) {
  const role = state.phase === 'athlete' ? 'athlete' : state.phase === 'fan' ? 'fan' : null;
  const bare = !role || r.screen.bare;
  const active = r.screen.tab;
  const content = r.screen.render(r.arg);
  const hasPlayer = !!player.current && !bare;
  return `
    ${bare ? '' : `<aside class="side" aria-label="Navigation"><a class="brand" href="#/">STRIVE<i></i></a><nav>${navItems(role, active)}</nav>
      <div class="who">${ava(state.athlete, 34)}<div class="grow"><b class="ellipsis" style="display:block;font-size:13px">${esc(role === 'athlete' ? state.athlete?.name || '' : state.user?.name || 'Founding fan')}</b>
      <span class="tiny dim">${role === 'athlete' ? 'Athlete studio' : `Fan of ${esc(firstName())}`}</span></div></div></aside>`}
    <main id="main" class="main ${bare ? 'bare' : ''} ${hasPlayer ? 'with-player' : ''}">${content}</main>
    <div id="mini">${bare ? '' : miniPlayer()}</div>
    ${bare ? '' : `<nav class="tabs" aria-label="Tabs">${navItems(role, active)}</nav>`}`;
}

function miniPlayer() {
  const c = player.current;
  if (!c) return '';
  return `<div class="player" data-act="openPlayer" role="region" aria-label="Now playing"><span class="bar"></span>
    ${ava(state.athlete, 34)}<div class="grow"><div class="ellipsis" style="font-weight:800;font-size:13.5px">${esc(c.title)}</div>
    <div class="tiny dim ellipsis"><span data-mini-time>${clock(player.time)} / ${clock(player.duration)}</span> · ${esc(c.subtitle || '')}</div></div>
    ${playBtn(c, 'sm')}<button class="x" data-act="closePlayer" aria-label="Close player">${icon.x}</button></div>`;
}

let lastRoute = null;
let lastTabs = '';
function renderApp() {
  const r = resolve();
  const key = r.name + ':' + (r.arg || '');
  const changed = key !== lastRoute;
  const keep = captureFields();
  root.innerHTML = shell(r);
  restoreFields(keep, !changed);
  document.title = state.unread && state.phase === 'fan' ? `(${state.unread}) Strive` : 'Strive';
  if (changed) {
    lastRoute = key;
    window.scrollTo(0, r.name === 'ask' ? document.body.scrollHeight : 0);
    r.screen.enter && r.screen.enter(r.arg);
  }
  r.screen.mount && r.screen.mount(r.arg);
  sync();
}
onRender(renderApp);

/** Mini player updates without re-rendering the page. */
player.onChange(() => {
  const host = document.getElementById('mini');
  const main = document.getElementById('main');
  if (!host || !main || main.classList.contains('bare')) return;
  const has = !!player.current;
  const want = has ? miniPlayer() : '';
  if (has !== !!host.firstElementChild || (has && host.querySelector('.ellipsis')?.textContent !== player.current.title)) host.innerHTML = want;
  else if (has) {
    const b = host.querySelector('[data-play]');
    if (b) b.innerHTML = player.loading ? '<span class="spin"></span>' : player.playing ? icon.pause : icon.play;
  }
  main.classList.toggle('with-player', has);
});

/** Inputs are uncontrolled, so a re-render must carry over what people typed (on the same screen). */
function captureFields() {
  const fields = {};
  root.querySelectorAll('[data-keep]').forEach((el) => { fields[el.dataset.keep] = el.value; });
  const a = document.activeElement;
  const focus = a && a.dataset && a.dataset.keep ? { key: a.dataset.keep, start: a.selectionStart, end: a.selectionEnd } : null;
  return { fields, focus };
}
function restoreFields(k, sameScreen) {
  if (sameScreen) {
    for (const [key, value] of Object.entries(k.fields)) {
      const el = root.querySelector(`[data-keep="${CSS.escape(key)}"]`);
      if (el && el.value !== value) el.value = value;
    }
  }
  if (!k.focus) return;
  const el = root.querySelector(`[data-keep="${CSS.escape(k.focus.key)}"]`);
  if (!el) return;
  el.focus({ preventScroll: true });
  try { el.setSelectionRange(k.focus.start, k.focus.end); } catch {}
}

// ---------- events ----------
const shellActs = {
  play(el) { player.toggle(JSON.parse(el.dataset.arg)); },
  closePlayer(el, e) { e.stopPropagation(); player.stop(); },
  openPlayer(el, e) {
    if (e.target.closest('button')) return;
    const c = player.current;
    if (!c) return;
    const s = sheet(`<div class="stack gap14 center" style="align-items:center">
      <img class="ava" src="${esc(document.querySelector('.player img')?.getAttribute('src') || '')}" alt="" style="width:120px;height:120px;border-radius:24px">
      <div><h1 style="font-size:21px">${esc(c.title)}</h1><div class="small dim">${esc(c.subtitle || '')}</div></div>
      ${disclose(firstName())}
      <input type="range" min="0" max="1000" value="0" data-scrub aria-label="Seek" style="width:100%;accent-color:var(--mint)">
      <div class="row" style="justify-content:center;gap:34px">
        <button class="play subtle" data-act="skipBack" aria-label="Back 15 seconds" style="box-shadow:none">-15</button>
        ${playBtn(c, 'lg')}
        <button class="play subtle" data-act="skipFwd" aria-label="Forward 15 seconds" style="box-shadow:none">+15</button></div>
      <span class="time" data-time="${esc(c.id)}">${clock(player.time)} / ${clock(player.duration)}</span>
      ${c.transcript ? `<div class="card alt" style="text-align:left;width:100%"><span class="kicker dim">Read along</span><p class="muted" style="margin:8px 0 0;line-height:1.65;white-space:pre-wrap">${esc(c.transcript)}</p></div>` : ''}
    </div>`);
    const scrub = s.el.querySelector('[data-scrub]');
    const upd = () => { if (!scrub.matches(':active') && player.duration) scrub.value = String(Math.round((player.time / player.duration) * 1000)); };
    const t = setInterval(() => { if (!s.el.isConnected) return clearInterval(t); upd(); }, 250);
    scrub.addEventListener('input', () => player.seek((Number(scrub.value) / 1000) * player.duration));
    sync();
  },
  skipBack() { player.skip(-15); },
  skipFwd() { player.skip(15); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = shellActs[el.dataset.act] || acts[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  fn(el, e);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const fn = forms[form.dataset.form];
  fn && fn(form, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && inputs[el.dataset.input]) inputs[el.dataset.input](el, e);
});
document.addEventListener('keydown', (e) => {
  const fn = e.target && e.target.id && keys[e.target.id];
  if (fn) fn(e);
});
window.addEventListener('hashchange', renderApp);

// Hide the tab bar while the on-screen keyboard is up (phones).
if (window.visualViewport) {
  const kb = () => document.body.classList.toggle('kb-open', window.innerHeight - window.visualViewport.height > 150);
  window.visualViewport.addEventListener('resize', kb);
}

// Keep things fresh: thread while something is pending, queue for the athlete, unread for fans.
setInterval(() => {
  if (document.hidden) return;
  const r = resolve();
  if (state.phase === 'fan') fan.poll(r.name);
  if (state.phase === 'athlete') studio.poll(r.name);
}, 15000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const r = resolve();
  r.screen.enter && r.screen.enter(r.arg);
});

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; renderApp(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

fan.hydrate();
renderApp();
boot();

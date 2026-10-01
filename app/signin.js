// Sign-in that follows the account to any device: 6-digit email codes everywhere, Google where its
// window can open. Used by the sign-in screen (signed out), "Save your seat" (right after joining),
// You (fans) and Studio settings (athletes). Signed out = sign in; signed in = link to this account.
import { esc, attr, icon, toast, sheet, busy } from './ui.js';
import { state, set, adoptSession, setIdentities } from './state.js';
import { api, auth, message } from './api.js';

const UA = navigator.userAgent;
// iPadOS Safari says "Macintosh"; a touch screen gives it away (Android UAs never say Macintosh)
export const isIOS = /iphone|ipad|ipod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
// Instagram, Facebook, LinkedIn, TikTok… in-app browsers: Google refuses sign-in there, and their storage is short-lived.
export const inAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|musical_ly|BytedanceWebview|Snapchat|Twitter|Pinterest/i.test(UA);
export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// The iPhone Home Screen app opens Google's window outside itself, so the credential never comes back.
const googleWorksHere = () => !inAppBrowser && !(isIOS && standalone());

export function methods() {
  const s = state.config.signIn || {};
  return { email: !!s.email, google: s.google && googleWorksHere() ? s.google : null, googleOff: !!s.google && !googleWorksHere() };
}
export const available = () => { const m = methods(); return m.email || !!m.google; };

const ui = { mode: 'signin', step: 'email', email: '', error: '', sentAt: 0, verifying: false, onLinked: null };
let open = null; // the sign-in sheet, when one is up

// ---------- markup ----------
export function block(mode, { onLinked } = {}) {
  if (ui.mode !== mode) Object.assign(ui, { mode, step: 'email', error: '' });
  ui.onLinked = onLinked || null;
  const m = methods();
  if (!m.email && !m.google) {
    return `<p class="small muted" style="margin:0">${m.googleOff ? 'Google sign-in doesn’t work in this browser — open Strive in Safari or Chrome.' : 'Sign-in isn’t switched on yet.'}</p>`;
  }
  return `<div class="signin stack gap12">
    ${m.google ? `<div class="gbtn" data-gbtn></div>` : ''}
    ${m.google && m.email ? '<div class="or"><span>or</span></div>' : ''}
    ${m.email ? `<div data-signin-email>${emailPart()}</div>` : ''}
    ${m.googleOff && m.email ? `<p class="tiny dim" style="margin:0">${inAppBrowser ? 'Google sign-in needs Safari or Chrome — an email code works right here.' : 'Google sign-in doesn’t open inside the Home Screen app — use an email code (your Google address works).'}</p>` : ''}
  </div>`;
}

function emailPart() {
  const err = ui.error ? `<p class="err-text" role="alert" style="margin:0">${esc(ui.error)}</p>` : '';
  if (ui.step === 'code') {
    return `<form data-form="signinVerify" class="stack gap10" novalidate>
      <p class="small muted" style="margin:0">We sent a 6-digit code to <b style="color:var(--txt2)">${esc(ui.email)}</b>.
        <button type="button" class="link" data-act="signinChange">Change</button></p>
      <label class="sr" for="signin-code">6-digit code</label>
      <input id="signin-code" name="code" class="field code-input" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*"
        maxlength="6" placeholder="······" data-input="signinCode" data-keep="signin-code">
      ${err}
      <button class="btn block" type="submit">${ui.mode === 'link' ? 'Save' : 'Sign in'}</button>
      <button class="btn quiet" type="button" data-act="signinResend">Send a new code</button>
    </form>`;
  }
  return `<form data-form="signinStart" class="stack gap10" novalidate>
    <label class="sr" for="signin-email">Email</label>
    <input id="signin-email" name="email" type="email" class="field" placeholder="you@email.com" value="${esc(ui.email)}"
      autocomplete="email" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="254" data-keep="signin-email">
    ${err}
    <button class="btn ${ui.mode === 'link' && methods().google ? 'line' : ''} block" type="submit">Email me a code</button>
  </form>`;
}

// Only the email step re-renders (not the whole page), so Google's button iframe isn't rebuilt.
function refresh(focus = true) {
  document.querySelectorAll('[data-signin-email]').forEach((el) => { el.innerHTML = emailPart(); });
  if (!focus) return;
  const f = document.getElementById(ui.step === 'code' ? 'signin-code' : 'signin-email');
  if (f) f.focus({ preventScroll: true });
}

/** Ways to sign in for this account — You (fans) and Studio settings (athletes). */
export function identitiesCard(role) {
  const list = state.identities || [];
  if (!list.length && !available()) return '';
  const rows = list.map((i) => `<div class="setting">
      <span class="ico-pill">${i.provider === 'google' ? '<b>G</b>' : icon.mail}</span>
      <div class="grow" style="min-width:0"><b>${i.provider === 'google' ? 'Google' : 'Email code'}</b><div class="small dim ellipsis">${esc(i.email || '')}</div></div>
      <button class="btn quiet sm" data-act="removeIdentity" data-arg="${attr(i.id)}">Remove</button></div>`).join('');
  const lead = role === 'athlete'
    ? 'Sign in on any device with Google or an email code — no studio key to paste.'
    : 'Right now your account lives only in this browser. Save it so you can sign in on any phone — or after adding Strive to your Home Screen.';
  return `<section class="card stack gap10" style="${list.length ? 'padding-bottom:10px' : ''}">
    <span class="label">${role === 'athlete' ? 'Sign-in' : 'Your account'}</span>
    ${list.length ? `<div>${rows}</div>` : `<p class="small muted" style="margin:0">${lead}</p>`}
    ${available() && list.length < 5 ? `<button class="btn ${list.length ? 'line sm' : 'block'}" data-act="openSignin">${list.length ? 'Add another way to sign in' : role === 'athlete' ? 'Set up Google or email sign-in' : 'Save my account'}</button>` : ''}
  </section>`;
}

/** Bottom sheet with the sign-in block — links when signed in, signs in when not. */
export function openSignin({ title, sub, onLinked } = {}) {
  if (open) return;
  const linking = !!auth.token;
  Object.assign(ui, { step: 'email', error: '' });
  const role = state.user?.role;
  const t = title || (linking ? (state.identities.length ? 'Add a way to sign in' : role === 'athlete' ? 'Sign in without your key' : 'Save your seat') : 'Welcome back');
  const s = sub || (linking
    ? (role === 'athlete' ? 'Next time, sign in with Google or an email code on any device.' : 'Sign in with this on any phone — your questions and saved replies come with you.')
    : 'Sign in with the email or Google account you saved your seat with.');
  open = sheet(`<div class="stack gap14"><div><h2 style="margin:0 0 4px;color:var(--txt);font-size:20px">${esc(t)}</h2>
    <p class="small muted" style="margin:0">${esc(s)}</p></div>${block(linking ? 'link' : 'signin', { onLinked })}
    <button class="btn quiet" data-close>Not now</button></div>`, { onClose: () => { open = null; } });
  mountGoogle(open.el);
}
const closeSheet = () => { if (open) { const o = open; open = null; o.close(); } };

// ---------- Google ----------
let gis = null;        // script load promise
let gisClient = null;  // client id GIS was initialised with
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gis) {
    gis = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { gis = null; reject(new Error('Google sign-in could not load.')); };
      document.head.appendChild(s);
    });
  }
  return gis;
}

/** Fills every empty Google button slot under `root` (after renders, and when a sheet opens). */
export function mountGoogle(root = document) {
  const id = methods().google;
  const slots = [...root.querySelectorAll('[data-gbtn]')].filter((el) => !el.childElementCount);
  if (!id || !slots.length) return;
  loadGis().then(() => {
    if (gisClient !== id) {
      window.google.accounts.id.initialize({ client_id: id, callback: (r) => onCredential(r.credential), ux_mode: 'popup',
        auto_select: false, itp_support: true, use_fedcm_for_button: true, context: 'signin' });
      gisClient = id;
    }
    for (const el of slots) {
      if (!el.isConnected || el.childElementCount) continue;
      window.google.accounts.id.renderButton(el, { type: 'standard', theme: 'filled_black', size: 'large', shape: 'pill',
        text: 'continue_with', logo_alignment: 'left', width: Math.max(220, Math.min(380, el.clientWidth || 320)) });
    }
  }).catch(() => {
    for (const el of slots) if (el.isConnected) el.innerHTML = '<p class="tiny dim" style="margin:0">Google sign-in couldn’t load — use an email code.</p>';
  });
}

async function onCredential(credential) {
  if (!credential) return;
  try { finish(await api.post('auth/google', { credential }), 'google'); }
  catch (e) { toast(message(e), 'error'); }
}
// Local testing only: drive the Google path with a minted test token (the real button needs Google).
if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) window.__striveGoogle = onCredential;

// ---------- results ----------
function finish(r, provider) {
  const done = ui.onLinked;
  Object.assign(ui, { step: 'email', error: '', email: provider === 'email' ? ui.email : '' });
  closeSheet();
  if (r.token) { // signed in — or switched to the account this identity already saved
    adoptSession(r);
    toast(r.switched ? 'Welcome back — you’re in your saved account.' : `Welcome back${r.user?.name ? `, ${r.user.name}` : ''}.`);
    location.hash = r.user.role === 'athlete' ? '#/studio' : '#/home';
    return;
  }
  setIdentities(r.identities || []);
  if (r.user) set({ user: r.user });
  const last = (r.identities || []).find((i) => i.provider === provider);
  toast(provider === 'google' ? 'Saved — sign in with Google on any device.' : `Saved — sign in with ${last?.email || 'your email'} on any device.`);
  done && done();
}

// ---------- events ----------
export const forms = {
  async signinStart(form) {
    const email = form.email.value.trim();
    ui.email = email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) { ui.error = 'Enter a valid email address.'; return refresh(); }
    ui.error = '';
    await busy(form.querySelector('button[type=submit]'), async () => {
      try { await api.post('auth/email/start', { email }); Object.assign(ui, { step: 'code', sentAt: Date.now() }); }
      catch (e) { ui.error = message(e); }
    });
    refresh();
  },
  async signinVerify(form) {
    const code = form.code.value.replace(/\D/g, '');
    if (code.length !== 6) { ui.error = 'Enter the 6-digit code from the email.'; return refresh(); }
    if (ui.verifying) return; // auto-submit at 6 digits + Enter would otherwise spend the code twice
    ui.verifying = true;
    await busy(form.querySelector('button[type=submit]'), async () => {
      try { finish(await api.post('auth/email/verify', { email: ui.email, code }), 'email'); }
      catch (e) { ui.error = message(e); refresh(); }
    });
    ui.verifying = false;
  },
};

export const inputs = {
  signinCode(el) {
    const digits = el.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== el.value) el.value = digits;
    if (digits.length === 6) el.form?.requestSubmit();
  },
};

export const acts = {
  signinChange() { Object.assign(ui, { step: 'email', error: '' }); refresh(); },
  async signinResend(el) {
    const wait = Math.ceil((ui.sentAt + 30e3 - Date.now()) / 1000);
    if (wait > 0) return toast(`Give it a moment — you can ask again in ${wait}s.`);
    await busy(el, async () => {
      try { await api.post('auth/email/start', { email: ui.email }); ui.sentAt = Date.now(); ui.error = ''; toast('New code sent — only the newest one works.'); }
      catch (e) { ui.error = message(e); }
    });
    refresh(false);
  },
  openSignin() { openSignin(); },
  removeIdentity(el) {
    const id = JSON.parse(el.dataset.arg);
    const list = state.identities || [];
    const remove = async () => {
      try { setIdentities((await api.del(`me/identities/${encodeURIComponent(id)}`)).identities || []); toast('Removed.'); }
      catch (e) { toast(message(e), 'error'); }
    };
    if (list.length > 1) return busy(el, remove);
    const s = sheet(`<div class="stack gap14"><h2 style="margin:0;color:var(--txt);font-size:20px">Remove your only sign-in?</h2>
      <p class="small muted" style="margin:0">You’ll stay signed in here, but you won’t be able to get back into this account on another device${state.user?.role === 'athlete' ? ' without your studio key' : ''}.</p>
      <button class="btn danger block" id="confirm-remove">Remove</button><button class="btn quiet" data-close>Keep it</button></div>`);
    s.el.querySelector('#confirm-remove').addEventListener('click', async (e) => { await busy(e.currentTarget, remove); s.close(); });
  },
};

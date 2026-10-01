// Onboarding: invite code → interests → save your seat (fans), studio key (athletes), and sign-in
// for anyone coming back on another device.
import { esc, attr, icon, ava, toast, busy } from './ui.js';
import { state, set, render, firstName, signInFan, signInAthlete, completeOnboarding } from './state.js';
import { message } from './api.js';
import { block, available, isIOS, inAppBrowser, standalone } from './signin.js';

export const INTERESTS = ['Mindset', 'Nutrition', 'Recovery', 'Training', 'Stories', 'Leadership', 'Culture', 'Hockey IQ'];
const ui = { codeError: '', keyError: '', picked: ['Mindset', 'Stories'] };

// Invite links: …/strive/?invite=ANGELA prefills the code.
const invited = (() => {
  try {
    const q = new URLSearchParams(location.search).get('invite');
    if (q) sessionStorage.setItem('strive.invite', q.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16));
    return sessionStorage.getItem('strive.invite') || '';
  } catch { return ''; }
})();

const legal = `<div class="legal"><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="support.html">Support</a></div>`;
const welcomeToast = () => toast(`Welcome — ${firstName()} is glad you're here.`);

// In-app browsers forget you; on iPhone the Home Screen app keeps its own sign-in, so join from there.
function hint() {
  if (inAppBrowser) {
    return `<div class="hint">${icon.info}<span>For the best experience, open Strive in ${isIOS ? 'Safari' : 'Chrome'} — tap <b>⋯</b>, then <b>Open in browser</b>.</span></div>`;
  }
  if (isIOS && !standalone()) {
    return `<div class="hint">${icon.share}<span><b>On iPhone?</b> Add Strive to your Home Screen first — tap Share, then “Add to Home Screen” — and join from there.</span></div>`;
  }
  return '';
}

function saveDone() { set({ phase: 'fan' }); location.hash = '#/home'; }

export const screens = {
  welcome: {
    bare: true,
    render: () => `
      <div class="welcome stack gap20">
        <div class="hero-img photo">
          <img src="assets/angela2.webp" alt="Angela Ruggiero on the ice">
          <div class="over"><span class="brand big">STRIVE<i></i></span></div>
        </div>
        <div class="stack gap14 center" style="padding:0 4px">
          <div class="kicker">VIP access · founding fan</div>
          <h1>Angela saved you a seat</h1>
          <p class="muted" style="margin:0">Train with Olympic champion Angela Ruggiero — voice drops, and your questions answered back in her voice. Invite-only while the first athletes build their rooms.</p>
          <form data-form="joinCode" class="stack gap10" novalidate>
            <label class="sr" for="invite-code">Invite code</label>
            <input id="invite-code" name="code" class="field code-input ${ui.codeError ? 'err' : ''}" placeholder="INVITE CODE"
              autocapitalize="characters" autocorrect="off" autocomplete="off" spellcheck="false" maxlength="16"
              data-keep="invite-code" data-input="codeTyping" value="${esc(invited)}">
            ${ui.codeError ? `<p class="err-text" role="alert" style="margin:0">${esc(ui.codeError)}</p>` : ''}
            <button class="btn block" type="submit">Unlock</button>
          </form>
          ${available() ? (standalone()
            ? `<a class="btn line block" href="#/sign-in">I already joined — sign in</a>`
            : `<a class="link" href="#/sign-in" style="padding:2px 0">Already joined? Sign in</a>`) : ''}
          ${hint()}
          <p class="tiny dim" style="margin:0">${state.config.autopilot ? 'Replies are written or approved by Angela — or clearly marked AI Coach — and spoken in her AI voice.' : 'Every reply is written or approved by Angela, then spoken in her AI voice.'}</p>
          <a class="link" href="#/studio-sign-in" style="color:var(--lav);padding:6px 0">I'm an athlete — sign in to my studio</a>
          ${legal}
        </div>
      </div>`,
  },

  interests: {
    bare: true,
    render: () => `
      <div class="wrap stack gap20" style="max-width:520px;padding-top:28px">
        <div class="center stack gap10" style="align-items:center">
          ${ava(state.athlete, 84)}
          <h1>You're in.</h1>
          <p class="muted" style="margin:0">${esc(firstName())} personally invited her first fans. Tell her a little about you.</p>
        </div>
        <form data-form="finishJoin" class="stack gap20" novalidate>
          <div class="stack gap6">
            <label class="label" for="join-name">What should ${esc(firstName())} call you?</label>
            <input id="join-name" name="name" class="field" placeholder="Your first name" autocomplete="given-name" maxlength="40" data-keep="join-name">
          </div>
          <div class="stack gap10">
            <span class="label">What do you want from her?</span>
            <div class="chips">${INTERESTS.map((t) => `<button type="button" class="chip ${ui.picked.includes(t) ? 'on' : ''}" data-act="pickInterest" data-arg="${attr(t)}" aria-pressed="${ui.picked.includes(t)}">${esc(t)}</button>`).join('')}</div>
            <p class="tiny dim" style="margin:0">General first, sport-deep when you want it — you don't need to know what gap control is to belong here.</p>
          </div>
          <button class="btn block" type="submit">${ui.picked.length ? `Enter Strive · ${ui.picked.length} picked` : 'Enter Strive'}</button>
          <button class="btn quiet" type="button" data-act="skipJoin">Skip for now</button>
        </form>
      </div>`,
  },

  signIn: {
    bare: true,
    render: () => `
      <div class="wrap stack gap20" style="max-width:460px;padding-top:28px">
        <a class="link dim" href="#/">← Back</a>
        <div class="stack gap10">
          <h1>Welcome back</h1>
          <p class="muted" style="margin:0">Sign in with the email or Google account you saved your seat with — your questions and saved replies come with you.</p>
        </div>
        ${block('signin')}
        <p class="small dim" style="margin:0">New here? <a class="link" href="#/">Use your invite code</a>. Athlete? Use your
          <a class="link" href="#/studio-sign-in" style="color:var(--lav)">studio key</a> once, then add Google or email in Studio settings.</p>
        ${legal}
      </div>`,
  },

  saveSeat: {
    bare: true,
    render: () => `
      <div class="wrap stack gap20" style="max-width:460px;padding-top:28px">
        <div class="center stack gap10" style="align-items:center">
          ${ava(state.athlete, 84)}
          <h1>Save your seat</h1>
          <p class="muted" style="margin:0">So you can get back in on any phone${isIOS && !standalone() ? ' — including the Home Screen app, which signs in separately on iPhone' : ''}. Your questions and saved replies come with you.</p>
        </div>
        ${block('link', { onLinked: saveDone })}
        <button class="btn quiet" data-act="skipSave">Not now</button>
        <p class="tiny dim center" style="margin:0">We only use your email to sign you in — no newsletters.</p>
      </div>`,
  },

  studioSignIn: {
    bare: true,
    render: () => `
      <div class="wrap stack gap20" style="max-width:460px;padding-top:28px">
        <a class="link dim" href="#/">← Back</a>
        <div class="stack gap10">
          <div class="kicker lav">Athlete studio</div>
          <h1>Sign in to your studio</h1>
          <p class="muted" style="margin:0">Use the studio key from your Strive team. You approve everything before a single fan hears it.</p>
        </div>
        <form data-form="studioKey" class="stack gap10" novalidate>
          <label class="sr" for="studio-key">Studio key</label>
          <input id="studio-key" name="key" type="password" class="field ${ui.keyError ? 'err' : ''}" placeholder="Studio key"
            autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" data-keep="studio-key">
          ${ui.keyError ? `<p class="err-text" role="alert" style="margin:0">${esc(ui.keyError)}</p>` : ''}
          <button class="btn lav block" type="submit">Sign in</button>
        </form>
        ${available() ? `<div class="or"><span>or</span></div><a class="btn line block" href="#/sign-in">Sign in with Google or email</a>
          <p class="tiny dim" style="margin:0">Works once you've set it up in Studio settings.</p>` : ''}
        ${legal}
      </div>`,
  },
};

export const acts = {
  pickInterest(el) {
    const tag = JSON.parse(el.dataset.arg);
    const i = ui.picked.indexOf(tag);
    i >= 0 ? ui.picked.splice(i, 1) : ui.picked.push(tag);
    render();
  },
  async skipJoin(el) {
    await busy(el, () => completeOnboarding('', [], { save: available() }));
    if (state.phase === 'fan') welcomeToast();
    location.hash = '#/home';
  },
  skipSave() { saveDone(); welcomeToast(); },
};

export const inputs = {
  codeTyping(el) {
    const clean = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean !== el.value) el.value = clean;
    if (ui.codeError) { ui.codeError = ''; el.classList.remove('err'); el.parentElement.querySelector('.err-text')?.remove(); }
  },
};

export const forms = {
  async joinCode(form) {
    const code = form.code.value.trim();
    if (code.length < 3) { ui.codeError = 'Enter the invite code from your invite.'; return render(); }
    await busy(form.querySelector('button[type=submit]'), async () => {
      try {
        await signInFan(code);
        ui.codeError = '';
        try { sessionStorage.removeItem('strive.invite'); } catch {}
        location.hash = '#/join';
      } catch (e) {
        ui.codeError = e.status === 404 && /invite|code/i.test(e.message) ? "That code isn't active. Check your invite and try again."
          : e.status === 404 ? "Strive isn't reachable right now — try again in a few minutes." : message(e);
        render();
      }
    });
  },
  async finishJoin(form) {
    await busy(form.querySelector('button[type=submit]'), () => completeOnboarding(form.name.value, ui.picked.slice(), { save: available() }));
    if (state.phase === 'fan') welcomeToast();
    location.hash = '#/home';
  },
  async studioKey(form) {
    const key = form.key.value.trim();
    if (!key) return;
    await busy(form.querySelector('button[type=submit]'), async () => {
      try {
        await signInAthlete(key);
        ui.keyError = '';
        location.hash = '#/studio';
      } catch (e) {
        ui.keyError = e.status === 401 ? "That studio key didn't work." : message(e);
        render();
      }
    });
  },
};

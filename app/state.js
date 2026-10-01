// App state + session. Screens read `state`, call `set()` / `render()` after changes.
import { api, auth, ApiError } from './api.js';

export const state = {
  phase: 'loading', // loading | signedOut | interests | save | fan | athlete
  user: null,
  athlete: null,
  identities: [],   // ways this account can sign in on another device (email / Google)
  config: { drafting: false, voice: true, push: false, autopilot: false },
  // fan
  home: null, homeError: null, questions: [], threadLoaded: false, paused: false,
  drops: [], dropsLoaded: false, notifications: [], unread: 0,
  // studio
  today: null, todayError: null, queue: [], queueLoaded: false, sdrops: null, settings: null,
  prompts: [], coverage: [], stories: [], bio: null, coach: [], coachLoaded: false,
};

let renderFn = () => {};
let scheduled = false;
export const onRender = (fn) => { renderFn = fn; };
export function render() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; renderFn(); });
}
export function set(patch) { Object.assign(state, patch); render(); }

export const firstName = () => state.athlete?.firstName || 'Angela';

// ---------- tiny persistent cache (fast first paint, works offline) ----------
const CACHE = 'strive.cache.';
export function cache(name, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(CACHE + name) || 'null');
    localStorage.setItem(CACHE + name, JSON.stringify(value));
  } catch {}
  return value;
}
function clearCache() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(CACHE)).forEach((k) => localStorage.removeItem(k)); } catch {}
}

// ---------- session ----------
auth.onUnauthorized(() => endSession());

export async function boot() {
  api.get('config').then((config) => set({ config: { ...state.config, ...config } })).catch(() => {});
  if (!auth.token) return set({ phase: 'signedOut' });
  const me = cache('me');
  if (me) adopt(me.user, me.athlete, me.identities); // open instantly; refreshed below
  try {
    const fresh = await api.get('me');
    adopt(fresh.user, fresh.athlete, fresh.identities);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return endSession();
    if (!me) set({ phase: 'signedOut' });
  }
}

function adopt(user, athlete, identities = []) {
  cache('me', { user, athlete, identities });
  set({ user, athlete, identities, phase: user.role === 'athlete' ? 'athlete' : 'fan' });
}

/** A sign-in (email code / Google) handed back a session: same account, any device. */
export function adoptSession(r) {
  auth.set(r.token);
  ['home', 'questions', 'notifications'].forEach((k) => cache(k, null)); // another account may have used this browser
  set({ ...FRESH });
  adopt(r.user, r.athlete, r.identities || []);
}

export function setIdentities(identities) {
  cache('me', { user: state.user, athlete: state.athlete, identities });
  set({ identities });
}

export async function signInFan(code) {
  const r = await api.post('auth/fan', { code: code.trim().toUpperCase() });
  auth.set(r.token);
  cache('me', { user: r.user, athlete: r.athlete });
  set({ user: r.user, athlete: r.athlete, phase: 'interests' });
}

/** `save`: offer "Save your seat" next (sign-in is available and nothing is linked yet). */
export async function completeOnboarding(name, interests, { save = false } = {}) {
  const body = {};
  if (name && name.trim()) body.name = name.trim().slice(0, 40);
  if (interests.length) body.interests = interests;
  if (Object.keys(body).length) {
    try { await updateProfile(body); } catch {}
  }
  set({ phase: save && !state.identities.length ? 'save' : 'fan' });
}

export async function signInAthlete(key) {
  const r = await api.post('auth/athlete', { key: key.trim() });
  auth.set(r.token);
  adopt(r.user, r.athlete);
}

export async function updateProfile(changes) {
  const r = await api.patch('me', changes);
  cache('me', { user: r.user, athlete: state.athlete, identities: state.identities });
  set({ user: r.user });
}

export function updateAthlete(athlete) {
  if (!athlete) return;
  cache('me', { user: state.user, athlete, identities: state.identities });
  state.athlete = athlete;
}

export async function deleteAccount() {
  await api.del('me');
  endSession();
}

export async function signOut() {
  try { await api.post('auth/signout'); } catch {}
  endSession();
}

const FRESH = {
  home: null, homeError: null, questions: [], threadLoaded: false, paused: false, drops: [], dropsLoaded: false,
  notifications: [], unread: 0, today: null, todayError: null, queue: [], queueLoaded: false, sdrops: null,
  settings: null, prompts: [], coverage: [], stories: [], bio: null, coach: [], coachLoaded: false, identities: [],
};

export function endSession() {
  auth.set(null);
  clearCache();
  window.dispatchEvent(new Event('strive:signout'));
  set({ ...FRESH, user: null, athlete: null, phase: 'signedOut' });
  if (location.hash && location.hash !== '#/') location.hash = '#/';
}

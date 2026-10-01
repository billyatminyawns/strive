// App state + session. Screens read `state`, call `set()` / `render()` after changes.
import { api, auth, ApiError } from './api.js';

export const state = {
  phase: 'loading', // loading | signedOut | interests | fan | athlete
  user: null,
  athlete: null,
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
  if (me) adopt(me.user, me.athlete); // open instantly; refreshed below
  try {
    const fresh = await api.get('me');
    adopt(fresh.user, fresh.athlete);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return endSession();
    if (!me) set({ phase: 'signedOut' });
  }
}

function adopt(user, athlete) {
  cache('me', { user, athlete });
  set({ user, athlete, phase: user.role === 'athlete' ? 'athlete' : 'fan' });
}

export async function signInFan(code) {
  const r = await api.post('auth/fan', { code: code.trim().toUpperCase() });
  auth.set(r.token);
  cache('me', { user: r.user, athlete: r.athlete });
  set({ user: r.user, athlete: r.athlete, phase: 'interests' });
}

export async function completeOnboarding(name, interests) {
  const body = {};
  if (name && name.trim()) body.name = name.trim().slice(0, 40);
  if (interests.length) body.interests = interests;
  if (Object.keys(body).length) {
    try { await updateProfile(body); } catch {}
  }
  set({ phase: 'fan' });
}

export async function signInAthlete(key) {
  const r = await api.post('auth/athlete', { key: key.trim() });
  auth.set(r.token);
  adopt(r.user, r.athlete);
}

export async function updateProfile(changes) {
  const r = await api.patch('me', changes);
  cache('me', { user: r.user, athlete: state.athlete });
  set({ user: r.user });
}

export function updateAthlete(athlete) {
  if (!athlete) return;
  cache('me', { user: state.user, athlete });
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
  settings: null, prompts: [], coverage: [], stories: [], bio: null, coach: [], coachLoaded: false,
};

export function endSession() {
  auth.set(null);
  clearCache();
  window.dispatchEvent(new Event('strive:signout'));
  set({ ...FRESH, user: null, athlete: null, phase: 'signedOut' });
  if (location.hash && location.hash !== '#/') location.hash = '#/';
}

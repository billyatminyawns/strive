// Strive API v1 client (contract: docs/API-v1.md). Holds the bearer token; everything else is stateless.

const PRODUCTION = 'https://strive-api.billyatminyawns.workers.dev/v1/';
const TOKEN_KEY = 'strive.token';

/** Production by default. A local API can be used for testing with ?api=http://127.0.0.1:8787/v1 —
 *  only loopback hosts are accepted, so a link can never point someone's session at a stranger's server. */
export const BASE = (() => {
  try {
    const asked = new URLSearchParams(location.search).get('api');
    if (asked !== null) {
      if (asked === '' || asked === 'prod') localStorage.removeItem('strive.apiBase');
      else if (isLoopback(asked)) localStorage.setItem('strive.apiBase', asked);
    }
    const saved = localStorage.getItem('strive.apiBase');
    if (saved && isLoopback(saved)) return saved.replace(/\/?$/, '/');
  } catch {}
  return PRODUCTION;
})();

function isLoopback(url) {
  try { return ['localhost', '127.0.0.1'].includes(new URL(url).hostname); } catch { return false; }
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

let token = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
let onUnauthorized = () => {};

export const auth = {
  get token() { return token; },
  set(t) {
    token = t || null;
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
  },
  onUnauthorized(fn) { onUnauthorized = fn; },
};

async function request(method, path, body, accept = 'application/json') {
  const headers = { Accept: accept };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  } catch {
    throw new ApiError(0, "Can't reach Strive right now — check your connection and try again.");
  }
  if (!res.ok) {
    let message = '';
    try { message = (await res.json()).error || ''; } catch {}
    // a 401 from auth/* means "that credential didn't work", not "your session ended" — keep the session
    if (res.status === 401 && token && !path.startsWith('auth/')) onUnauthorized();
    throw new ApiError(res.status, message || fallback(res.status));
  }
  return res;
}

function fallback(status) {
  if (status === 401) return 'Your session ended. Please sign in again.';
  if (status === 403) return "That isn't available on this account.";
  if (status === 404) return "We couldn't find that.";
  if (status === 429) return 'Slow down a little — try again soon.';
  if (status >= 500) return 'Strive is having a moment. Please try again.';
  return 'Something went wrong. Please try again.';
}

const json = async (res) => res.json();

export const api = {
  get: (path) => request('GET', path).then(json),
  post: (path, body = {}) => request('POST', path, body).then(json),
  patch: (path, body) => request('PATCH', path, body).then(json),
  del: (path) => request('DELETE', path).then(json),
  /** Audio needs the bearer header, so it's fetched as a blob rather than streamed by <audio src>. */
  audio: (key) => request('GET', 'audio/' + encodeURIComponent(key), undefined, 'audio/mpeg').then((r) => r.blob()),
};

export const message = (e) => (e && e.message) || 'Something went wrong. Please try again.';

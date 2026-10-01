/* STRIVE API v1.2 — sign-in: email codes + Google (contract: docs/API-v1.md, "v1.2 — Sign-in").
   The invite code still gates NEW accounts; these routes only link an identity to the signed-in user
   (bearer token sent → link mode) or sign back into the account it is linked to (no token → sign-in
   mode). An identity is unique per (provider, subject, athlete room); one user has at most five.
   Email codes: 6 digits, stored only as salted SHA-256, newest one only, 5 tries, 10 minutes, sent
   through Resend's HTTP API. Google: ID tokens verified with WebCrypto (RS256) against Google's JWKS.
   Codes and whole addresses never reach the logs (maskEmail). */

import { fail, json, body, stmt, one, all, run, newId, newToken, sha256, userOut, athleteOut, authAttempt, ipCount } from './v1.js';

const MINUTE = 60e3, DAY = 24 * 60 * MINUTE;
const CODE_TTL = 10 * MINUTE;
const CODE_TRIES = 5;           // wrong tries that burn a code
const MAX_IDENTITIES = 5;
const ADDRESS_BURST = [15 * MINUTE, 3];   // codes per address: 3 per 15 minutes …
const ADDRESS_DAY = 10;                   // … and 10 per day
const EMAIL_PER_IP_HOUR = 20;   // env EMAIL_PER_IP_HOUR overrides (local test runs all share 127.0.0.1)
const EMAIL_DAILY_CAP = 500;    // env EMAIL_DAILY_CAP overrides
const SKEW = 60;                // seconds of clock skew allowed on Google's exp / iat / nbf

const RESEND = 'https://api.resend.com';
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

const BAD_EMAIL = 'Enter a valid email address.';
const EMAIL_OFF = "Email sign-in isn't set up yet.";
const SENT_RECENTLY = 'We just sent you a code — check your inbox (and spam), or try again in a few minutes.';
const WRONG_CODE = "That code isn't right.";
const CODE_GONE = 'That code has expired — send a new one.';
const TOO_MANY_TRIES = 'Too many tries — send a new code.';
const GOOGLE_OFF = "Google sign-in isn't set up yet.";
const GOOGLE_FAILED = "Google sign-in didn't work — try again.";
const MAX_REACHED = "That's the most sign-in methods one account can have.";
const NO_ACCOUNT = {
  email: 'No Strive account uses this email yet. New here? Use your invite code.',
  google: 'No Strive account uses this Google account yet. New here? Use your invite code.',
};
const TAKEN = {
  email: 'That email already belongs to another Strive account. Sign out, then sign in with it.',
  google: 'That Google account already belongs to another Strive account. Sign out, then sign in with it.',
};

/* ---------- config + helpers ---------- */

const emailOn = env => !!(env.RESEND_API_KEY && env.EMAIL_FROM);

export function signInConfig(env) {
  return { email: emailOn(env), google: env.GOOGLE_CLIENT_ID || null };
}

// the test-only endpoint overrides (RESEND_BASE_URL, GOOGLE_JWKS_URL) count only on this machine
export function loopbackUrl(v) {
  if (typeof v !== 'string' || !v) return null;
  try {
    const u = new URL(v);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) && !u.username && !u.password;
    return local && /^https?:$/.test(u.protocol) ? u.href.replace(/\/+$/, '') : null;
  } catch { return null; }
}

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

// normalized address (trimmed, lowercased, ≤ 254 chars) or null
export function normEmail(v) {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return s.length <= 254 && EMAIL_RE.test(s) ? s : null;
}

// "j***@e***.com" — enough to tell log lines apart, never the address
export function maskEmail(e) {
  const [local = '', domain = ''] = String(e).split('@');
  const dot = domain.lastIndexOf('.');
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***${dot > 0 ? domain.slice(dot) : ''}`;
}

// 6 uniform digits: 32 random bits, redrawn above the largest multiple of 10^6 so % 10^6 has no bias
export function newCode() {
  const r = new Uint32Array(1);
  do crypto.getRandomValues(r); while (r[0] >= 4294000000);
  return String(r[0] % 1e6).padStart(6, '0');
}

// salted with the row id, so equal codes never share a hash
const codeHash = (id, code) => sha256(`${id}:${code}`);

const identityOut = i => ({ id: i.id, provider: i.provider, email: i.email ?? null, createdAt: i.created_at });
const identitiesStmt = (env, userId) => stmt(env,
  'SELECT id, provider, email, created_at FROM identities WHERE user_id = ? ORDER BY created_at, id', userId);

export async function identitiesOf(env, userId) {
  return (await identitiesStmt(env, userId).all()).results.map(identityOut);
}

/* ---------- email codes ---------- */

async function sendCode(env, to, code) {
  const line = "It expires in 10 minutes. If you didn't ask for it, ignore this email — nobody can get in without the code.";
  const html = '<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#111">'
    + `<p>Your Strive sign-in code is</p><p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:8px 0">${code}</p>`
    + `<p>${line}</p></div>`;
  let res;
  try {
    res = await fetch((loopbackUrl(env.RESEND_BASE_URL) || RESEND) + '/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      // no links or images, so nothing in it can track the reader
      body: JSON.stringify({
        from: env.EMAIL_FROM, to: [to], subject: `Your Strive code: ${code}`, text: `Your Strive sign-in code is ${code}. ${line}`, html,
      }),
      signal: AbortSignal.timeout(10e3),
    });
  } catch (e) {
    console.error('sign-in email not sent', maskEmail(to), e && e.name);
    return false;
  }
  if (res.ok) {
    await res.text().catch(() => '');
    return true;
  }
  const err = await res.json().catch(() => ({}));
  console.error('sign-in email refused', res.status, err && err.name, maskEmail(to));
  return false;
}

/* POST /v1/auth/email/start {email} → 202 {sent, expiresIn}. Signed out: only for an address that
   already signs into an account. Signed in: a link code, bound to this user. */
export async function emailStart(c) {
  const { env, user } = c;
  if (!emailOn(env)) fail(503, EMAIL_OFF);
  const email = normEmail((await body(c)).email) || fail(400, BAD_EMAIL);
  // every valid request counts per IP — the 404s too, so addresses can't be probed in bulk
  if (await ipCount(c, 'email') > (Number(env.EMAIL_PER_IP_HOUR) || EMAIL_PER_IP_HOUR)) fail(429, SENT_RECENTLY);
  if (!user) {
    const known = await one(env, `SELECT 1 FROM identities i JOIN users u ON u.id = i.user_id JOIN athletes a ON a.id = u.athlete_id
      WHERE i.email = ? LIMIT 1`, email);
    if (!known) fail(404, NO_ACCOUNT.email);
  } else {
    // don't send a code that could only end in "too many sign-in methods"
    const n = await one(env, `SELECT COUNT(*) AS n, COALESCE(SUM(provider = 'email' AND subject = ?), 0) AS mine
      FROM identities WHERE user_id = ?`, email, user.id);
    if (n.n >= MAX_IDENTITIES && !n.mine) fail(400, MAX_REACHED);
  }
  const now = Date.now();
  const id = newId('lc');
  const code = newCode();
  const cap = Number(env.EMAIL_DAILY_CAP) || EMAIL_DAILY_CAP;
  // the limits live in the INSERT itself, so parallel requests can't slip past them
  const ins = await run(env, `INSERT INTO login_codes (id, email, code_hash, user_id, attempts, expires_at, created_at)
    SELECT ?1, ?2, ?3, ?4, 0, ?5, ?6
    WHERE (SELECT COUNT(*) FROM login_codes WHERE email = ?2 AND created_at > ?7) < ?8
      AND (SELECT COUNT(*) FROM login_codes WHERE email = ?2 AND created_at > ?9) < ?10
      AND (SELECT COUNT(*) FROM login_codes WHERE created_at > ?9) < ?11`,
  id, email, await codeHash(id, code), user ? user.id : null, now + CODE_TTL, now,
  now - ADDRESS_BURST[0], ADDRESS_BURST[1], now - DAY, ADDRESS_DAY, cap);
  if (!ins.meta.changes) {
    const n = await one(env, `SELECT COUNT(*) AS day, COALESCE(SUM(created_at > ?2), 0) AS burst
      FROM login_codes WHERE email = ?1 AND created_at > ?3`, email, now - ADDRESS_BURST[0], now - DAY);
    if (n.burst >= ADDRESS_BURST[1] || n.day >= ADDRESS_DAY) fail(429, SENT_RECENTLY);
    console.error('sign-in email: daily cap reached', cap);
    fail(503, 'Sign-in email is busy — try again later.');
  }
  if (!await sendCode(env, email, code)) {
    // it never went out: unusable, and it doesn't count against the address
    await run(env, 'DELETE FROM login_codes WHERE id = ?', id);
    fail(502, "We couldn't send that email — try again.");
  }
  // only the newest code works: older ones for this address expire now
  await run(env, `UPDATE login_codes SET expires_at = ?1 WHERE email = ?2 AND used_at IS NULL AND expires_at > ?1
    AND (created_at < ?3 OR (created_at = ?3 AND id < ?4))`, now, email, now, id);
  return json({ sent: true, expiresIn: CODE_TTL / 1000 }, 202);
}

/* POST /v1/auth/email/verify {email, code} → the identity flow for that address */
export async function emailVerify(c) {
  const { env, user } = c;
  if (!emailOn(env)) fail(503, EMAIL_OFF);
  await authAttempt(c);
  const b = await body(c);
  const email = normEmail(b.email) || fail(400, BAD_EMAIL);
  const code = typeof b.code === 'string' ? b.code.replace(/[\s-]/g, '') : typeof b.code === 'number' ? String(b.code) : '';
  const now = Date.now();
  const row = await one(env, 'SELECT * FROM login_codes WHERE email = ? ORDER BY created_at DESC, id DESC LIMIT 1', email);
  // none, expired, used, or minted for the other mode / another user
  if (!row || row.used_at || row.expires_at <= now || row.user_id !== (user ? user.id : null)) fail(410, CODE_GONE);
  if (row.attempts >= CODE_TRIES) fail(429, TOO_MANY_TRIES);
  const hash = /^\d{6}$/.test(code) ? await codeHash(row.id, code) : '';
  // one statement compares and then either spends the code or counts the miss, so parallel guesses
  // can't race past the limit
  const res = await one(env, `UPDATE login_codes SET attempts = attempts + (code_hash != ?1), used_at = CASE WHEN code_hash = ?1 THEN ?2 END
    WHERE id = ?3 AND used_at IS NULL AND expires_at > ?2 AND attempts < ?4 RETURNING attempts, used_at`, hash, now, row.id, CODE_TRIES);
  if (!res) {
    // it changed under us: spent, burned or replaced a moment ago
    const now2 = await one(env, 'SELECT attempts, used_at, expires_at FROM login_codes WHERE id = ?', row.id);
    if (now2 && !now2.used_at && now2.expires_at > now && now2.attempts >= CODE_TRIES) fail(429, TOO_MANY_TRIES);
    fail(410, CODE_GONE);
  }
  if (!res.used_at) fail(res.attempts >= CODE_TRIES ? 429 : 400, res.attempts >= CODE_TRIES ? TOO_MANY_TRIES : WRONG_CODE);
  return identityFlow(c, { provider: 'email', subject: email, email });
}

/* ---------- Google ---------- */

const b64urlBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));

let jwks = null;   // { url, keys: Map(kid → CryptoKey), at, until } — per isolate, refreshed per Cache-Control

async function loadJwks(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10e3) });
  if (!res.ok) throw new Error('JWKS status ' + res.status);
  const { keys } = await res.json();
  const map = new Map();
  for (const k of Array.isArray(keys) ? keys : []) {
    if (!k || k.kty !== 'RSA' || typeof k.kid !== 'string' || (k.alg && k.alg !== 'RS256') || (k.use && k.use !== 'sig')) continue;
    try {
      map.set(k.kid, await crypto.subtle.importKey('jwk', { kty: 'RSA', n: k.n, e: k.e, alg: 'RS256' },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
    } catch { /* skip a key we can't use */ }
  }
  const age = Number((/max-age=(\d+)/i.exec(res.headers.get('cache-control') || '') || [])[1] ?? 3600);
  const now = Date.now();
  return { url, keys: map, at: now, until: now + Math.min(Math.max(age, 60), 86400) * 1000 };
}

async function googleKey(env, kid) {
  const url = loopbackUrl(env.GOOGLE_JWKS_URL) || GOOGLE_JWKS;
  const now = Date.now();
  const cached = jwks && jwks.url === url ? jwks : null;
  // an unknown kid (Google rotated its keys) refetches early — at most once a minute
  if (cached && now < cached.until && (cached.keys.has(kid) || now - cached.at < MINUTE)) return cached.keys.get(kid) || null;
  try {
    jwks = await loadJwks(url);
  } catch (e) {
    console.error('google keys unavailable', e && e.message);
    if (cached && cached.keys.has(kid)) return cached.keys.get(kid);   // a stale key beats none
    fail(502, GOOGLE_FAILED);
  }
  return jwks.keys.get(kid) || null;
}

// → { sub, email } (email only when Google says it's verified), or 401
async function verifyGoogle(env, credential) {
  const no = () => fail(401, GOOGLE_FAILED);
  const parts = credential.length <= 8192 ? credential.split('.') : [];
  if (parts.length !== 3 || !parts.every(p => /^[A-Za-z0-9_-]+$/.test(p))) no();
  let header, claims, sig;
  try {
    [header, claims] = parts.slice(0, 2).map(p => JSON.parse(new TextDecoder().decode(b64urlBytes(p))));
    sig = b64urlBytes(parts[2]);
  } catch { no(); }
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || !claims || typeof claims !== 'object') no();
  const key = await googleKey(env, header.kid);
  const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  if (!key || !await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signed).catch(() => false)) no();
  const now = Date.now() / 1000;
  const num = v => typeof v === 'number' && Number.isFinite(v);
  if (claims.aud !== env.GOOGLE_CLIENT_ID || !GOOGLE_ISSUERS.includes(claims.iss)
    || !num(claims.exp) || claims.exp + SKEW <= now
    || !num(claims.iat) || claims.iat - SKEW > now
    || (claims.nbf !== undefined && (!num(claims.nbf) || claims.nbf - SKEW > now))
    || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) no();
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  return { sub: claims.sub, email: verified ? normEmail(claims.email) : null };
}

/* POST /v1/auth/google {credential} → the identity flow for that Google account */
export async function googleSignIn(c) {
  const { env } = c;
  if (!env.GOOGLE_CLIENT_ID) fail(503, GOOGLE_OFF);
  await authAttempt(c);
  const { credential } = await body(c);
  if (typeof credential !== 'string' || !credential) fail(400, GOOGLE_FAILED);
  const g = await verifyGoogle(env, credential);
  // the stored address follows the Google account: refreshed on every use, cleared once unverified
  await run(env, `UPDATE identities SET email = ? WHERE provider = 'google' AND subject = ? AND email IS NOT ?`, g.email, g.sub, g.email);
  return identityFlow(c, { provider: 'google', subject: g.sub, email: g.email });
}

/* ---------- the identity flow ---------- */

const identityFlow = (c, ident) => (c.user ? linkTo(c, ident) : signInWith(c, ident));

const athleteFirst = (x, y) => (y.role === 'athlete') - (x.role === 'athlete');

/* Accounts an identity signs into → the one to use. Across rooms: the athlete account, then the
   newest. Inside one room an address can only match twice through a Google account that shares it;
   the address's own email identity wins there (after the athlete). */
function pickAccount(rows) {
  const rooms = new Map();
  for (const r of rows) {
    const cur = rooms.get(r.athlete_id);
    if (!cur || (athleteFirst(cur, r) || (r.via === 'email') - (cur.via === 'email') || r.created_at - cur.created_at) > 0) rooms.set(r.athlete_id, r);
  }
  return [...rooms.values()].sort((x, y) => athleteFirst(x, y) || y.created_at - x.created_at)[0] || null;
}

// sign-in mode: an email code also reaches accounts whose Google identity has that verified address
async function signInWith(c, ident) {
  const { env } = c;
  const rows = await all(env, `SELECT u.*, i.provider AS via FROM identities i JOIN users u ON u.id = i.user_id JOIN athletes a ON a.id = u.athlete_id
    WHERE ${ident.provider === 'email' ? 'i.email = ?' : `i.provider = 'google' AND i.subject = ?`}`, ident.provider === 'email' ? ident.email : ident.subject);
  const u = pickAccount(rows) || fail(404, NO_ACCOUNT[ident.provider]);
  const token = newToken();
  const [ins, users, athletes, ids] = await env.DB.batch([
    stmt(env, `INSERT INTO tokens (token_hash, user_id, athlete_id, created_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)`,
      await sha256(token), u.id, u.athlete_id, Date.now(), u.id),
    stmt(env, 'SELECT * FROM users WHERE id = ?', u.id),
    stmt(env, 'SELECT * FROM athletes WHERE id = ?', u.athlete_id),
    identitiesStmt(env, u.id),
  ]);
  if (!ins.meta.changes) fail(404, NO_ACCOUNT[ident.provider]);   // deleted a moment ago
  return json({ token, user: userOut(users.results[0]), athlete: athleteOut(athletes.results[0]), identities: ids.results.map(identityOut) });
}

/* Who already holds this identity in the signed-in user's room. An address belongs to whoever linked
   it as an email identity; failing that, to the account(s) whose verified Google address it is — the
   same accounts an email code signs into — preferring the caller's own. */
async function ownerInRoom(env, ident, user) {
  const rows = ident.provider === 'google'
    ? await all(env, `SELECT u.*, i.provider AS via, 1 AS exact FROM identities i JOIN users u ON u.id = i.user_id
        WHERE i.provider = 'google' AND i.subject = ? AND i.athlete_id = ?`, ident.subject, user.athlete_id)
    : await all(env, `SELECT u.*, i.provider AS via, i.provider = 'email' AS exact FROM identities i JOIN users u ON u.id = i.user_id
        WHERE i.email = ? AND i.athlete_id = ?`, ident.email, user.athlete_id);
  return rows.find(r => r.exact) || rows.find(r => r.id === user.id) || pickAccount(rows);
}

const linked = async c => json({ linked: true, user: userOut(c.user), identities: await identitiesOf(c.env, c.user.id) });

// link mode
async function linkTo(c, ident) {
  const { env, user } = c;
  for (let look = 0; look < 2; look++) {
    const owner = await ownerInRoom(env, ident, user);
    if (owner && owner.id !== user.id) return switchOrConflict(c, owner, ident);
    if (owner && owner.exact) return linked(c);   // already this user's: idempotent
    // new to this room (or an address only this user's Google account had): link it, five at most
    const [, ins] = await env.DB.batch([
      // a row left behind by a user who no longer exists can't block it
      stmt(env, 'DELETE FROM identities WHERE provider = ? AND subject = ? AND athlete_id = ? AND user_id NOT IN (SELECT id FROM users)',
        ident.provider, ident.subject, user.athlete_id),
      stmt(env, `INSERT OR IGNORE INTO identities (id, user_id, athlete_id, provider, subject, email, created_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE (SELECT COUNT(*) FROM identities WHERE user_id = ?2) < ?8`,
      newId('i'), user.id, user.athlete_id, ident.provider, ident.subject, ident.email, Date.now(), MAX_IDENTITIES),
    ]);
    if (ins.meta.changes) return linked(c);
    // nothing added: the five-method limit, unless someone linked it a moment ago (then look again)
    const raced = await one(env, 'SELECT 1 FROM identities WHERE provider = ? AND subject = ? AND athlete_id = ?',
      ident.provider, ident.subject, user.athlete_id);
    if (!raced) fail(400, MAX_REACHED);
  }
  fail(409, TAKEN[ident.provider]);
}

/* The identity belongs to someone else in this room. A fan account with no activity yet (no
   questions — saves are questions — and no listens) switches into that account: the iPhone case,
   someone who re-joined in the Home Screen app saving their seat with the address they used in
   Safari. Anyone else gets a 409. */
async function switchOrConflict(c, owner, ident) {
  const { env, user } = c;
  if (user.role !== 'fan') fail(409, TAKEN[ident.provider]);
  const token = newToken();
  const hash = await sha256(token);
  const now = Date.now();
  // one transaction: the owner's token is minted only while this account is still empty, and the
  // rest runs only if that happened
  const done = 'EXISTS (SELECT 1 FROM tokens WHERE token_hash = ?2)';
  const res = await env.DB.batch([
    stmt(env, `INSERT INTO tokens (token_hash, user_id, athlete_id, created_at) SELECT ?2, ?3, ?4, ?5
      WHERE EXISTS (SELECT 1 FROM users WHERE id = ?1 AND role = 'fan') AND EXISTS (SELECT 1 FROM users WHERE id = ?3)
        AND NOT EXISTS (SELECT 1 FROM questions WHERE user_id = ?1) AND NOT EXISTS (SELECT 1 FROM listens WHERE user_id = ?1)`,
    user.id, hash, owner.id, owner.athlete_id, now),
    ...['tokens', 'devices', 'notifications', 'identities'].map(t => stmt(env, `DELETE FROM ${t} WHERE user_id = ?1 AND ${done}`, user.id, hash)),
    stmt(env, `DELETE FROM users WHERE id = ?1 AND ${done}`, user.id, hash),
    // an address that reached the owner through its Google account is linked to it too (room permitting)
    ...(ident.provider === 'email' && !owner.exact ? [stmt(env, `INSERT OR IGNORE INTO identities (id, user_id, athlete_id, provider, subject, email, created_at)
      SELECT ?3, ?4, ?5, 'email', ?6, ?6, ?7 WHERE ${done} AND (SELECT COUNT(*) FROM identities WHERE user_id = ?4) < ?8`,
    user.id, hash, newId('i'), owner.id, owner.athlete_id, ident.email, now, MAX_IDENTITIES)] : []),
    stmt(env, 'SELECT * FROM users WHERE id = ?', owner.id),
    stmt(env, 'SELECT * FROM athletes WHERE id = ?', owner.athlete_id),
    identitiesStmt(env, owner.id),
  ]);
  if (!res[0].meta.changes) fail(409, TAKEN[ident.provider]);   // it has activity now (or the owner left)
  const [users, athletes, ids] = res.slice(-3);
  return json({
    switched: true, token, user: userOut(users.results[0]), athlete: athleteOut(athletes.results[0]), identities: ids.results.map(identityOut),
  });
}

/* DELETE /v1/me/identities/:id → { identities } left on the caller's account */
export async function deleteIdentity(c) {
  const { env, user } = c;
  const [res, ids] = await env.DB.batch([
    stmt(env, 'DELETE FROM identities WHERE id = ? AND user_id = ?', c.params.id, user.id),
    identitiesStmt(env, user.id),
  ]);
  if (!res.meta.changes) fail(404, "That sign-in method isn't on your account.");
  return json({ identities: ids.results.map(identityOut) });
}

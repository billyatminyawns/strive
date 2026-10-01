#!/usr/bin/env node
/* v1.2 sign-in (email codes + Google), end to end against a LOCAL instance whose Resend and Google keys
   are test/mock-identity.mjs — no mail leaves the machine, no Google account involved:
     STRIVE_TEST_KEY_ANGELA=<random> STRIVE_TEST_KEY_REVIEW=<random> STRIVE_LOCAL_SIGNIN=mock scripts/local-up.sh
     STRIVE_TEST_KEY_REVIEW=<same> node test/v1-signin.test.mjs
     scripts/local-down.sh
   Covers: config.signIn · in-process (the real handlers on an SQLite stand-in for D1): the
   not-configured 503s, the default per-IP limit, the daily cap, non-loopback endpoint overrides being
   ignored, logs without codes or addresses · start: validation, unknown address, a bad token ·
   linking an address by code (the email itself, wrong / used codes) · signing back in with it (the
   same account) · 5 wrong tries burn a code · the per-address limit · codes bound to their mode and
   user · expired and replaced codes · provider failure · Google link + sign-in and the ways a token can
   be wrong · email codes reaching a Google identity's verified address, never an unverified one · one
   address on two accounts in a room · the empty-account switch (Google and email) · 409 once a fan
   has activity, and always for the athlete · the athlete linking an address and signing in with it ·
   DELETE /v1/me/identities/:id · five methods at most · DELETE /v1/me taking identities and codes.
   Fans live only in the angela-review room. Every user, identity and login code it creates is removed —
   checked in the local D1 at the end (wrangler d1 execute --local) — and the room is left exactly as it
   was found. Safe to run repeatedly: addresses and Google subjects are unique per run. */

import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleV1 } from '../src/v1.js';
import { loopbackUrl, normEmail, newCode } from '../src/signin.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(here, '..');
let base = (process.env.STRIVE_API_BASE || 'http://127.0.0.1:8787').replace(/\/+$/, '');
if (!base.endsWith('/v1')) base += '/v1';
const ID = (process.env.STRIVE_IDENTITY_URL || `http://127.0.0.1:${process.env.STRIVE_IDENTITY_PORT || 8791}`).replace(/\/+$/, '');
const RUN = randomBytes(4).toString('hex');
const DOMAIN = 'strive-signin.test';
const addr = label => `${label}.${RUN}@${DOMAIN}`;
const NAME = label => `Signin ${label} ${RUN}`;

const BAD_EMAIL = 'Enter a valid email address.';
const NO_EMAIL = 'No Strive account uses this email yet. New here? Use your invite code.';
const SENT = 'We just sent you a code — check your inbox (and spam), or try again in a few minutes.';
const EMAIL_OFF = "Email sign-in isn't set up yet.";
const SEND_FAILED = "We couldn't send that email — try again.";
const WRONG = "That code isn't right.";
const GONE = 'That code has expired — send a new one.';
const TRIES = 'Too many tries — send a new code.';
const G_FAILED = "Google sign-in didn't work — try again.";
const G_OFF = "Google sign-in isn't set up yet.";
const NO_GOOGLE = 'No Strive account uses this Google account yet. New here? Use your invite code.';
const TAKEN_EMAIL = 'That email already belongs to another Strive account. Sign out, then sign in with it.';
const TAKEN_GOOGLE = 'That Google account already belongs to another Strive account. Sign out, then sign in with it.';
const MAX = "That's the most sign-in methods one account can have.";
const mailText = code => `Your Strive sign-in code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this email — nobody can get in without the code.`;

const die = msg => { console.error('v1-signin: ' + msg); process.exit(2); };

let passed = 0;
const failed = [];
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ok    ' + name); return true; }
  failed.push(name);
  console.log('  FAIL  ' + name + (detail === undefined ? '' : '\n        ' + JSON.stringify(detail).slice(0, 600)));
  return false;
}

async function api(method, p, { token, body, headers = {} } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  return { status: res.status, data: isJson ? await res.json() : null };
}
const isErr = (r, status, message) => r.status === status && typeof r.data?.error === 'string' && (message === undefined || r.data.error === message);
const idOf = (r, provider, email) => r.data?.identities?.find(i => i.provider === provider && (email === undefined || i.email === email));

// the mock: mail it received, Google tokens it signs
async function mailTo(to) {
  const r = await fetch(ID + '/__mail?to=' + encodeURIComponent(to));
  return r.status === 200 ? r.json() : { count: 0 };
}
const codeOf = m => (/^Your Strive code: (\d{6})$/.exec(m.subject || '') || [])[1];
async function gtoken(claims = {}) {
  const r = await fetch(ID + '/__google-token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(claims) });
  return (await r.json()).credential;
}
const wrongOf = code => String((Number(code) + 1) % 1e6).padStart(6, '0');

const start = (email, token) => api('POST', '/auth/email/start', { token, body: { email } });
const verify = (email, code, token) => api('POST', '/auth/email/verify', { token, body: { email, code } });
const google = (credential, token) => api('POST', '/auth/google', { token, body: { credential } });
// start → 202 and the code the mock received for it (null if it didn't arrive)
async function sendCode(email, token) {
  const before = (await mailTo(email)).count;
  const r = await start(email, token);
  const m = await mailTo(email);
  return { r, code: r.status === 202 && m.count === before + 1 ? codeOf(m) : null, mail: m };
}

// the local D1, read and written straight through wrangler (local only: test data never leaves it)
function d1(sql) {
  const out = spawnSync(path.join(WORKER, 'node_modules/.bin/wrangler'), ['d1', 'execute', 'strive-db', '--local', '--json', '--command', sql],
    { cwd: WORKER, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  if (out.status !== 0) throw new Error('wrangler d1 execute failed: ' + (out.stderr || out.stdout).slice(-400));
  return JSON.parse(out.stdout).map(r => r.results);
}
const count = sql => d1(sql)[0][0].n;
const runLike = `'%.${RUN}@${DOMAIN}'`;   // RUN is hex: nothing to escape

/* In-process: the real handlers on an in-memory SQLite stand-in for D1 (schema.sql), with fetch and
   console.error stubbed — for what a shared local server can't show: the default per-IP limit, the
   daily cap, that non-loopback endpoint overrides are ignored, and that logs carry no code or address. */
async function inProcessChecks() {
  let DatabaseSync;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch { return console.log('  skip  in-process limits (node:sqlite unavailable)'); }
  const fakeD1 = () => {
    const db = new DatabaseSync(':memory:');
    db.exec(fs.readFileSync(path.join(WORKER, 'schema.sql'), 'utf8'));
    const token = 'st_inprocess';
    db.exec(`INSERT INTO athletes (id, name, first_name, coach_name, created_at) VALUES ('room', 'Test Athlete', 'Test', 'Coach Test', 1);
      INSERT INTO users (id, athlete_id, role, name, interests, notifs_read_at, created_at) VALUES ('u_in', 'room', 'fan', 'In', '[]', 0, 1);
      INSERT INTO tokens (token_hash, user_id, athlete_id, created_at) VALUES ('${createHash('sha256').update(token).digest('hex')}', 'u_in', 'room', 1);`);
    const exec = (sql, binds) => {
      const results = db.prepare(sql).all(...binds);
      return { results, success: true, meta: { changes: db.prepare('SELECT changes() AS n').get().n } };
    };
    const st = (sql, binds = []) => ({
      bind: (...b) => st(sql, b), exec: () => exec(sql, binds),
      first: async () => exec(sql, binds).results[0] ?? null, all: async () => exec(sql, binds), run: async () => exec(sql, binds),
    });
    return {
      token,
      DB: {
        prepare: sql => st(sql),
        batch: async list => {
          db.exec('BEGIN');
          try { const out = list.map(s => s.exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
        },
      },
    };
  };
  const call = async (env, p, body, token) => {
    const r = await handleV1(new Request('http://in-process/v1' + p, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body),
    }), env, { waitUntil() {} });
    return { status: r.status, data: await r.json() };
  };
  const seen = [], logs = [];
  let resendStatus = 200;
  const realFetch = globalThis.fetch, realError = console.error;
  globalThis.fetch = async (url, init = {}) => {
    seen.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
    if (String(url).endsWith('/emails')) return new Response(JSON.stringify(resendStatus === 200 ? { id: 'x' } : { name: 'internal_server_error' }), { status: resendStatus });
    return new Response('{}', { status: 500 });   // Google's keys: unavailable
  };
  console.error = (...a) => { logs.push(a.map(String).join(' ')); };
  try {
    const base = { RESEND_API_KEY: 'in-process-mock', EMAIL_FROM: 'Strive <signin@strive.test>', GOOGLE_CLIENT_ID: 'in-process.apps.googleusercontent.com' };
    const a = { ...fakeD1(), ...base, RESEND_BASE_URL: 'https://evil.example', GOOGLE_JWKS_URL: 'https://evil.example/certs' };
    const sends = [];
    for (let i = 1; i <= 21; i++) sends.push(await call(a, '/auth/email/start', { email: addr('ip' + i) }, a.token));
    check('per IP: 20 code requests an hour by default, the 21st → 429', sends.slice(0, 20).every(r => r.status === 202) && isErr(sends[20], 429, SENT),
      sends.map(r => r.status));
    check('a non-loopback RESEND_BASE_URL is ignored: mail goes to api.resend.com', seen.length === 20
      && seen.every(s => s.url === 'https://api.resend.com/emails'), [...new Set(seen.map(s => s.url))]);
    seen.length = 0;
    const crafted = ['{"alg":"RS256","kid":"k1"}', '{}'].map(s => Buffer.from(s).toString('base64url')).join('.') + '.AAAA';
    check('a non-loopback GOOGLE_JWKS_URL is ignored: keys come from googleapis.com (unreachable here → 502)',
      isErr(await call(a, '/auth/google', { credential: crafted }), 502, G_FAILED) && seen.length === 1 && seen[0].url === 'https://www.googleapis.com/oauth2/v3/certs', seen);
    const b = { ...fakeD1(), ...base, RESEND_BASE_URL: 'http://127.0.0.1:9', EMAIL_DAILY_CAP: '3' };
    seen.length = 0;
    const capped = [];
    for (let i = 1; i <= 4; i++) capped.push(await call(b, '/auth/email/start', { email: addr('cap' + i) }, b.token));
    check('a loopback RESEND_BASE_URL is used', seen.length === 3 && seen.every(s => s.url === 'http://127.0.0.1:9/emails'), seen.map(s => s.url));
    check('the daily cap (EMAIL_DAILY_CAP=3): the 4th address → 503', capped.slice(0, 3).every(r => r.status === 202)
      && isErr(capped[3], 503, 'Sign-in email is busy — try again later.'), capped.map(r => r.status));
    const c = { ...fakeD1(), ...base };
    resendStatus = 500;
    logs.length = 0;
    seen.length = 0;
    const failAddr = addr('logs');
    const r = await call(c, '/auth/email/start', { email: failAddr }, c.token);
    const sentCode = codeOf(seen[0]?.body || {});
    check('a provider failure → 502, logged without the code or the address', isErr(r, 502, SEND_FAILED) && !!sentCode && logs.length > 0
      && logs.every(l => !l.includes(sentCode) && !l.includes(failAddr) && !l.includes(failAddr.split('@')[0])), logs);
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
}

async function main() {
  console.log(`v1.2 sign-in → ${base} (mock Resend + Google at ${ID}, run ${RUN})`);
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) die('local instances only — it reads and writes the local D1.');
  const key = process.env.STRIVE_TEST_KEY_REVIEW || die('set STRIVE_TEST_KEY_REVIEW to the key you gave scripts/local-up.sh');
  try { if (!(await fetch(ID + '/__health')).ok) throw new Error(); } catch {
    die(`no mock identity server at ${ID} — start the server with STRIVE_LOCAL_SIGNIN=mock scripts/local-up.sh`);
  }
  const cfg = (await api('GET', '/config')).data;
  if (!cfg?.signIn?.email || !cfg.signIn.google) die('sign-in is off on this server — start it with STRIVE_LOCAL_SIGNIN=mock scripts/local-up.sh');
  const CLIENT = cfg.signIn.google;

  const ath = (await api('POST', '/auth/athlete', { body: { key } })).data?.token || die('athlete sign-in failed (wrong STRIVE_TEST_KEY_REVIEW?)');
  const before = await tenantSnapshot(ath);
  const athleteIdsBefore = (await api('GET', '/me', { token: ath })).data.identities.map(i => i.id);
  const angelaBefore = d1(`SELECT (SELECT COUNT(*) FROM users WHERE athlete_id = 'angela') AS users, (SELECT COUNT(*) FROM identities WHERE athlete_id = 'angela') AS ids`)[0][0];
  const fans = [];            // { label, id, token } — every fan this run creates; token follows switches
  const athTokens = [ath];
  async function newFan(label) {
    const r = await api('POST', '/auth/fan', { body: { code: 'REVIEW', name: NAME(label) } });
    const f = { label, id: r.data?.user?.id, token: r.data?.token };
    if (!f.token) throw new Error('fan sign-in failed');
    fans.push(f);
    return f;
  }

  try {
    console.log('-- config; in-process: switched off, limits, endpoint overrides, logs');
    check('config.signIn: email on, the Google client id', cfg.signIn.email === true && /\.apps\.googleusercontent\.com$/.test(CLIENT), cfg.signIn);
    const local = async (env, method, p, body) => {
      const r = await handleV1(new Request('http://in-process/v1' + p, {
        method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
      }), env, { waitUntil() {} });
      return { status: r.status, data: await r.json() };
    };
    check('nothing configured → signIn { email: false, google: null }',
      JSON.stringify((await local({}, 'GET', '/config')).data.signIn) === '{"email":false,"google":null}');
    check('a Resend key without EMAIL_FROM (or the reverse) is still off',
      (await local({ RESEND_API_KEY: 'x' }, 'GET', '/config')).data.signIn.email === false
      && (await local({ EMAIL_FROM: 'x' }, 'GET', '/config')).data.signIn.email === false);
    check('start when email is off → 503', isErr(await local({}, 'POST', '/auth/email/start', { email: addr('off') }), 503, EMAIL_OFF));
    check('verify when email is off → 503', isErr(await local({}, 'POST', '/auth/email/verify', { email: addr('off'), code: '123456' }), 503, EMAIL_OFF));
    check('Google when it is off → 503', isErr(await local({}, 'POST', '/auth/google', { credential: 'x.y.z' }), 503, G_OFF));
    check('URL overrides count only on loopback', loopbackUrl('http://127.0.0.1:8791') === 'http://127.0.0.1:8791'
      && loopbackUrl('http://localhost:9/x/') === 'http://localhost:9/x' && loopbackUrl('http://[::1]:9') === 'http://[::1]:9'
      && ['https://api.resend.com', 'http://127.0.0.1.evil.example', 'http://localhost@evil.example', 'http://u:p@127.0.0.1', 'ftp://127.0.0.1', '', undefined]
        .every(v => loopbackUrl(v) === null));
    check('addresses are trimmed and lowercased, junk refused', normEmail('  Jane.Doe+x@Example.COM ') === 'jane.doe+x@example.com'
      && [undefined, 42, '', 'a@b', 'a b@c.de', 'no-at.example', `${'x'.repeat(250)}@a.io`].every(v => normEmail(v) === null));
    const draws = Array.from({ length: 2000 }, newCode);
    check('codes are 6 digits, zero-padded', draws.every(c => /^\d{6}$/.test(c)) && new Set(draws).size > 1990);
    await inProcessChecks();

    console.log('-- start: validation, unknown addresses, a bad token');
    for (const [what, body] of [['no email', {}], ['empty', { email: '' }], ['not an address', { email: 'not-an-email' }],
      ['a number', { email: 42 }], ['no dot in the domain', { email: 'a@b' }], ['over 254 chars', { email: `${'x'.repeat(250)}@${DOMAIN}` }]]) {
      check(`start, ${what} → 400`, isErr(await api('POST', '/auth/email/start', { body }), 400, BAD_EMAIL));
    }
    const nobody = addr('nobody');
    check('start for an address no account uses → 404', isErr(await start(nobody), 404, NO_EMAIL));
    check('…and nothing was sent', (await mailTo(nobody)).count === 0);
    for (const [route, body] of [['/auth/email/start', { email: nobody }], ['/auth/email/verify', { email: nobody, code: '123456' }],
      ['/auth/google', { credential: 'x.y.z' }]]) {
      check(`${route} with an invalid token → 401 (signed out is fine, a bad token isn't)`, isErr(await api('POST', route, { token: 'st_nope', body }), 401));
    }

    console.log('-- link an address to a fan by code');
    const f1 = await newFan('F1');
    await api('PATCH', '/me', { token: f1.token, body: { interests: ['Mindset', 'Stories'] } });
    check('GET /me: identities, none yet', JSON.stringify((await api('GET', '/me', { token: f1.token })).data.identities) === '[]');
    const E1 = addr('e1');
    const s1 = await sendCode(E1, f1.token);
    check('start (signed in) → 202 { sent, expiresIn: 600 }', s1.r.status === 202 && s1.r.data.sent === true && s1.r.data.expiresIn === 600, s1.r.data);
    const m1 = s1.mail;
    check('the email: to the address, the code in the subject and the text', s1.code && JSON.stringify(m1.to) === JSON.stringify([E1])
      && /@/.test(m1.from) && m1.subject === `Your Strive code: ${s1.code}` && m1.text === mailText(s1.code), m1);
    check('the email: minimal HTML with the code, no links or images', typeof m1.html === 'string' && m1.html.includes(s1.code)
      && !/https?:|<img|<a\b/i.test(m1.html), m1.html);
    check('wrong code → 400', isErr(await verify(E1, wrongOf(s1.code), f1.token), 400, WRONG));
    const l1 = await verify(E1, `${s1.code.slice(0, 3)} ${s1.code.slice(3)}`, f1.token);
    check('right code (spaces ignored) → 200 linked', l1.status === 200 && l1.data.linked === true && l1.data.user?.id === f1.id
      && !('token' in l1.data) && l1.data.identities?.length === 1 && idOf(l1, 'email', E1)
      && typeof idOf(l1, 'email', E1).id === 'string' && typeof idOf(l1, 'email', E1).createdAt === 'number', l1.data);
    check('the same code again → 410 (used)', isErr(await verify(E1, s1.code, f1.token), 410, GONE));
    const me1 = (await api('GET', '/me', { token: f1.token })).data;
    check('GET /me lists it: { id, provider, email, createdAt }', me1.identities?.length === 1
      && JSON.stringify(Object.keys(me1.identities[0])) === '["id","provider","email","createdAt"]' && me1.identities[0].email === E1, me1.identities);

    console.log('-- sign back in with it (no token)');
    const s2 = await sendCode(E1);
    check('start (signed out) for a linked address → 202', s2.r.status === 202 && !!s2.code, s2.r.data);
    const in1 = await verify(`  ${E1.toUpperCase()} `, s2.code);
    check('verify → 200 { token, user, athlete, identities }: the SAME account', in1.status === 200 && typeof in1.data.token === 'string'
      && in1.data.user?.id === f1.id && in1.data.user.role === 'fan' && in1.data.user.name === NAME('F1')
      && in1.data.user.interests.join() === 'Mindset,Stories' && in1.data.athlete?.id === 'angela-review' && in1.data.identities?.length === 1, in1.data);
    check('the new token works', (await api('GET', '/me', { token: in1.data.token })).data?.user?.id === f1.id);

    console.log('-- five wrong tries burn a code');
    const s3 = await sendCode(E1);
    let tries = [];
    for (let i = 1; i <= 4; i++) tries.push(await verify(E1, wrongOf(s3.code), undefined));
    check('wrong tries 1–4 → 400', tries.every(r => isErr(r, 400, WRONG)), tries.map(r => r.status));
    check('the 5th wrong try → 429', isErr(await verify(E1, wrongOf(s3.code)), 429, TRIES));
    check('…and now even the right code → 429', isErr(await verify(E1, s3.code), 429, TRIES));

    console.log('-- per address: 3 codes per 15 minutes');
    check('a 4th code within 15 minutes → 429', isErr(await start(E1), 429, SENT));
    check('…signed in too (the limit is per address, either mode)', isErr(await start(E1, f1.token), 429, SENT));
    check('…and no 4th email went out', (await mailTo(E1)).count === 3);

    console.log('-- codes are bound to their mode and user; expired and replaced codes');
    const f2 = await newFan('F2');
    const E2 = addr('e2');
    const c2 = (await sendCode(E2, f2.token)).code;
    check('a link code used signed out → 410', isErr(await verify(E2, c2), 410, GONE));
    check('a link code used by another user → 410', isErr(await verify(E2, c2, f1.token), 410, GONE));
    check('…by its own user → linked', (await verify(E2, c2, f2.token)).data?.linked === true);
    const c2s = (await sendCode(E2)).code;
    check('a sign-in code used to link → 410', isErr(await verify(E2, c2s, f2.token), 410, GONE));
    d1(`UPDATE login_codes SET expires_at = 1 WHERE email = '${E2}' AND used_at IS NULL`);
    check('an expired code → 410', isErr(await verify(E2, c2s), 410, GONE));
    const E3 = addr('e3');
    const c3a = (await sendCode(E3, f2.token)).code;
    const c3b = (await sendCode(E3, f2.token)).code;
    if (c3a !== c3b) check('a replaced (older) code → 400, only the newest works', isErr(await verify(E3, c3a, f2.token), 400, WRONG));
    check('the newest code → linked', (await verify(E3, c3b, f2.token)).data?.identities?.length === 2);
    const EF = addr('resend-fail');
    check('the provider refuses the email → 502', isErr(await start(EF, f2.token), 502, SEND_FAILED));
    check('…and it leaves no usable code behind', isErr(await verify(EF, '123456', f2.token), 410, GONE)
      && count(`SELECT COUNT(*) AS n FROM login_codes WHERE email = '${EF}'`) === 0);

    console.log('-- Google: link, sign in');
    const G1 = 'g1-' + RUN, E4 = addr('g1');
    const g1 = await gtoken({ sub: G1, email: E4.toUpperCase(), email_verified: true });
    const gl = await google(g1, f1.token);
    check('link a Google account → 200 linked, its verified address stored', gl.status === 200 && gl.data.linked === true
      && gl.data.identities?.length === 2 && idOf(gl, 'google', E4) && !('token' in gl.data), gl.data);
    const gl2 = await google(g1, f1.token);
    check('link it again → still linked, nothing added', gl2.data?.linked === true && gl2.data.identities.length === 2, gl2.data);
    const gin = await google(await gtoken({ sub: G1, email: E4 }));
    check('sign in with it (no token) → the same account', gin.status === 200 && gin.data.user?.id === f1.id && typeof gin.data.token === 'string'
      && gin.data.athlete?.id === 'angela-review' && gin.data.identities?.length === 2, gin.data);
    check('a Google account nobody linked → 404', isErr(await google(await gtoken({ sub: 'nobody-' + RUN })), 404, NO_GOOGLE));
    const now = Math.floor(Date.now() / 1000);
    check('exp 30 s ago is inside the 60 s skew → accepted', (await google(await gtoken({ sub: G1, email: E4, iat: now - 600, exp: now - 30 }))).data?.user?.id === f1.id);

    console.log('-- Google tokens that must fail → 401');
    const [h, p, sig] = g1.split('.');
    const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
    const bad = [
      ['wrong audience', await gtoken({ sub: G1, aud: 'someone-else.apps.googleusercontent.com' })],
      ['expired', await gtoken({ sub: G1, iat: now - 7200, exp: now - 3600 })],
      ['expired just past the skew', await gtoken({ sub: G1, iat: now - 600, exp: now - 120 })],
      ['signed by another key', await gtoken({ sub: G1, otherKey: true })],
      ['wrong issuer', await gtoken({ sub: G1, iss: 'https://accounts.example.com' })],
      ['issued in the future', await gtoken({ sub: G1, iat: now + 3600, exp: now + 7200 })],
      ['no sub', await gtoken({ sub: G1, omit: ['sub'] })],
      ['no exp', await gtoken({ sub: G1, omit: ['exp'] })],
      ['no iat', await gtoken({ sub: G1, omit: ['iat'] })],
      ['an unknown key id', await gtoken({ sub: G1, header: { kid: 'not-a-google-key' } })],
      ['no key id', await gtoken({ sub: G1, header: { kid: null } })],
      ['alg HS256', await gtoken({ sub: G1, header: { alg: 'HS256' } })],
      ['alg none, unsigned', `${b64({ alg: 'none', typ: 'JWT' })}.${p}.`],
      ['a tampered payload', `${h}.${b64({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: 'tampered-' + RUN })}.${sig}`],
      ['not a JWT', 'not-a-jwt'],
      ['bad base64', `${h}.${p}.a`],
    ];
    for (const [what, cred] of bad) check(`${what} → 401`, isErr(await google(cred), 401, G_FAILED));
    check('a bad Google token while signed in → 401 too (same message: not a session problem)', isErr(await google(bad[0][1], f1.token), 401, G_FAILED)
      && (await api('GET', '/me', { token: f1.token })).status === 200);
    check('no credential → 400', isErr(await api('POST', '/auth/google', { body: {} }), 400, G_FAILED)
      && isErr(await api('POST', '/auth/google', { body: { credential: 42 } }), 400, G_FAILED));

    console.log('-- an email code reaches a Google identity\'s verified address');
    const s4 = await sendCode(E4);
    check('start (signed out) for a Google account\'s verified address → 202', s4.r.status === 202 && !!s4.code, s4.r.data);
    const in4 = await verify(E4, s4.code);
    check('verify → the account with that Google identity', in4.status === 200 && in4.data.user?.id === f1.id && in4.data.identities?.length === 2, in4.data);

    console.log('-- an unverified Google address is never stored or matched; the stored one follows Google');
    const G2 = 'g2-' + RUN, E5 = addr('g2');
    const gu = await google(await gtoken({ sub: G2, email: E5, email_verified: false }), f2.token);
    check('link with email_verified false → linked, email null', gu.data?.linked === true && gu.data.identities.length === 3
      && gu.data.identities.some(i => i.provider === 'google' && i.email === null), gu.data);
    check('…so a code for that address → 404', isErr(await start(E5), 404, NO_EMAIL));
    const G3 = 'g3-' + RUN, E5b = addr('g3'), E5c = addr('g3-new');
    const gs = await google(await gtoken({ sub: G3, email: E5b, email_verified: 'true' }), f2.token);
    check('email_verified "true" (string) counts as verified', !!idOf(gs, 'google', E5b), gs.data);
    await google(await gtoken({ sub: G3, email: E5c }));
    const g3now = (await api('GET', '/me', { token: f2.token })).data.identities.find(i => i.provider === 'google' && i.email !== null);
    check('signing in with a changed Google address updates the stored one', g3now?.email === E5c, g3now);
    await google(await gtoken({ sub: G3, email: E5c, email_verified: false }));
    const f2ids = (await api('GET', '/me', { token: f2.token })).data.identities;
    check('…and an address Google no longer verifies is cleared', f2ids.filter(i => i.provider === 'google').every(i => i.email === null), f2ids);

    console.log('-- one room, one address, two accounts: the address\'s own email identity wins');
    const f7 = await newFan('F7'), f8 = await newFan('F8');
    const E9 = addr('shared');
    const c9 = (await sendCode(E9, f7.token)).code;
    check('fan A links the address', (await verify(E9, c9, f7.token)).data?.linked === true);
    check('fan B links a Google account with that verified address (Google links by account, not address)',
      (await google(await gtoken({ sub: 'g9-' + RUN, email: E9 }), f8.token)).data?.linked === true);
    const c9s = (await sendCode(E9)).code;
    check('an email code for the address → fan A (its email identity), not the newer fan B', (await verify(E9, c9s)).data?.user?.id === f7.id);

    console.log('-- the empty-account switch');
    const f3 = await newFan('F3');
    const sw = await google(await gtoken({ sub: G1, email: E4 }), f3.token);
    check('an empty fan links a Google account another fan has → 200 switched into that account', sw.status === 200 && sw.data.switched === true
      && typeof sw.data.token === 'string' && sw.data.user?.id === f1.id && sw.data.user.name === NAME('F1') && sw.data.athlete?.id === 'angela-review'
      && sw.data.identities?.length === 2, sw.data);
    check('the empty account is gone (its token → 401)', (await api('GET', '/me', { token: f3.token })).status === 401
      && count(`SELECT COUNT(*) AS n FROM users WHERE id = '${f3.id}'`) === 0);
    check('the new token is the other account', (await api('GET', '/me', { token: sw.data.token })).data?.user?.id === f1.id);
    f3.token = null;
    const f4 = await newFan('F4');
    const c4 = (await sendCode(E4, f4.token)).code;
    const sw2 = await verify(E4, c4, f4.token);
    check('an empty fan saves their seat with the address of that Google account → switched', sw2.status === 200 && sw2.data.switched === true
      && sw2.data.user?.id === f1.id && typeof sw2.data.token === 'string', sw2.data);
    check('…and the address is now linked to that account in its own right', sw2.data.identities?.length === 3 && !!idOf(sw2, 'email', E4), sw2.data);
    check('…and the empty account is gone', (await api('GET', '/me', { token: f4.token })).status === 401);
    f4.token = null;

    console.log('-- 409 once the fan has activity, and always for the athlete');
    const f5 = await newFan('F5');
    const asked = await api('POST', '/questions', { token: f5.token, body: { text: 'Should I bet on the game tonight?' } });
    check('(fan 5 asks a question)', asked.status === 201, asked.data);
    check('…then links a Google account another fan has → 409', isErr(await google(await gtoken({ sub: G1, email: E4 }), f5.token), 409, TAKEN_GOOGLE));
    const c5 = (await sendCode(E2, f5.token)).code;
    check('…or an address another fan has → 409', isErr(await verify(E2, c5, f5.token), 409, TAKEN_EMAIL));
    check('…and nothing was switched or deleted', (await api('GET', '/me', { token: f5.token })).data?.identities?.length === 0);
    const f6 = await newFan('F6');
    const drop = (await api('GET', '/drops', { token: f6.token })).data.drops[0];
    await api('POST', `/drops/${drop.id}/listen`, { token: f6.token });
    check('a fan who only listened to a drop has activity too → 409', isErr(await google(await gtoken({ sub: G1, email: E4 }), f6.token), 409, TAKEN_GOOGLE));
    check('the athlete never switches → 409', isErr(await google(await gtoken({ sub: G1, email: E4 }), ath), 409, TAKEN_GOOGLE)
      && (await api('GET', '/studio/today', { token: ath })).status === 200);

    console.log('-- the athlete links an address in the studio, then signs in with it');
    const E6 = addr('athlete');
    const c6 = (await sendCode(E6, ath)).code;
    const al = await verify(E6, c6, ath);
    check('studio-key session links an address → linked, role athlete', al.data?.linked === true && al.data.user.role === 'athlete'
      && !!idOf(al, 'email', E6), al.data);
    const c6s = (await sendCode(E6)).code;
    const ain = await verify(E6, c6s);
    if (ain.data?.token) athTokens.push(ain.data.token);
    check('sign in with it → role athlete, her studio account', ain.status === 200 && ain.data.user?.role === 'athlete'
      && ain.data.user.id === 'u_athlete_angela-review' && ain.data.athlete?.id === 'angela-review', ain.data);
    check('…and that token opens the studio', (await api('GET', '/studio/today', { token: ain.data.token })).status === 200);
    const del6 = await api('DELETE', `/me/identities/${idOf(al, 'email', E6)?.id}`, { token: ath });
    check('the athlete removes it again → 200 { identities }', del6.status === 200 && JSON.stringify(del6.data.identities.map(i => i.id)) === JSON.stringify(athleteIdsBefore), del6.data);
    check('…so the address no longer signs in', isErr(await start(E6), 404, NO_EMAIL));

    console.log('-- DELETE /v1/me/identities/:id');
    const mine = (await api('GET', '/me', { token: f2.token })).data.identities;
    const gone = mine.find(i => i.provider === 'google');
    const di = await api('DELETE', `/me/identities/${gone.id}`, { token: f2.token });
    check('remove one → 200 with what is left', di.status === 200 && di.data.identities.length === mine.length - 1
      && !di.data.identities.some(i => i.id === gone.id), di.data);
    check('remove it again → 404', isErr(await api('DELETE', `/me/identities/${gone.id}`, { token: f2.token }), 404));
    check('remove another user\'s → 404', isErr(await api('DELETE', `/me/identities/${idOf(sw2, 'email', E4)?.id}`, { token: f2.token }), 404)
      && (await api('GET', '/me', { token: sw2.data.token })).data.identities.length === 3);
    check('signed out → 401', isErr(await api('DELETE', `/me/identities/${gone.id}`), 401));

    console.log('-- five sign-in methods at most');
    const f9 = await newFan('F9');
    const added = [];
    for (let i = 1; i <= 5; i++) added.push(await google(await gtoken({ sub: `g6-${i}-${RUN}`, email: addr('g6-' + i) }), f9.token));
    check('five → all linked', added.every(r => r.data?.linked === true) && added[4].data.identities.length === 5);
    check('a sixth → 400', isErr(await google(await gtoken({ sub: `g6-6-${RUN}` }), f9.token), 400, MAX));
    const E7 = addr('sixth');
    check('a code for a sixth (an address) → 400 before any email is sent', isErr(await start(E7, f9.token), 400, MAX) && (await mailTo(E7)).count === 0);
    check('one it already has is still fine at five (idempotent)', (await google(await gtoken({ sub: `g6-1-${RUN}` }), f9.token)).data?.linked === true);

    console.log('-- DELETE /v1/me (fan) takes its identities and login codes with it');
    const f1codes = `SELECT COUNT(*) AS n FROM login_codes WHERE email IN ('${E1}', '${E4}')`;
    check('(fan 1 has codes on file for its addresses)', count(f1codes) > 0);
    f1.token = sw2.data.token;
    check('delete fan 1', (await api('DELETE', '/me', { token: f1.token })).data?.ok === true);
    check('its identities are gone', count(`SELECT COUNT(*) AS n FROM identities WHERE user_id = '${f1.id}'`) === 0);
    check('its addresses\' login codes are gone', count(f1codes) === 0);
    check('its address no longer signs in', isErr(await start(E1), 404, NO_EMAIL));
    check('nor its Google account', isErr(await google(await gtoken({ sub: G1, email: E4 })), 404, NO_GOOGLE));
    f1.token = null;
  } finally {
    for (const f of fans) {
      if (f.token) check(`cleanup: delete fan ${f.label}`, (await api('DELETE', '/me', { token: f.token })).data?.ok === true);
    }
    // the athlete keeps identities across DELETE /v1/me, so anything this run linked to her goes by id
    const athIds = (await api('GET', '/me', { token: ath })).data?.identities || [];
    for (const i of athIds.filter(x => !athleteIdsBefore.includes(x.id))) await api('DELETE', `/me/identities/${i.id}`, { token: ath });
    const after = await tenantSnapshot(ath);
    for (const t of athTokens) await api('POST', '/auth/signout', { token: t });
    // codes for addresses no account holds any more (the athlete's, links that ended in 409) wait for the
    // daily cron in production; here they go now
    const left = count(`SELECT COUNT(*) AS n FROM login_codes WHERE email LIKE ${runLike}`);
    d1(`DELETE FROM login_codes WHERE email LIKE ${runLike}`);
    console.log(`        (${left} login code row(s) for this run's addresses had no account left; removed)`);
    const ids = fans.map(f => `'${f.id}'`).join(',') || "''";
    const rest = d1(`SELECT (SELECT COUNT(*) FROM users WHERE id IN (${ids}) OR name LIKE '%${RUN}') AS users,
      (SELECT COUNT(*) FROM identities WHERE user_id IN (${ids}) OR subject LIKE '%${RUN}' OR email LIKE ${runLike}) AS identities,
      (SELECT COUNT(*) FROM login_codes WHERE email LIKE ${runLike}) AS codes,
      (SELECT COUNT(*) FROM tokens WHERE user_id IN (${ids})) AS tokens,
      (SELECT COUNT(*) FROM questions WHERE user_id IN (${ids})) AS questions,
      (SELECT COUNT(*) FROM listens WHERE user_id IN (${ids})) AS listens`)[0][0];
    check('cleanup: no user, identity, login code, token, question or listen from this run is left', Object.values(rest).every(n => n === 0), rest);
    check('the review room is left exactly as it was found', JSON.stringify(after) === JSON.stringify(before), { before, after });
    check('the athlete has exactly the sign-in methods she started with', JSON.stringify(athIds.filter(x => athleteIdsBefore.includes(x.id)).map(x => x.id))
      === JSON.stringify(athleteIdsBefore));
    const angelaAfter = d1(`SELECT (SELECT COUNT(*) FROM users WHERE athlete_id = 'angela') AS users, (SELECT COUNT(*) FROM identities WHERE athlete_id = 'angela') AS ids`)[0][0];
    check('the angela room is untouched', JSON.stringify(angelaAfter) === JSON.stringify(angelaBefore), { angelaBefore, angelaAfter });
  }

  console.log(`\n${passed} passed, ${failed.length} failed`);
  if (failed.length) console.log('failed: ' + failed.join(' · '));
  process.exit(failed.length ? 1 : 0);
}

// what fans and the studio can see of the room (as in smoke.mjs), plus the coach list
async function tenantSnapshot(athlete) {
  const get = async p => (await api('GET', p, { token: athlete })).data;
  const [queue, drops, settings, prompts, bio, coach] = await Promise.all(
    ['/studio/queue', '/studio/drops', '/studio/settings', '/studio/prompts', '/studio/bio', '/studio/coach'].map(get));
  const ids = list => list.map(d => `${d.id}${d.pinned ? '*' : ''}:${d.listens}`);
  return {
    queue: queue.questions.map(q => q.id), drafts: ids(drops.drafts), queued: ids(drops.queued), published: ids(drops.published),
    settings, prompts: prompts.prompts.map(p => p.id), coverage: prompts.coverage, bio: [bio.status, bio.audioKey],
    coach: coach.answers.map(a => a.id),
  };
}

main().catch(e => { console.error(e); process.exit(1); });

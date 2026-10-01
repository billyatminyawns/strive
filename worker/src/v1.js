/* STRIVE API v1 — backend for the native iOS app and the web app. Contract: docs/API-v1.md (v1.1 adds
   CORS and the Coach Angela brain). D1 (binding DB) holds every row, keyed by athlete_id so tenants
   never mix; KV (binding AUDIO) holds voice clips (see voice.js). Fan routes only ever read approved
   content: published drops, answered/instant replies and an approved bio — plus, when Angela has
   switched autopilot on, Coach Angela's grounded answers (brain.js), which she can keep or retract.
   New questions go to the brain (think) in the background; draft.js now only serves revise. */

import { renderVoice, VoiceError } from './voice.js';
import { isSensitive, matchKb, byRelevance, coverage } from './match.js';
import { draftReply } from './draft.js';
import { pushConfigured, pushToUser, pushToFans } from './push.js';
import { think, isCrisis, CRISIS_TEXT, DECLINE_FALLBACK } from './brain.js';

const HOUR = 3600e3, DAY = 24 * HOUR;
const QUESTIONS_PER_DAY = 10;
const AUTH_PER_HOUR = 30;       // env AUTH_ATTEMPTS_PER_HOUR overrides (local test runs sign in a lot)
const DRAFT_STALE = 2 * 60e3;   // background drafts ride ctx.waitUntil, which can be cut off after ~30 s
const PUBLISH_HOUR_UTC = 14;    // must match the cron in wrangler.toml
const PUBLISH_GAP = 20 * HOUR;
const MAX_STORY_AUDIO = 20 * 1024 * 1024;

// browsers (the web app) — ALLOWED_ORIGINS plus local dev; requests without an Origin are untouched
const DEV_ORIGINS = ['http://localhost:8642', 'http://127.0.0.1:8642'];
const PREFLIGHT = {
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '86400',
};

const BRAIN_FAILED = "Coach Angela couldn't get to this one — answer it yourself.";
const RETRACTED_REASON = 'You retracted this autopilot answer — rewrite it or approve it.';

const FREE_PROMPT = {
  id: 'free', title: 'Anything on your mind', src: 'YOUR CALL',
  hint: 'No prompt, no agenda — a thought from today, an old memory, whatever you want on record.',
};

/* ---------- plumbing ---------- */

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const stmt = (env, sql, ...binds) => env.DB.prepare(sql).bind(...binds);
const one = (env, sql, ...binds) => stmt(env, sql, ...binds).first();
const all = async (env, sql, ...binds) => (await stmt(env, sql, ...binds).all()).results;
const run = (env, sql, ...binds) => stmt(env, sql, ...binds).run();

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const digest = s => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
const sha256 = async s => hex(await digest(s));
const newId = prefix => prefix + '_' + hex(crypto.getRandomValues(new Uint8Array(9)));
const newToken = () => 'st_' + btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const parseList = s => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

async function body(c) {
  if (c.body) return c.body;
  const raw = await c.request.text();
  let v = {};
  if (raw.trim()) {
    try { v = JSON.parse(raw); } catch { fail(400, "The request body isn't valid JSON."); }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(400, 'The request body must be a JSON object.');
  return (c.body = v);
}

function str(v, field, max, { collapse = true } = {}) {
  if (typeof v !== 'string') fail(400, `${field} is required.`);
  const s = collapse ? v.replace(/\s+/g, ' ').trim() : v.trim();
  if (!s || s.length > max) fail(400, `${field} must be 1–${max} characters.`);
  return s;
}

function bool(v, field) {
  if (typeof v !== 'boolean') fail(400, `${field} must be true or false.`);
  return v;
}

/* ---------- serializers ---------- */

const athleteOut = a => ({
  id: a.id, name: a.name, firstName: a.first_name, coachName: a.coach_name, headline: a.headline, sport: a.sport,
  photoURL: a.photo_url, heroURL: a.hero_url, badges: parseList(a.badges),
  bio: a.bio_status === 'approved' ? { text: a.bio_text, audioKey: a.bio_audio_key ?? null, duration: a.bio_duration ?? null } : null,
  paused: !!a.paused,
});

const userOut = u => ({
  id: u.id, role: u.role, name: u.name ?? null, interests: parseList(u.interests), athleteId: u.athlete_id, createdAt: u.created_at,
});

const dropOut = d => ({
  id: d.id, title: d.title, script: d.script, status: d.status, source: d.source,
  audioKey: d.audio_key ?? null, duration: d.duration ?? null, publishedAt: d.published_at ?? null,
  queuePos: d.status === 'queued' ? d.queue_rank ?? null : null,
  listens: d.listens ?? 0, pinned: !!d.pinned, listened: !!d.listened,
});

function noteFor(status, a) {
  const name = a.first_name;
  if (status === 'pending') {
    return a.autopilot_live ? `With ${name} — her AI Coach answers what her public record covers; she answers the rest herself.`
      : `With ${name} — she reviews every answer before it's sent.`;
  }
  if (status === 'declined') return `${name} passed on this one — she answers what she can speak to best.`;
  if (status === 'guarded') return `Strive doesn't send medical, betting or legal questions to ${name}. `
    + 'For health, legal or money decisions, please talk to a qualified professional.';
  return null;
}

// a stored note (the crisis message, Coach Angela's decline, a retraction) replaces the status default
const noteOut = (q, a) => (q.note && (q.status === 'guarded' || q.status === 'pending') ? q.note : noteFor(q.status, a));

const answeredBy = q => (q.status === 'instant' ? 'library' : q.status === 'answered' ? q.answered_by || 'angela' : null);

const questionOut = (q, a) => {
  const by = answeredBy(q);
  return {
    id: q.id, text: q.text, status: q.status, answer: q.answer ?? null, audioKey: q.audio_key ?? null, duration: q.duration ?? null,
    note: noteOut(q, a), createdAt: q.created_at, answeredAt: q.answered_at ?? null, saved: !!q.saved,
    answeredBy: by, sources: by === 'coach' ? parseList(q.sources) : [],
  };
};

const studioQuestionOut = q => ({
  id: q.id, text: q.text, fanName: q.kind === 'fan' ? q.fan_name ?? null : null, kind: q.kind,
  draft: q.draft || '', draftSource: q.draft ? q.draft_source : 'none',
  drafting: !!q.drafting && Date.now() - (q.drafting_at || 0) < DRAFT_STALE, createdAt: q.created_at,
  sources: parseList(q.sources), confidence: q.confidence ?? null, reason: q.reason ?? null,
});

// audioKey/duration go beyond the contract's list so she can hear exactly what went out in her voice
const coachAnswerOut = q => ({
  id: q.id, text: q.text, answer: q.answer, sources: parseList(q.sources), confidence: q.confidence ?? null,
  reviewed: !!q.reviewed, answeredAt: q.answered_at, fanName: q.fan_name ?? null,
  audioKey: q.audio_key ?? null, duration: q.duration ?? null,
});

const notificationOut = (n, readAt) => ({
  id: n.id, text: n.text, sub: n.sub, link: n.link, createdAt: n.created_at, read: n.created_at <= readAt,
});

const bioOut = a => ({ text: a.bio_text, status: a.bio_status, audioKey: a.bio_audio_key ?? null, duration: a.bio_duration ?? null });
const settingsOut = a => ({ paused: !!a.paused, guardTopics: !!a.guard_topics, guardDecline: !!a.guard_decline, autopilot: !!a.autopilot });
const storyOut = s => ({
  id: s.id, promptId: s.prompt_id ?? null, title: s.title, transcript: s.transcript, duration: s.duration ?? null, createdAt: s.created_at,
});

/* ---------- shared queries ---------- */

// queuePos is the live rank; queue_pos itself only grows, so ranks never need rewriting
const DROP_COLS = `d.*, (SELECT COUNT(*) FROM listens l WHERE l.drop_id = d.id) AS listens,
  CASE WHEN d.status = 'queued' THEN (SELECT COUNT(*) FROM drops q WHERE q.athlete_id = d.athlete_id AND q.status = 'queued'
    AND (q.queue_pos < d.queue_pos OR (q.queue_pos = d.queue_pos AND q.id <= d.id))) END AS queue_rank`;

const dropById = (env, athleteId, id) => one(env, `SELECT ${DROP_COLS} FROM drops d WHERE d.athlete_id = ? AND d.id = ?`, athleteId, id);

// personal rows, plus broadcasts to the fan's athlete sent since the fan joined
const NOTIF_SCOPE = `(n.user_id = ?1 OR (?4 = 'fan' AND n.user_id IS NULL AND n.athlete_id = ?2 AND n.created_at >= ?3))`;
const scopeBinds = u => [u.id, u.athlete_id, u.created_at, u.role];
const unreadStmt = (env, u) => stmt(env, `SELECT COUNT(*) AS n FROM notifications n WHERE ${NOTIF_SCOPE} AND n.created_at > ?5`,
  ...scopeBinds(u), u.notifs_read_at);

const notifyStmt = (env, athleteId, userId, text, sub, link, now) => stmt(env,
  'INSERT INTO notifications (id, athlete_id, user_id, text, sub, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  newId('n'), athleteId, userId, text, sub, link, now);

function publishStmts(env, a, d, now) {
  const dur = d.duration || 0;
  const length = dur >= 90 ? `${Math.round(dur / 60)} minutes` : `${Math.max(1, Math.round(dur))} seconds`;
  return [
    stmt(env, `UPDATE drops SET status = 'published', published_at = ?, queue_pos = NULL WHERE id = ?`, now, d.id),
    notifyStmt(env, a.id, null, `New drop: ${d.title}`, `${length} from ${a.first_name} — tap to listen.`, 'drop:' + d.id, now),
  ];
}

function nextPublishAt(lastPublishedAt, now) {
  const day = new Date(now);
  let slot = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), PUBLISH_HOUR_UTC);
  if (slot <= now) slot += DAY;
  while (lastPublishedAt && slot - lastPublishedAt < PUBLISH_GAP) slot += DAY;
  return slot;
}

// her newest library answers; byRelevance picks the ones a draft or the brain gets to see
const kbGrounding = (env, athleteId) => stmt(env, 'SELECT question, answer FROM kb WHERE athlete_id = ? ORDER BY created_at DESC LIMIT 300', athleteId);

async function loadGrounding(env, athleteId, question) {
  const [kb, stories] = await env.DB.batch([
    kbGrounding(env, athleteId),
    stmt(env, `SELECT title, transcript FROM stories WHERE athlete_id = ? AND transcript != '' ORDER BY created_at DESC LIMIT 5`, athleteId),
  ]);
  return { answers: byRelevance(question, kb.results).slice(0, 8), stories: stories.results };
}

/* Coach Angela's brain on a new pending fan question (rides ctx.waitUntil). Every write below is
   guarded by status = 'pending' AND drafting = 1, so whatever Angela did meanwhile (approve, decline,
   revise) wins — and drafting clears on every outcome: answer, review, decline, refusal or error. */
async function backgroundBrain(env, a, q) {
  let out = null;
  try {
    const [kb, thread] = await env.DB.batch([
      kbGrounding(env, a.id),
      // the fan's thread so far, newest first; guardrail and crisis exchanges stay out of it
      stmt(env, `SELECT text, status, answer FROM questions WHERE user_id = ? AND id != ? AND status != 'guarded'
        ORDER BY created_at DESC, id DESC LIMIT 6`, q.user_id, q.id),
    ]);
    const history = thread.results.reverse().flatMap(p => [
      { role: 'fan', text: p.text },
      ...(p.answer && (p.status === 'answered' || p.status === 'instant') ? [{ role: 'angela', text: p.answer }] : []),
    ]).slice(-6);
    const approved = byRelevance(q.text, kb.results).slice(0, 10).map(k => ({ q: k.question, a: k.answer }));
    out = await think(env, { question: q.text, history, approved, autopilot: !!a.autopilot });
  } catch (e) {
    console.error('brain failed', q.id, e && e.status, e && e.message);
  }
  try {
    await settleBrain(env, a, q, out);
  } catch (e) {
    console.error('brain result not saved', q.id, e && e.stack || e);
  }
}

async function settleBrain(env, a, q, out) {
  const meta = [JSON.stringify(out && out.sources || []), out ? out.confidence ?? null : null];
  let reason = out ? out.reason || null : BRAIN_FAILED;
  if (out && (out.route === 'decline' || out.route === 'crisis')) {
    // never voiced: the fan sees the text as the guarded note
    await run(env, `UPDATE questions SET status = 'guarded', note = ?, sources = ?, confidence = ?, reason = ?, drafting = 0
      WHERE id = ? AND status = 'pending' AND drafting = 1`,
    out.route === 'crisis' ? CRISIS_TEXT : out.reply || DECLINE_FALLBACK, ...meta, reason, q.id);
    return;
  }
  if (out && out.route === 'answer' && out.auto && out.reply) {
    const sent = await sendCoachAnswer(env, a, q, out, meta);
    if (sent === true) return;
    reason = [reason, sent].filter(Boolean).join(' · ');   // why it waits for her after all
  }
  // review: the brain's reply becomes her draft (empty when it passed or failed — she writes it)
  await run(env, `UPDATE questions SET draft = ?, draft_source = ?, sources = ?, confidence = ?, reason = ?, drafting = 0
    WHERE id = ? AND status = 'pending' AND drafting = 1`,
  out && out.reply || '', out && out.reply ? 'coach' : 'none', ...meta, reason, q.id);
}

/* Autopilot: voice the reply, mark it answered by Coach Angela, tell the fan. → true once it went
   out, otherwise why it didn't (the caller files it for her review instead). */
async function sendCoachAnswer(env, a, q, out, [sources, confidence]) {
  let voice;
  try {
    voice = await renderVoice(env, out.reply);
  } catch (e) {
    console.error('coach voice failed', q.id, e && e.status, e && e.message);
    return 'Voice render failed';
  }
  const now = Date.now();
  const title = `${a.coach_name} answered`;
  const [res] = await env.DB.batch([
    // her switch is read again here: turning autopilot off also stops answers still in flight
    stmt(env, `UPDATE questions SET status = 'answered', answer = ?, audio_key = ?, duration = ?, answered_at = ?, answered_by = 'coach',
        sources = ?, confidence = ?, reason = ?, reviewed = 0, note = NULL, drafting = 0
      WHERE id = ? AND status = 'pending' AND drafting = 1 AND EXISTS (SELECT 1 FROM athletes WHERE id = ? AND autopilot = 1)`,
    out.reply, voice.audioKey, voice.duration, now, sources, confidence, out.reason || null, q.id, a.id),
    // same transaction, and only if that landed (a fan who deleted their account meanwhile gets nothing)
    stmt(env, `INSERT INTO notifications (id, athlete_id, user_id, text, sub, link, created_at)
      SELECT ?, ?, ?, ?, ?, 'ask', ? WHERE EXISTS (SELECT 1 FROM questions WHERE id = ? AND answered_by = 'coach' AND answered_at = ?)`,
    newId('n'), a.id, q.user_id, title, q.text, now, q.id, now),
  ]);
  // nothing changed: Angela got to it first (then the review write is a no-op too) or switched autopilot off
  if (!res.meta.changes) return 'Autopilot was switched off before it sent';
  await pushToUser(env, q.user_id, { title, body: q.text, link: 'ask' });
  return true;
}

/* ---------- auth ---------- */

async function authenticate(c, role) {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(c.request.headers.get('authorization') || '');
  if (!m) fail(401, 'Sign in to continue.');
  c.tokenHash = await sha256(m[1]);
  const row = await one(c.env, `SELECT a.*, u.id AS u_id, u.role AS u_role, u.name AS u_name, u.interests AS u_interests,
      u.notifs_read_at AS u_notifs_read_at, u.created_at AS u_created_at
    FROM tokens t JOIN users u ON u.id = t.user_id JOIN athletes a ON a.id = u.athlete_id WHERE t.token_hash = ?`, c.tokenHash);
  if (!row) fail(401, 'Your session has ended — sign in again.');
  c.user = {
    id: row.u_id, role: row.u_role, name: row.u_name, interests: row.u_interests, athlete_id: row.id,
    notifs_read_at: row.u_notifs_read_at, created_at: row.u_created_at,
  };
  c.athlete = row;
  // Coach Angela answers on her own only when the server allows it AND Angela switched it on
  row.autopilot_live = c.env.AUTOPILOT_MODE === 'grounded' && !!c.env.ANTHROPIC_API_KEY && !!row.autopilot;
  if (role !== 'any' && c.user.role !== role) {
    fail(403, role === 'athlete' ? 'Only the athlete can use the studio.' : 'This is only available to fans.');
  }
}

// fixed hourly windows per IP, counted in D1 so every isolate sees the same number
async function authAttempt(c) {
  const ip = c.request.headers.get('cf-connecting-ip') || 'unknown';
  const start = Math.floor(Date.now() / HOUR) * HOUR;
  const row = await one(c.env, `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, 1)
    ON CONFLICT (bucket, window_start) DO UPDATE SET count = count + 1 RETURNING count`, 'auth:' + ip, start);
  if (row.count > (Number(c.env.AUTH_ATTEMPTS_PER_HOUR) || AUTH_PER_HOUR)) fail(429, 'Too many sign-in attempts — try again in an hour.');
}

let keyCache = null;  // ATHLETE_KEYS as [[sha256(key), athleteId]], rebuilt if the secret changes

async function athleteForKey(env, key) {
  if (!keyCache || keyCache.raw !== env.ATHLETE_KEYS) {
    let map = {};
    try { map = JSON.parse(env.ATHLETE_KEYS || '{}'); } catch { console.error('ATHLETE_KEYS is not valid JSON'); }
    const entries = Object.entries(map).filter(([k]) => k.length >= 16);
    keyCache = { raw: env.ATHLETE_KEYS, entries: await Promise.all(entries.map(async ([k, id]) => [await digest(k), id])) };
  }
  const d = await digest(key);
  let found = null;
  for (const [h, id] of keyCache.entries) if (crypto.subtle.timingSafeEqual(h, d)) found = id;
  return found;
}

/* ---------- public ---------- */

async function getConfig({ env }) {
  return json({
    drafting: !!env.ANTHROPIC_API_KEY, voice: !!env.FISH_API_KEY, push: pushConfigured(env), minBuild: Number(env.MIN_BUILD) || 1,
    // the server side of autopilot; Angela's own switch is in her studio settings
    autopilot: env.AUTOPILOT_MODE === 'grounded' && !!env.ANTHROPIC_API_KEY,
  });
}

async function authFan(c) {
  const { env } = c;
  await authAttempt(c);
  const b = await body(c);
  const code = typeof b.code === 'string' ? b.code.trim().toUpperCase() : '';
  if (!code) fail(400, 'Enter an invite code.');
  const a = await one(env, 'SELECT a.* FROM invite_codes i JOIN athletes a ON a.id = i.athlete_id WHERE i.code = ? AND i.active = 1', code);
  if (!a) fail(404, "That invite code isn't valid.");
  const name = typeof b.name === 'string' && b.name.trim() ? b.name.replace(/\s+/g, ' ').trim().slice(0, 40) : null;
  const now = Date.now();
  const user = { id: newId('u'), athlete_id: a.id, role: 'fan', name, interests: '[]', created_at: now };
  const token = newToken();
  await env.DB.batch([
    stmt(env, `INSERT INTO users (id, athlete_id, role, name, interests, notifs_read_at, created_at) VALUES (?, ?, 'fan', ?, '[]', 0, ?)`,
      user.id, a.id, name, now),
    stmt(env, 'INSERT INTO tokens (token_hash, user_id, athlete_id, created_at) VALUES (?, ?, ?, ?)', await sha256(token), user.id, a.id, now),
  ]);
  return json({ token, user: userOut(user), athlete: athleteOut(a) });
}

async function authAthlete(c) {
  const { env } = c;
  await authAttempt(c);
  const b = await body(c);
  const athleteId = typeof b.key === 'string' && b.key.trim() ? await athleteForKey(env, b.key.trim()) : null;
  const a = athleteId && await one(env, 'SELECT * FROM athletes WHERE id = ?', athleteId);
  if (!a) fail(401, "That studio key isn't valid.");
  const now = Date.now();
  const userId = 'u_athlete_' + a.id;
  const token = newToken();
  const [, , user] = await env.DB.batch([
    stmt(env, `INSERT OR IGNORE INTO users (id, athlete_id, role, name, interests, notifs_read_at, created_at) VALUES (?, ?, 'athlete', ?, '[]', 0, ?)`,
      userId, a.id, a.first_name, now),
    stmt(env, 'INSERT INTO tokens (token_hash, user_id, athlete_id, created_at) VALUES (?, ?, ?, ?)', await sha256(token), userId, a.id, now),
    stmt(env, 'SELECT * FROM users WHERE id = ?', userId),
  ]);
  return json({ token, user: userOut(user.results[0]), athlete: athleteOut(a) });
}

/* ---------- any signed-in user ---------- */

async function getMe(c) {
  return json({ user: userOut(c.user), athlete: athleteOut(c.athlete) });
}

async function patchMe(c) {
  const { env, user } = c;
  const b = await body(c);
  if (b.name !== undefined) {
    if (b.name !== null && typeof b.name !== 'string') fail(400, 'name must be text.');
    const name = (b.name || '').replace(/\s+/g, ' ').trim();
    if (name.length > 40) fail(400, 'name must be 40 characters or fewer.');
    user.name = name || null;
  }
  if (b.interests !== undefined) {
    const ok = Array.isArray(b.interests) && b.interests.length <= 20
      && b.interests.every(i => typeof i === 'string' && i.trim() && i.trim().length <= 40);
    if (!ok) fail(400, 'interests must be a list of up to 20 short strings.');
    user.interests = JSON.stringify([...new Set(b.interests.map(i => i.trim()))]);
  }
  await run(env, 'UPDATE users SET name = ?, interests = ? WHERE id = ?', user.name ?? null, user.interests, user.id);
  return json({ user: userOut(user) });
}

async function signout(c) {
  await c.env.DB.batch([
    stmt(c.env, 'DELETE FROM devices WHERE session_hash = ?', c.tokenHash),
    stmt(c.env, 'DELETE FROM tokens WHERE token_hash = ?', c.tokenHash),
  ]);
  return json({ ok: true });
}

async function deleteMe(c) {
  const { env, user } = c;
  if (user.role !== 'fan') return signout(c);
  // library entries approved from this fan's questions carry their words, so they go too
  await env.DB.batch([
    stmt(env, 'DELETE FROM kb WHERE source_question_id IN (SELECT id FROM questions WHERE user_id = ?)', user.id),
    stmt(env, `DELETE FROM passed_prompts WHERE prompt_id IN (SELECT 'fan-' || id FROM questions WHERE user_id = ?)`, user.id),
    stmt(env, 'DELETE FROM questions WHERE user_id = ?', user.id),
    stmt(env, 'DELETE FROM listens WHERE user_id = ?', user.id),
    stmt(env, 'DELETE FROM notifications WHERE user_id = ?', user.id),
    stmt(env, 'DELETE FROM devices WHERE user_id = ?', user.id),
    stmt(env, 'DELETE FROM tokens WHERE user_id = ?', user.id),
    stmt(env, 'DELETE FROM users WHERE id = ?', user.id),
  ]);
  return json({ ok: true });
}

async function getAudio(c) {
  const key = c.params.key;
  if (!/^[0-9a-f]{40}$/.test(key)) fail(404, 'Audio not found.');
  const buf = await c.env.AUDIO.get(key, 'arrayBuffer');
  if (!buf) fail(404, 'Audio not found.');
  const size = buf.byteLength;
  const headers = { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=31536000, immutable', etag: `"${key}"` };
  // AVPlayer streams with byte-range requests and refuses servers that ignore them
  const range = /^bytes=(\d*)-(\d*)$/.exec(c.request.headers.get('range') || '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, 'content-range': `bytes */${size}` } });
    }
    return new Response(buf.slice(start, end + 1), {
      status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) },
    });
  }
  return new Response(buf, { headers: { ...headers, 'content-length': String(size) } });
}

async function postDevice(c) {
  const b = await body(c);
  const token = typeof b.token === 'string' ? b.token.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{32,200}$/.test(token)) fail(400, 'token must be the APNs device token as hex.');
  const apnsEnv = b.env ?? 'production';
  if (apnsEnv !== 'sandbox' && apnsEnv !== 'production') fail(400, 'env must be "sandbox" or "production".');
  const now = Date.now();
  await run(c.env, `INSERT INTO devices (token, user_id, athlete_id, env, session_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, athlete_id = excluded.athlete_id, env = excluded.env,
      session_hash = excluded.session_hash, updated_at = excluded.updated_at`,
    token, c.user.id, c.user.athlete_id, apnsEnv, c.tokenHash, now, now);
  return json({ ok: true });
}

async function getNotifications(c) {
  const { env, user } = c;
  const [rows, unread] = await env.DB.batch([
    stmt(env, `SELECT n.* FROM notifications n WHERE ${NOTIF_SCOPE} ORDER BY n.created_at DESC, n.id DESC LIMIT 50`, ...scopeBinds(user)),
    unreadStmt(env, user),
  ]);
  return json({ notifications: rows.results.map(n => notificationOut(n, user.notifs_read_at)), unread: unread.results[0].n });
}

async function readNotifications(c) {
  await run(c.env, 'UPDATE users SET notifs_read_at = ? WHERE id = ?', Date.now(), c.user.id);
  return json({ ok: true });
}

/* ---------- fan ---------- */

const FAN_DROPS = `SELECT ${DROP_COLS}, EXISTS (SELECT 1 FROM listens l WHERE l.drop_id = d.id AND l.user_id = ?1) AS listened
  FROM drops d WHERE d.athlete_id = ?2 AND d.status = 'published' ORDER BY d.published_at DESC, d.id DESC LIMIT 200`;

async function getHome(c) {
  const { env, user, athlete: a } = c;
  const [dropRows, kb, asked, unread] = await env.DB.batch([
    stmt(env, FAN_DROPS, user.id, a.id),
    stmt(env, 'SELECT question FROM kb WHERE athlete_id = ? ORDER BY created_at, id LIMIT 100', a.id),
    stmt(env, 'SELECT text FROM questions WHERE user_id = ?', user.id),
    unreadStmt(env, user),
  ]);
  const drops = dropRows.results.map(dropOut);
  const today = drops[0] || null;
  // unlistened first; the stable sort keeps newest-first within each group
  const suggested = drops.filter(d => d !== today && !d.pinned).sort((x, y) => x.listened - y.listened).slice(0, 10);
  const askedKeys = new Set(asked.results.map(q => q.text.toLowerCase()));
  const suggestions = kb.results.map(k => k.question).filter(q => !askedKeys.has(q.toLowerCase())).slice(0, 4);
  return json({
    athlete: athleteOut(a), today, picks: drops.filter(d => d.pinned), suggested, suggestions, unread: unread.results[0].n,
  });
}

async function getDrops(c) {
  const rows = await all(c.env, FAN_DROPS, c.user.id, c.athlete.id);
  return json({ drops: rows.map(dropOut) });
}

async function listenDrop(c) {
  const { env, user } = c;
  const d = await one(env, `SELECT id FROM drops WHERE id = ? AND athlete_id = ? AND status = 'published'`, c.params.id, user.athlete_id);
  if (!d) fail(404, 'Drop not found.');
  const [, count] = await env.DB.batch([
    stmt(env, 'INSERT OR IGNORE INTO listens (drop_id, user_id, athlete_id, created_at) VALUES (?, ?, ?, ?)', d.id, user.id, user.athlete_id, Date.now()),
    stmt(env, 'SELECT COUNT(*) AS n FROM listens WHERE drop_id = ?', d.id),
  ]);
  return json({ listens: count.results[0].n });
}

async function getQuestions(c) {
  const rows = await all(c.env, `SELECT * FROM (SELECT * FROM questions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 500)
    ORDER BY created_at, id`, c.user.id);
  return json({ questions: rows.map(q => questionOut(q, c.athlete)), paused: !!c.athlete.paused });
}

async function askQuestion(c) {
  const { env, user, athlete: a } = c;
  const b = await body(c);
  const text = typeof b.text === 'string' ? b.text.replace(/\s+/g, ' ').trim() : '';
  if (!text || text.length > 300) fail(400, 'Questions must be 1–300 characters.');
  // crisis language always gets the safety message — even while paused or past the daily limit (up to
  // twice it): it never reaches Angela, Claude or the voice, so nothing is spent, and it must not bounce
  const crisis = isCrisis(text);
  if (a.paused && !crisis) fail(409, `${a.first_name} isn't taking new questions right now — check back soon.`);
  const now = Date.now();
  const [recent, kb] = await env.DB.batch([
    stmt(env, 'SELECT COUNT(*) AS n FROM questions WHERE user_id = ? AND created_at > ?', user.id, now - DAY),
    stmt(env, 'SELECT id, question, answer, keys, audio_key, duration FROM kb WHERE athlete_id = ?', a.id),
  ]);
  const today = recent.results[0].n;
  if (today >= QUESTIONS_PER_DAY && !(crisis && today < 2 * QUESTIONS_PER_DAY)) {
    fail(429, `That's ${QUESTIONS_PER_DAY} questions today, the daily limit. Ask again tomorrow.`);
  }

  const q = {
    id: newId('q'), user_id: user.id, text, status: 'pending', answer: null, audio_key: null, duration: null, kb_id: null,
    drafting: 0, drafting_at: null, saved: 0, created_at: now, answered_at: null, answered_by: null, note: null,
  };
  if (crisis) {
    Object.assign(q, { status: 'guarded', note: CRISIS_TEXT });
  } else if (a.guard_decline && isSensitive(text)) {
    q.status = 'guarded';
  } else {
    const hit = matchKb(text, kb.results.map(k => ({ ...k, keys: parseList(k.keys) })));
    if (hit) {
      Object.assign(q, {
        status: 'instant', answer: hit.answer, audio_key: hit.audio_key, duration: hit.duration, kb_id: hit.id, answered_at: now, answered_by: 'library',
      });
    } else if (env.ANTHROPIC_API_KEY) {
      Object.assign(q, { drafting: 1, drafting_at: now });
    }
  }
  await run(env, `INSERT INTO questions (id, athlete_id, user_id, kind, text, status, answer, audio_key, duration, draft, draft_source,
      drafting, drafting_at, kb_id, saved, created_at, answered_at, answered_by, note)
    VALUES (?, ?, ?, 'fan', ?, ?, ?, ?, ?, '', 'none', ?, ?, ?, 0, ?, ?, ?, ?)`,
  q.id, a.id, user.id, text, q.status, q.answer, q.audio_key, q.duration, q.drafting, q.drafting_at, q.kb_id, now, q.answered_at,
  q.answered_by, q.note);
  if (q.drafting) c.ctx.waitUntil(backgroundBrain(env, a, q));
  return json({ question: questionOut(q, a) }, 201);
}

async function saveQuestion(c) {
  const saved = bool((await body(c)).saved, 'saved');
  const q = await one(c.env, 'UPDATE questions SET saved = ? WHERE id = ? AND user_id = ? RETURNING *', saved ? 1 : 0, c.params.id, c.user.id);
  if (!q) fail(404, 'Question not found.');
  return json({ question: questionOut(q, c.athlete) });
}

/* ---------- athlete studio ---------- */

async function studioToday(c) {
  const { env, athlete: a } = c;
  const now = Date.now(), weekAgo = now - 7 * DAY;
  const [queue, members, statuses, replies, listens, dropRows] = await env.DB.batch([
    stmt(env, `SELECT COUNT(*) AS n FROM questions WHERE athlete_id = ? AND status = 'pending'`, a.id),
    stmt(env, `SELECT COUNT(*) AS n, COALESCE(SUM(created_at > ?), 0) AS week FROM users WHERE athlete_id = ? AND role = 'fan'`, weekAgo, a.id),
    stmt(env, `SELECT status, COUNT(*) AS n FROM questions WHERE athlete_id = ? AND kind = 'fan' GROUP BY status`, a.id),
    stmt(env, `SELECT answered_at - created_at AS ms FROM questions WHERE athlete_id = ? AND kind = 'fan' AND status = 'answered'
      ORDER BY answered_at DESC LIMIT 1000`, a.id),
    stmt(env, 'SELECT COUNT(*) AS n FROM listens WHERE athlete_id = ? AND created_at > ?', a.id, weekAgo),
    stmt(env, `SELECT ${DROP_COLS} FROM drops d WHERE d.athlete_id = ? AND d.status IN ('draft', 'queued', 'published')
      ORDER BY d.created_at, d.id`, a.id),
  ]);
  const by = Object.fromEntries(statuses.results.map(s => [s.status, s.n]));
  const answered = (by.answered || 0) + (by.instant || 0);
  const asked = answered + (by.pending || 0) + (by.declined || 0);   // guardrail declines never reach her
  const ms = replies.results.map(r => r.ms).sort((x, y) => x - y);
  const median = ms.length ? (ms.length % 2 ? ms[ms.length >> 1] : (ms[ms.length / 2 - 1] + ms[ms.length / 2]) / 2) : null;
  const drops = dropRows.results.map(dropOut);
  const queued = drops.filter(d => d.status === 'queued').sort((x, y) => x.queuePos - y.queuePos);
  const published = drops.filter(d => d.status === 'published');
  const lastPublishedAt = Math.max(0, ...published.map(d => d.publishedAt));
  return json({
    queueCount: queue.results[0].n,
    stats: {
      members: members.results[0].n,
      membersWeek: members.results[0].week,
      answeredPct: asked ? Math.round(answered / asked * 100) : null,
      medianReplyHours: median == null ? null : Math.round(median / HOUR * 10) / 10,
      listensWeek: listens.results[0].n,
      published: published.length,
    },
    draftDrops: drops.filter(d => d.status === 'draft'),
    queued,
    nextPublishAt: queued.length ? nextPublishAt(lastPublishedAt, now) : null,
    bioStatus: a.bio_status,
  });
}

async function studioQueue(c) {
  const rows = await all(c.env, `SELECT q.*, u.name AS fan_name FROM questions q LEFT JOIN users u ON u.id = q.user_id
    WHERE q.athlete_id = ? AND q.status = 'pending' ORDER BY q.created_at, q.id`, c.athlete.id);
  return json({ questions: rows.map(studioQuestionOut) });
}

async function pendingQuestion(c) {
  const q = await one(c.env, 'SELECT * FROM questions WHERE id = ? AND athlete_id = ?', c.params.id, c.athlete.id);
  if (!q) fail(404, 'Question not found.');
  if (q.status !== 'pending') fail(409, "This question isn't in your queue anymore.");
  return q;
}

async function approveQuestion(c) {
  const { env, athlete: a } = c;
  const q = await pendingQuestion(c);
  const answer = str((await body(c)).text, 'The answer', 1200, { collapse: false });
  const { audioKey, duration } = await renderVoice(env, answer);   // throws before anything changes
  const now = Date.now();
  const done = await one(env, `UPDATE questions SET status = 'answered', answer = ?, audio_key = ?, duration = ?, answered_at = ?, drafting = 0,
      answered_by = 'angela', note = NULL
    WHERE id = ? AND status = 'pending' RETURNING id`, answer, audioKey, duration, now, q.id);
  if (!done) fail(409, "This question isn't in your queue anymore.");
  const toFan = q.kind === 'fan' && q.user_id;
  const title = `${a.first_name} answered you`;
  await env.DB.batch([
    stmt(env, `INSERT INTO kb (id, athlete_id, question, answer, keys, audio_key, duration, source_question_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, newId('kb'), a.id, q.text, answer, q.kb_keys || '[]', audioKey, duration, q.id, now),
    ...(toFan ? [notifyStmt(env, a.id, q.user_id, title, q.text, 'ask', now)] : []),
  ]);
  if (toFan) c.ctx.waitUntil(pushToUser(env, q.user_id, { title, body: q.text, link: 'ask' }));
  return json({ ok: true, audioKey, duration });
}

async function declineQuestion(c) {
  const q = await pendingQuestion(c);
  await run(c.env, `UPDATE questions SET status = 'declined', drafting = 0, note = NULL WHERE id = ? AND status = 'pending'`, q.id);
  return json({ ok: true });
}

/* ---------- Coach Angela oversight: what autopilot sent, and her keep / retract ---------- */

async function studioCoach(c) {
  const rows = await all(c.env, `SELECT q.*, u.name AS fan_name FROM questions q LEFT JOIN users u ON u.id = q.user_id
    WHERE q.athlete_id = ? AND q.status = 'answered' AND q.answered_by = 'coach' ORDER BY q.answered_at DESC, q.id DESC LIMIT 50`, c.athlete.id);
  return json({ answers: rows.map(coachAnswerOut) });
}

async function coachAnswer(c, verb) {
  const q = await one(c.env, 'SELECT * FROM questions WHERE id = ? AND athlete_id = ?', c.params.id, c.athlete.id);
  if (!q) fail(404, 'Question not found.');
  if (q.status !== 'answered' || q.answered_by !== 'coach') fail(409, `Only Coach Angela's autopilot answers can be ${verb}.`);
  return q;
}

// keeping one is approving it: it's marked reviewed and joins the instant-answer library (once)
async function keepCoachAnswer(c) {
  const { env, athlete: a } = c;
  const q = await coachAnswer(c, 'kept');
  const [res] = await env.DB.batch([
    stmt(env, `UPDATE questions SET reviewed = 1 WHERE id = ? AND status = 'answered' AND answered_by = 'coach'`, q.id),
    stmt(env, `INSERT INTO kb (id, athlete_id, question, answer, keys, audio_key, duration, source_question_id, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM kb WHERE source_question_id = ?)
        AND EXISTS (SELECT 1 FROM questions WHERE id = ? AND status = 'answered' AND answered_by = 'coach')`,
    newId('kb'), a.id, q.text, q.answer, q.kb_keys || '[]', q.audio_key, q.duration, q.id, Date.now(), q.id, q.id),
  ]);
  if (!res.meta.changes) fail(409, "Only Coach Angela's autopilot answers can be kept.");   // retracted meanwhile
  return json({ ok: true });
}

// back to her queue with the old answer as the draft; the fan's reply (and its audio) is withdrawn
async function retractCoachAnswer(c) {
  const { env, athlete: a } = c;
  const q = await coachAnswer(c, 'retracted');
  const [res] = await env.DB.batch([
    stmt(env, `UPDATE questions SET status = 'pending', draft = answer, draft_source = 'coach', answer = NULL, audio_key = NULL,
        duration = NULL, answered_at = NULL, answered_by = NULL, reviewed = 0, drafting = 0, note = ?, reason = ?
      WHERE id = ? AND status = 'answered' AND answered_by = 'coach'`,
    `${a.first_name} is taking another look at this one.`, RETRACTED_REASON, q.id),
    // a kept answer leaves the library too
    stmt(env, `DELETE FROM kb WHERE source_question_id = ? AND NOT EXISTS (SELECT 1 FROM questions WHERE id = ? AND status = 'answered')`,
      q.id, q.id),
  ]);
  if (!res.meta.changes) fail(409, "Only Coach Angela's autopilot answers can be retracted.");
  return json({ ok: true });
}

async function reviseQuestion(c) {
  const { env, athlete: a } = c;
  if (!env.ANTHROPIC_API_KEY) fail(503, "Drafting isn't set up yet — edit the draft yourself for now.");
  const q = await pendingQuestion(c);
  const b = await body(c);
  if (b.text != null && typeof b.text !== 'string') fail(400, 'text must be the current draft.');
  const current = (b.text || '').trim().slice(0, 2000);
  const note = str(b.note, 'The note', 500);
  let draft = null;
  try {
    const grounding = await loadGrounding(env, a.id, q.text);
    draft = await draftReply(env, { athlete: a, question: q.text, grounding, current, note, timeout: 60e3, maxRetries: 1 });
  } catch (e) {
    console.error('revise failed', q.id, e && e.status, e && e.message);
  }
  if (!draft) fail(502, "Couldn't redraft that one — try again, or edit it yourself.");
  await run(env, `UPDATE questions SET draft = ?, draft_source = 'claude', drafting = 0 WHERE id = ? AND status = 'pending'`, draft, q.id);
  return json({ draft });
}

async function preview(c) {
  const text = str((await body(c)).text, 'Text', 4000, { collapse: false });
  return json(await renderVoice(c.env, text));
}

async function studioDrops(c) {
  const rows = await all(c.env, `SELECT ${DROP_COLS} FROM drops d WHERE d.athlete_id = ? AND d.status IN ('draft', 'queued', 'published')
    ORDER BY d.created_at, d.id`, c.athlete.id);
  const drops = rows.map(dropOut);
  return json({
    drafts: drops.filter(d => d.status === 'draft'),
    queued: drops.filter(d => d.status === 'queued').sort((x, y) => x.queuePos - y.queuePos),
    published: drops.filter(d => d.status === 'published').sort((x, y) => y.publishedAt - x.publishedAt),
  });
}

async function createDrop(c) {
  const { env, athlete: a } = c;
  const b = await body(c);
  const title = str(b.title, 'Title', 120);
  const script = str(b.script, 'Script', 4000, { collapse: false });
  const id = newId('d');
  await run(env, `INSERT INTO drops (id, athlete_id, title, script, status, source, pinned, created_at) VALUES (?, ?, ?, ?, 'draft', 'Your draft', 0, ?)`,
    id, a.id, title, script, Date.now());
  return json({ drop: dropOut(await dropById(env, a.id, id)) });
}

async function approveDrop(c) {
  const { env, athlete: a } = c;
  const d = await dropById(env, a.id, c.params.id);
  if (!d) fail(404, 'Drop not found.');
  if (d.status === 'published') fail(409, 'This drop is already published.');
  const b = await body(c);
  const title = b.title === undefined ? d.title : str(b.title, 'Title', 120);
  const script = b.script === undefined ? d.script : str(b.script, 'Script', 4000, { collapse: false });
  const publishNow = b.publishNow === undefined ? false : bool(b.publishNow, 'publishNow');
  const { audioKey, duration } = await renderVoice(env, script);
  const now = Date.now();
  const edit = stmt(env, 'UPDATE drops SET title = ?, script = ?, audio_key = ?, duration = ? WHERE id = ?', title, script, audioKey, duration, d.id);
  if (publishNow) {
    await env.DB.batch([edit, ...publishStmts(env, a, { ...d, title, duration }, now)]);
    c.ctx.waitUntil(pushToFans(env, a.id, { title: `New drop: ${title}`, body: `From ${a.first_name} — tap to listen.`, link: 'drop:' + d.id }));
  } else if (d.status === 'queued') {
    await edit.run();
  } else {
    await env.DB.batch([edit, stmt(env, `UPDATE drops SET status = 'queued',
      queue_pos = (SELECT COALESCE(MAX(queue_pos), 0) + 1 FROM drops WHERE athlete_id = ? AND status = 'queued') WHERE id = ?`, a.id, d.id)]);
  }
  return json({ drop: dropOut(await dropById(env, a.id, d.id)) });
}

async function rejectDrop(c) {
  const { env, athlete: a } = c;
  const [res] = await env.DB.batch([
    stmt(env, `UPDATE drops SET status = 'rejected', queue_pos = NULL, pinned = 0 WHERE id = ? AND athlete_id = ?`, c.params.id, a.id),
    // unpublishing also withdraws its "New drop" announcement
    stmt(env, 'DELETE FROM notifications WHERE athlete_id = ? AND user_id IS NULL AND link = ?', a.id, 'drop:' + c.params.id),
  ]);
  if (!res.meta.changes) fail(404, 'Drop not found.');
  return json({ ok: true });
}

async function pinDrop(c) {
  const { env, athlete: a } = c;
  const pinned = bool((await body(c)).pinned, 'pinned');
  const res = await run(env, 'UPDATE drops SET pinned = ? WHERE id = ? AND athlete_id = ?', pinned ? 1 : 0, c.params.id, a.id);
  if (!res.meta.changes) fail(404, 'Drop not found.');
  return json({ drop: dropOut(await dropById(env, a.id, c.params.id)) });
}

async function getBio(c) {
  return json(bioOut(c.athlete));
}

async function postBio(c) {
  const text = str((await body(c)).text, 'The bio', 1500, { collapse: false });
  const { audioKey, duration } = await renderVoice(c.env, text);
  await run(c.env, `UPDATE athletes SET bio_text = ?, bio_status = 'approved', bio_audio_key = ?, bio_duration = ? WHERE id = ?`,
    text, audioKey, duration, c.athlete.id);
  return json({ text, status: 'approved', audioKey, duration });
}

async function getSettings(c) {
  return json(settingsOut(c.athlete));
}

async function patchSettings(c) {
  const b = await body(c);
  const sets = [], binds = [];
  for (const [field, col] of [['paused', 'paused'], ['guardTopics', 'guard_topics'], ['guardDecline', 'guard_decline'], ['autopilot', 'autopilot']]) {
    if (b[field] === undefined) continue;
    sets.push(`${col} = ?`);
    binds.push(bool(b[field], field) ? 1 : 0);
  }
  const a = sets.length
    ? await one(c.env, `UPDATE athletes SET ${sets.join(', ')} WHERE id = ? RETURNING paused, guard_topics, guard_decline, autopilot`, ...binds, c.athlete.id)
    : c.athlete;
  return json(settingsOut(a));
}

async function getPrompts(c) {
  const { env, athlete: a } = c;
  const [starters, hiddenRows, fanQs, material] = await env.DB.batch([
    stmt(env, 'SELECT id, title, src, hint FROM prompts WHERE athlete_id = ? ORDER BY sort, id', a.id),
    // passed prompts, and prompts she has already recorded a story for
    stmt(env, `SELECT prompt_id AS id FROM passed_prompts WHERE athlete_id = ?1
      UNION SELECT prompt_id FROM stories WHERE athlete_id = ?1 AND prompt_id IS NOT NULL`, a.id),
    stmt(env, `SELECT q.id, q.text, u.name AS fan_name FROM questions q LEFT JOIN users u ON u.id = q.user_id
      WHERE q.athlete_id = ? AND q.kind = 'fan' AND q.status = 'pending' ORDER BY q.created_at DESC LIMIT 20`, a.id),
    stmt(env, `SELECT question || ' ' || answer AS t FROM kb WHERE athlete_id = ?1
      UNION ALL SELECT title || ' ' || script FROM drops WHERE athlete_id = ?1 AND status = 'published'
      UNION ALL SELECT title || ' ' || transcript FROM stories WHERE athlete_id = ?1`, a.id),
  ]);
  const hidden = new Set(hiddenRows.results.map(r => r.id));
  const live = fanQs.results.filter(q => !hidden.has('fan-' + q.id)).slice(0, 3).map(q => ({
    id: 'fan-' + q.id, title: q.text, src: 'FANS ARE ASKING', hint: `${q.fan_name || 'A fan'} asked this — it's waiting in your queue.`,
  }));
  return json({
    prompts: [...live, ...starters.results.filter(p => !hidden.has(p.id)), FREE_PROMPT],
    coverage: coverage(material.results.map(r => r.t)),
  });
}

async function passPrompt(c) {
  const id = c.params.id;
  if (id.length > 100) fail(400, 'Unknown prompt.');
  if (id !== FREE_PROMPT.id) {
    await run(c.env, 'INSERT OR IGNORE INTO passed_prompts (athlete_id, prompt_id, created_at) VALUES (?, ?, ?)', c.athlete.id, id, Date.now());
  }
  return json({ ok: true });
}

async function getStories(c) {
  const rows = await all(c.env, 'SELECT * FROM stories WHERE athlete_id = ? ORDER BY created_at DESC, id DESC', c.athlete.id);
  return json({ stories: rows.map(storyOut) });
}

async function postStory(c) {
  const { env, athlete: a } = c;
  const b = await body(c);
  const title = str(b.title, 'Title', 120);
  if (b.transcript != null && typeof b.transcript !== 'string') fail(400, 'transcript must be text.');
  const transcript = (b.transcript || '').trim();
  if (transcript.length > 20000) fail(400, 'transcript must be 20000 characters or fewer.');
  if (b.duration != null && !(typeof b.duration === 'number' && Number.isFinite(b.duration) && b.duration >= 0)) {
    fail(400, 'duration must be a number of seconds.');
  }
  if (b.promptId != null && (typeof b.promptId !== 'string' || b.promptId.length > 100)) fail(400, 'promptId must be a prompt id.');
  let audio = null;
  if (b.audio != null) {
    try { audio = Uint8Array.from(atob(String(b.audio).replace(/\s/g, '')), ch => ch.charCodeAt(0)); } catch { audio = null; }
    if (!audio || !audio.length) fail(400, 'audio must be base64-encoded m4a.');
    if (audio.length > MAX_STORY_AUDIO) fail(413, 'That recording is too long to upload — keep stories under about 20 MB.');
  }
  const s = {
    id: newId('s'), prompt_id: b.promptId ?? null, title, transcript, duration: b.duration ?? null, created_at: Date.now(),
  };
  // story audio is kept for later processing; it isn't served by /v1/audio (keys there are clip hashes)
  const audioKey = audio ? `story/${a.id}/${s.id}` : null;
  if (audio) await env.AUDIO.put(audioKey, audio, { metadata: { contentType: 'audio/mp4', bytes: audio.length } });
  await run(env, `INSERT INTO stories (id, athlete_id, prompt_id, title, transcript, duration, audio_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    s.id, a.id, s.prompt_id, title, transcript, s.duration, audioKey, s.created_at);
  return json({ story: storyOut(s) });
}

async function deleteStory(c) {
  const s = await one(c.env, 'DELETE FROM stories WHERE id = ? AND athlete_id = ? RETURNING audio_key', c.params.id, c.athlete.id);
  if (!s) fail(404, 'Story not found.');
  if (s.audio_key) await c.env.AUDIO.delete(s.audio_key);
  return json({ ok: true });
}

/* ---------- routing ---------- */

const ROUTES = [
  ['GET', '/v1/config', null, getConfig],
  ['POST', '/v1/auth/fan', null, authFan],
  ['POST', '/v1/auth/athlete', null, authAthlete],

  ['GET', '/v1/me', 'any', getMe],
  ['PATCH', '/v1/me', 'any', patchMe],
  ['DELETE', '/v1/me', 'any', deleteMe],
  ['POST', '/v1/auth/signout', 'any', signout],
  ['GET', '/v1/audio/:key', 'any', getAudio],
  ['POST', '/v1/devices', 'any', postDevice],
  ['GET', '/v1/notifications', 'any', getNotifications],
  ['POST', '/v1/notifications/read', 'any', readNotifications],

  ['GET', '/v1/home', 'fan', getHome],
  ['GET', '/v1/drops', 'fan', getDrops],
  ['POST', '/v1/drops/:id/listen', 'fan', listenDrop],
  ['GET', '/v1/questions', 'fan', getQuestions],
  ['POST', '/v1/questions', 'fan', askQuestion],
  ['POST', '/v1/questions/:id/save', 'fan', saveQuestion],

  ['GET', '/v1/studio/today', 'athlete', studioToday],
  ['GET', '/v1/studio/queue', 'athlete', studioQueue],
  ['POST', '/v1/studio/questions/:id/approve', 'athlete', approveQuestion],
  ['POST', '/v1/studio/questions/:id/decline', 'athlete', declineQuestion],
  ['POST', '/v1/studio/questions/:id/revise', 'athlete', reviseQuestion],
  ['POST', '/v1/studio/questions/:id/keep', 'athlete', keepCoachAnswer],
  ['POST', '/v1/studio/questions/:id/retract', 'athlete', retractCoachAnswer],
  ['GET', '/v1/studio/coach', 'athlete', studioCoach],
  ['POST', '/v1/studio/preview', 'athlete', preview],
  ['GET', '/v1/studio/drops', 'athlete', studioDrops],
  ['POST', '/v1/studio/drops', 'athlete', createDrop],
  ['POST', '/v1/studio/drops/:id/approve', 'athlete', approveDrop],
  ['POST', '/v1/studio/drops/:id/reject', 'athlete', rejectDrop],
  ['POST', '/v1/studio/drops/:id/pin', 'athlete', pinDrop],
  ['GET', '/v1/studio/bio', 'athlete', getBio],
  ['POST', '/v1/studio/bio', 'athlete', postBio],
  ['GET', '/v1/studio/settings', 'athlete', getSettings],
  ['PATCH', '/v1/studio/settings', 'athlete', patchSettings],
  ['GET', '/v1/studio/prompts', 'athlete', getPrompts],
  ['POST', '/v1/studio/prompts/:id/pass', 'athlete', passPrompt],
  ['GET', '/v1/studio/stories', 'athlete', getStories],
  ['POST', '/v1/studio/stories', 'athlete', postStory],
  ['DELETE', '/v1/studio/stories/:id', 'athlete', deleteStory],
].map(([method, path, role, handler]) => ({
  method, role, handler, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'),
}));

// CORS: every /v1 response (errors, 404/405 and audio included) names an allowed Origin back; unlisted
// origins get no Access-Control-Allow-Origin. Vary: Origin always, since the headers depend on it.
export async function handleV1(request, env, ctx) {
  const origin = request.headers.get('origin');
  const allowed = origin && ((env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origin) || DEV_ORIGINS.includes(origin));
  const cors = allowed ? { 'access-control-allow-origin': origin, vary: 'Origin' } : { vary: 'Origin' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: allowed ? { ...cors, ...PREFLIGHT } : cors });
  const res = await routeV1(request, env, ctx);
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

async function routeV1(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method === 'HEAD' ? 'GET' : request.method;
  try {
    let known = false;
    for (const r of ROUTES) {
      const m = r.re.exec(path);
      if (!m) continue;
      known = true;
      if (r.method !== method) continue;
      const params = {};
      for (const [k, v] of Object.entries(m.groups || {})) {
        try { params[k] = decodeURIComponent(v); } catch { fail(404, 'Not found.'); }
      }
      const c = { request, env, ctx, params };
      if (r.role) await authenticate(c, r.role);
      const res = await r.handler(c);
      return request.method === 'HEAD' ? new Response(null, res) : res;
    }
    return known ? json({ error: 'Method not allowed.' }, 405) : json({ error: 'Not found.' }, 404);
  } catch (e) {
    if (e instanceof HttpError || e instanceof VoiceError) return json({ error: e.message }, e.status);
    console.error('v1', request.method, path, e && e.stack || e);
    return json({ error: 'Something went wrong on our side — try again.' }, 500);
  }
}

/* ---------- daily drop (cron, 14:00 UTC) ---------- */

export async function scheduledV1(env) {
  const now = Date.now();
  for (const a of await all(env, 'SELECT * FROM athletes')) {
    try {
      const last = await one(env, `SELECT MAX(published_at) AS t FROM drops WHERE athlete_id = ? AND status = 'published'`, a.id);
      if (last.t && now - last.t < PUBLISH_GAP) continue;
      const next = await one(env, `SELECT * FROM drops WHERE athlete_id = ? AND status = 'queued' ORDER BY queue_pos, created_at, id LIMIT 1`, a.id);
      if (!next) continue;
      await env.DB.batch(publishStmts(env, a, next, now));
      await pushToFans(env, a.id, { title: `New drop: ${next.title}`, body: `From ${a.first_name} — tap to listen.`, link: 'drop:' + next.id });
    } catch (e) {
      console.error('daily drop failed', a.id, e && e.stack || e);
    }
  }
  await run(env, 'DELETE FROM rate_limits WHERE window_start < ?', now - 2 * DAY);
}

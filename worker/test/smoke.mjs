#!/usr/bin/env node
/* End-to-end smoke test for Strive API v1. Touches only the angela-review sandbox and removes
   everything it creates (its fan, questions, library entry, story, athlete session).
     node test/smoke.mjs                                          # production
     STRIVE_API_BASE=http://127.0.0.1:8787 STRIVE_TEST_KEY_REVIEW=<key> node test/smoke.mjs
   The review studio key comes from STRIVE_TEST_KEY_REVIEW, else worker/.secrets.local.json.
   With voice configured, the first run renders one new clip (REPLY); later runs reuse it from KV.
   Against a local instance (scripts/local-up.sh) it also runs the drop pipeline and the daily cron
   (plus a starter approval on the angela tenant when STRIVE_TEST_KEY_ANGELA is set). Those leave
   invisible rows behind (rejected drops can't be deleted), so they never run against production. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let base = (process.env.STRIVE_API_BASE || 'https://strive-api.billyatminyawns.workers.dev').replace(/\/+$/, '');
if (!base.endsWith('/v1')) base += '/v1';
const origin = new URL(base).origin;
const isLocal = ['127.0.0.1', 'localhost'].includes(new URL(base).hostname);
const DAY_GAP = 20 * 3600e3;

const REPLY = "Mediocre days are information, not a verdict. Pick one thing to do at game speed tomorrow, do it on purpose, and count that as the win. Confidence comes back through reps, not pep talks.";
// a starter answer whose clip is pre-loaded in KV — approvable even when voice isn't configured
const STARTER_REPLY = 'Short memory, long habits. I gave myself one length of the bench to be frustrated — then eyes up, next play. The reset is a skill you train, not a mood you wait for.';
const PENDING_NOTE = "With Angela — she reviews every answer before it's sent.";

function reviewKey() {
  if (process.env.STRIVE_TEST_KEY_REVIEW) return process.env.STRIVE_TEST_KEY_REVIEW;
  const file = path.join(here, '..', '.secrets.local.json');
  const key = fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8'))['angela-review'];
  if (!key) throw new Error('Set STRIVE_TEST_KEY_REVIEW or create worker/.secrets.local.json');
  return key;
}

let passed = 0;
const failed = [];
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ok    ' + name); return true; }
  failed.push(name);
  console.log('  FAIL  ' + name + (detail === undefined ? '' : '\n        ' + JSON.stringify(detail).slice(0, 400)));
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
  const data = isJson ? await res.json() : new Uint8Array(await res.arrayBuffer());
  return { status: res.status, data, headers: res.headers };
}

const isErr = (r, status) => r.status === status && typeof r.data.error === 'string' && r.data.error.length > 0;

async function main() {
  console.log('Strive API v1 smoke test → ' + base);
  const key = reviewKey();

  const cfg = await api('GET', '/config');
  check('config', cfg.status === 200 && ['drafting', 'voice', 'push'].every(k => typeof cfg.data[k] === 'boolean') && cfg.data.minBuild === 1, cfg.data);
  const voice = cfg.data.voice;
  console.log(`        drafting=${cfg.data.drafting} voice=${voice} push=${cfg.data.push}`);

  check('unknown route → 404', isErr(await api('GET', '/nope'), 404));
  check('no token → 401', isErr(await api('GET', '/me'), 401));
  check('fan auth with a bad code → 404', isErr(await api('POST', '/auth/fan', { body: { code: 'NOT-A-CODE' } }), 404));

  const fanAuth = await api('POST', '/auth/fan', { body: { code: 'review', name: 'Smoke Test' } });
  check('fan auth with REVIEW', fanAuth.status === 200 && typeof fanAuth.data.token === 'string'
    && fanAuth.data.user.role === 'fan' && fanAuth.data.user.name === 'Smoke Test' && fanAuth.data.athlete.id === 'angela-review', fanAuth.data);
  const fan = fanAuth.data.token;
  if (!fan) throw new Error('fan sign-in failed; nothing else can run');

  check('athlete auth with a bad key → 401', isErr(await api('POST', '/auth/athlete', { body: { key: 'definitely-not-the-studio-key' } }), 401));
  const athAuth = await api('POST', '/auth/athlete', { body: { key } });
  check('athlete auth with the review key', athAuth.status === 200 && athAuth.data.user.role === 'athlete'
    && athAuth.data.user.athleteId === 'angela-review', athAuth.data);
  const athlete = athAuth.data.token;
  const before = athlete && await tenantSnapshot(athlete);

  let paused = false;
  const mine = {};
  try {
    if (!athlete) throw new Error('athlete sign-in failed');
    const me = await api('GET', '/me', { token: fan });
    check('GET /me', me.status === 200 && me.data.user.id === fanAuth.data.user.id && me.data.athlete.coachName === 'Coach Angela'
      && me.data.athlete.badges.length === 3 && me.data.athlete.paused === false, me.data);
    const patched = await api('PATCH', '/me', { token: fan, body: { interests: ['Mindset', 'Stories'] } });
    check('PATCH /me', patched.status === 200 && patched.data.user.interests.join() === 'Mindset,Stories', patched.data);
    check('device registration', (await api('POST', '/devices', { token: fan, body: { token: 'ab'.repeat(32), env: 'sandbox' } })).data.ok === true);

    const home = await api('GET', '/home', { token: fan });
    const h = home.data;
    check('home: approved bio with audio', home.status === 200 && h.athlete.bio && h.athlete.bio.audioKey && h.athlete.bio.duration > 0, h.athlete);
    check('home: today is the latest published drop', h.today && h.today.status === 'published' && h.today.audioKey, h.today);
    check('home: pinned pick', h.picks.some(d => d.title === 'Gold medal morning' && d.pinned), h.picks);
    check('home: suggestions from the library', Array.isArray(h.suggestions) && h.suggestions.length >= 1 && h.suggestions.length <= 4
      && h.suggestions.includes('How do I handle pre-game nerves?'), h.suggestions);
    check('home: suggested excludes today and picks', h.suggested.every(d => d.id !== h.today.id && !d.pinned), h.suggested);
    const drops = await api('GET', '/drops', { token: fan });
    check('drops: published, newest first', drops.status === 200 && drops.data.drops.length >= 3
      && drops.data.drops.every((d, i, a) => d.status === 'published' && (i === 0 || a[i - 1].publishedAt >= d.publishedAt)), drops.data);

    const ask = text => api('POST', '/questions', { token: fan, body: { text } });
    const guarded = await ask('Should I bet on the game tonight?');
    check('ask: sensitive → guarded', guarded.status === 201 && guarded.data.question.status === 'guarded'
      && guarded.data.question.note && !guarded.data.question.audioKey, guarded.data);
    for (const text of ['How do I handle pre-game nerves?', 'What have you done since hockey?']) {
      const r = await ask(text);
      check(`ask: instant hit — "${text}"`, r.status === 201 && r.data.question.status === 'instant'
        && r.data.question.answer && r.data.question.audioKey, r.data);
    }
    for (const text of ['How do I stop feeling mediocre at practice?', 'Any tips for battling along the boards?']) {
      const r = await ask(text);
      check(`ask: no false instant hit — "${text}"`, r.status === 201 && r.data.question.status === 'pending'
        && r.data.question.note === PENDING_NOTE, r.data);
      mine[text.includes('mediocre') ? 'mediocre' : 'boards'] = r.data.question?.id;
    }
    check('ask: empty text → 400', isErr(await ask('   '), 400));

    check('fan on a studio route → 403', isErr(await api('GET', '/studio/today', { token: fan }), 403));
    check('athlete on a fan route → 403', isErr(await api('GET', '/home', { token: athlete }), 403));

    const today = await api('GET', '/studio/today', { token: athlete });
    const t = today.data;
    check('studio today', today.status === 200 && t.queueCount >= 2 && t.stats.members >= 1 && t.stats.published >= 3
      && ['membersWeek', 'answeredPct', 'medianReplyHours', 'listensWeek'].every(k => k in t.stats)
      && t.draftDrops.length >= 1 && Array.isArray(t.queued) && t.bioStatus === 'approved', t);
    const queue = await api('GET', '/studio/queue', { token: athlete });
    const q = queue.data.questions || [];
    const qm = q.find(x => x.id === mine.mediocre);
    check('studio queue: the fan\'s pending question', queue.status === 200 && qm && qm.kind === 'fan' && qm.fanName === 'Smoke Test'
      && typeof qm.drafting === 'boolean' && ['claude', 'none'].includes(qm.draftSource), qm || q);
    check('studio queue: starters carry their drafts', q.some(x => x.kind === 'starter' && x.fanName === null && x.draftSource === 'starter' && x.draft), q);
    check('studio queue: oldest first', q.every((x, i) => i === 0 || q[i - 1].createdAt <= x.createdAt));
    const settings = await api('GET', '/studio/settings', { token: athlete });
    check('studio settings', settings.status === 200 && ['paused', 'guardTopics', 'guardDecline'].every(k => typeof settings.data[k] === 'boolean'), settings.data);
    const prompts = await api('GET', '/studio/prompts', { token: athlete });
    const p = prompts.data;
    check('studio prompts', prompts.status === 200 && p.prompts.some(x => x.id === 'free') && p.prompts.some(x => x.src === 'STARTER PROMPT')
      && p.prompts.some(x => x.src === 'FANS ARE ASKING' && x.id === 'fan-' + mine.mediocre)
      && p.coverage.length === 6 && p.coverage.every(c => typeof c.pct === 'number' && c.pct >= 0 && c.pct <= 100), p);
    const bio = await api('GET', '/studio/bio', { token: athlete });
    check('studio bio', bio.status === 200 && bio.data.status === 'approved' && bio.data.audioKey, bio.data);
    const sdrops = await api('GET', '/studio/drops', { token: athlete });
    check('studio drops', sdrops.status === 200 && sdrops.data.drafts.length >= 1 && sdrops.data.published.length >= 3, sdrops.data);

    const story = await api('POST', '/studio/stories', { token: athlete, body: {
      promptId: 'sp-skates', title: 'Smoke test story', transcript: 'A short smoke-test transcript.', duration: 3.5, audio: null } });
    check('story: create', story.status === 200 && story.data.story.id && story.data.story.promptId === 'sp-skates', story.data);
    const stories = await api('GET', '/studio/stories', { token: athlete });
    check('story: listed newest first', stories.data.stories[0]?.id === story.data.story?.id, stories.data);
    const promptsAfter = await api('GET', '/studio/prompts', { token: athlete });
    check('story: its prompt is no longer offered', !promptsAfter.data.prompts.some(x => x.id === 'sp-skates'));
    check('story: delete', (await api('DELETE', '/studio/stories/' + story.data.story?.id, { token: athlete })).data.ok === true);
    check('story: gone', !(await api('GET', '/studio/stories', { token: athlete })).data.stories.some(s => s.id === story.data.story?.id));

    if (!cfg.data.drafting) {
      check('revise without drafting → 503', isErr(await api('POST', `/studio/questions/${mine.mediocre}/revise`,
        { token: athlete, body: { text: '', note: 'keep it short' } }), 503));
    }

    // approve the fan's pending question with an edited answer
    let answer = REPLY;
    if (voice) {
      const prev = await api('POST', '/studio/preview', { token: athlete, body: { text: REPLY } });
      check('preview renders in her voice', prev.status === 200 && /^[0-9a-f]{40}$/.test(prev.data.audioKey) && prev.data.duration > 0, prev.data);
    } else {
      check('preview of new text without voice → 503', isErr(await api('POST', '/studio/preview', { token: athlete, body: { text: REPLY } }), 503));
      const prev = await api('POST', '/studio/preview', { token: athlete, body: { text: STARTER_REPLY } });
      check('preview of a pre-rendered starter works without voice', prev.status === 200 && prev.data.audioKey && prev.data.duration > 0, prev.data);
      check('approve new text without voice → 503', isErr(await api('POST', `/studio/questions/${mine.mediocre}/approve`, { token: athlete, body: { text: REPLY } }), 503));
      const still = (await api('GET', '/questions', { token: fan })).data.questions.find(x => x.id === mine.mediocre);
      check('failed approval leaves the question pending', still?.status === 'pending', still);
      answer = STARTER_REPLY;
    }
    const approved = await api('POST', `/studio/questions/${mine.mediocre}/approve`, { token: athlete, body: { text: answer } });
    check('approve the fan\'s question', approved.status === 200 && approved.data.ok === true && approved.data.audioKey && approved.data.duration > 0, approved.data);
    check('approve twice → 409', isErr(await api('POST', `/studio/questions/${mine.mediocre}/approve`, { token: athlete, body: { text: answer } }), 409));

    const thread = await api('GET', '/questions', { token: fan });
    const answered = thread.data.questions.find(x => x.id === mine.mediocre);
    check('fan thread: answered with audio', answered?.status === 'answered' && answered.answer === answer
      && answered.audioKey === approved.data.audioKey && answered.answeredAt >= answered.createdAt && answered.note === null, answered);
    check('fan thread: oldest first, not paused', thread.data.paused === false
      && thread.data.questions.every((x, i, a) => i === 0 || a[i - 1].createdAt <= x.createdAt));

    const audio = await api('GET', '/audio/' + approved.data.audioKey, { token: fan });
    const head = audio.data;
    check('audio: audio/mpeg bytes', audio.status === 200 && audio.headers.get('content-type') === 'audio/mpeg' && head.length > 10000
      && ((head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)),
    { status: audio.status, type: audio.headers.get('content-type'), bytes: head.length });
    const ranged = await api('GET', '/audio/' + approved.data.audioKey, { token: fan, headers: { range: 'bytes=0-1' } });
    check('audio: byte ranges (AVPlayer)', ranged.status === 206 && ranged.data.length === 2
      && ranged.headers.get('content-range') === `bytes 0-1/${head.length}`, { status: ranged.status, range: ranged.headers.get('content-range') });
    check('audio: needs a token', (await api('GET', '/audio/' + approved.data.audioKey)).status === 401);
    check('audio: unknown key → 404', isErr(await api('GET', '/audio/' + '0'.repeat(40), { token: fan }), 404));

    const again = await ask('How do I stop feeling mediocre at practice?');
    check('approved answer joins the instant library', again.data.question?.status === 'instant' && again.data.question.audioKey === approved.data.audioKey, again.data);

    const notifs = await api('GET', '/notifications', { token: fan });
    const n0 = notifs.data.notifications?.[0];
    check('notification: "Angela answered you", unread', notifs.status === 200 && notifs.data.unread >= 1 && n0?.text === 'Angela answered you'
      && n0.sub === 'How do I stop feeling mediocre at practice?' && n0.link === 'ask' && n0.read === false, notifs.data);
    await api('POST', '/notifications/read', { token: fan });
    const read = await api('GET', '/notifications', { token: fan });
    check('notifications: marked read', read.data.unread === 0 && read.data.notifications.every(n => n.read), read.data);

    const saved = await api('POST', `/questions/${mine.mediocre}/save`, { token: fan, body: { saved: true } });
    check('save a reply', saved.status === 200 && saved.data.question.saved === true, saved.data);

    const l1 = await api('POST', `/drops/${h.today.id}/listen`, { token: fan });
    const l2 = await api('POST', `/drops/${h.today.id}/listen`, { token: fan });
    check('drop listen is idempotent per fan', l1.status === 200 && l1.data.listens >= 1 && l2.data.listens === l1.data.listens, [l1.data, l2.data]);
    check('home: today now listened', (await api('GET', '/home', { token: fan })).data.today.listened === true);

    check('decline', (await api('POST', `/studio/questions/${mine.boards}/decline`, { token: athlete })).data.ok === true);
    const declined = (await api('GET', '/questions', { token: fan })).data.questions.find(x => x.id === mine.boards);
    check('fan thread: declined with note', declined?.status === 'declined' && /passed on this one/.test(declined.note), declined);

    const pause = await api('PATCH', '/studio/settings', { token: athlete, body: { paused: true } });
    paused = pause.data.paused === true;
    check('pause', paused, pause.data);
    check('ask while paused → 409', isErr(await ask('Are you still answering questions?'), 409));
    check('thread reports paused', (await api('GET', '/questions', { token: fan })).data.paused === true);
    const unpause = await api('PATCH', '/studio/settings', { token: athlete, body: { paused: false } });
    paused = unpause.data.paused !== false;
    check('unpause', !paused, unpause.data);

    if (isLocal) {
      console.log('  -- local instance: drops, cron, starter approval');
      await dropsAndCron(athlete, fan);
      await angelaTenant();
    }
  } finally {
    if (paused && athlete) await api('PATCH', '/studio/settings', { token: athlete, body: { paused: false } });
    const del = await api('DELETE', '/me', { token: fan });
    check('DELETE /me removes the fan', del.status === 200 && del.data.ok === true, del.data);
    check('deleted fan\'s token → 401', (await api('GET', '/me', { token: fan })).status === 401);
    if (athlete) {
      const q = (await api('GET', '/studio/queue', { token: athlete })).data.questions || [];
      check('fan\'s questions are gone from the queue', !q.some(x => x.fanName === 'Smoke Test'));
      const lib = await api('POST', '/auth/fan', { body: { code: 'REVIEW' } });
      if (lib.data.token) {
        const r = await api('POST', '/questions', { token: lib.data.token, body: { text: 'How do I stop feeling mediocre at practice?' } });
        check('fan\'s library entry is gone', r.data.question?.status === 'pending', r.data);
        await api('DELETE', '/me', { token: lib.data.token });
      }
      const after = await tenantSnapshot(athlete);
      check('review tenant is left exactly as it was found', JSON.stringify(after) === JSON.stringify(before), { before, after });
      await api('POST', '/auth/signout', { token: athlete });
      check('signed-out athlete token → 401', (await api('GET', '/studio/today', { token: athlete })).status === 401);
    }
  }

  console.log(`\n${passed} passed, ${failed.length} failed`);
  if (failed.length) console.log('failed: ' + failed.join(' · '));
  process.exit(failed.length ? 1 : 0);
}

// what fans and the studio can see of the tenant: queue, drops, settings, prompts, library coverage
async function tenantSnapshot(athlete) {
  const get = async p => (await api('GET', p, { token: athlete })).data;
  const [queue, drops, settings, prompts, bio] = await Promise.all(
    ['/studio/queue', '/studio/drops', '/studio/settings', '/studio/prompts', '/studio/bio'].map(get));
  const ids = list => list.map(d => `${d.id}${d.pinned ? '*' : ''}`);
  return {
    queue: queue.questions.map(q => q.id), drafts: ids(drops.drafts), queued: ids(drops.queued), published: ids(drops.published),
    settings, prompts: prompts.prompts.map(p => p.id), coverage: prompts.coverage, bio: [bio.status, bio.audioKey],
  };
}

const runCron = () => fetch(origin + '/__scheduled?cron=0+14+*+*+*');   // wrangler dev --test-scheduled

// seeded starter drafts have pre-rendered clips, so their scripts approve without a fresh render
const starterDrafts = drops => drops.drafts.filter(d => d.source.startsWith('Starter draft'));

async function dropsAndCron(athlete, fan) {
  const seeded = starterDrafts((await api('GET', '/studio/drops', { token: athlete })).data);
  if (!check('local: seeded draft drops to work with', seeded.length >= 2, seeded.length)) return;
  const create = async (title, script) => (await api('POST', '/studio/drops', { token: athlete, body: { title, script } })).data.drop;

  const queued = await create('Smoke queued drop', seeded[0].script);
  check('drop: create a draft', queued?.status === 'draft' && queued.source === 'Your draft' && queued.queuePos === null, queued);
  const q = await api('POST', `/studio/drops/${queued.id}/approve`, { token: athlete, body: {} });
  check('drop: approve → queued', q.data.drop?.status === 'queued' && q.data.drop.queuePos >= 1 && q.data.drop.audioKey, q.data);
  const pin = await api('POST', `/studio/drops/${queued.id}/pin`, { token: athlete, body: { pinned: true } });
  check('drop: pin', pin.data.drop?.pinned === true, pin.data);
  check('drop: queued drops stay off the fan feed', !(await api('GET', '/drops', { token: fan })).data.drops.some(d => d.id === queued.id));

  const unreadBefore = (await api('GET', '/notifications', { token: fan })).data.unread;
  const live = await create('Smoke draft title', seeded[1].script);
  const pub = await api('POST', `/studio/drops/${live.id}/approve`, { token: athlete, body: { title: 'Smoke published drop', publishNow: true } });
  check('drop: approve with publishNow (and a new title) → published', pub.data.drop?.status === 'published'
    && pub.data.drop.title === 'Smoke published drop' && pub.data.drop.publishedAt > 0, pub.data);
  const feed = (await api('GET', '/notifications', { token: fan })).data;
  check('drop: one broadcast "New drop" reaches the fan', feed.unread === unreadBefore + 1
    && feed.notifications[0]?.text === 'New drop: Smoke published drop' && feed.notifications[0].link === 'drop:' + live.id, feed);
  check('drop: the new drop is today', (await api('GET', '/home', { token: fan })).data.today?.id === live.id);
  check('drop: approve a published drop → 409', isErr(await api('POST', `/studio/drops/${live.id}/approve`, { token: athlete, body: {} }), 409));

  const today = (await api('GET', '/studio/today', { token: athlete })).data;
  check('studio today: nextPublishAt keeps the 20 h gap, at 14:00 UTC', today.queued.some(d => d.id === queued.id)
    && today.nextPublishAt - pub.data.drop.publishedAt >= DAY_GAP && new Date(today.nextPublishAt).getUTCHours() === 14, today);
  await runCron();
  const afterCron = (await api('GET', '/studio/drops', { token: athlete })).data;
  check('cron: holds the queue within 20 h of a publish', afterCron.queued.some(d => d.id === queued.id), afterCron.queued);

  for (const d of [queued, live]) await api('POST', `/studio/drops/${d.id}/reject`, { token: athlete });
  const after = (await api('GET', '/studio/drops', { token: athlete })).data;
  check('drop: rejected drops disappear, published ones too', ![...after.drafts, ...after.queued, ...after.published].some(d => d.id === queued.id || d.id === live.id));
  const fanView = await api('GET', '/notifications', { token: fan });
  check('drop: unpublishing withdraws its "New drop" notification', !fanView.data.notifications.some(n => n.link === 'drop:' + live.id), fanView.data);
}

// The real tenant, only with its (local) key: the cron's publish path, and approving a starter.
async function angelaTenant() {
  const key = process.env.STRIVE_TEST_KEY_ANGELA;
  if (!key) return console.log('  skip  cron publish + starter approval (set STRIVE_TEST_KEY_ANGELA)');
  const ath = (await api('POST', '/auth/athlete', { body: { key } })).data.token;
  const fanA = (await api('POST', '/auth/fan', { body: { code: 'ANGELA' } })).data.token;
  if (!check('local: angela tenant sign-ins', ath && fanA)) return;
  try {
    const drops = (await api('GET', '/studio/drops', { token: ath })).data;
    const d = (await api('POST', '/studio/drops', { token: ath, body: { title: 'Smoke cron drop', script: starterDrafts(drops)[0].script } })).data.drop;
    await api('POST', `/studio/drops/${d.id}/approve`, { token: ath, body: {} });
    const due = Date.now() - Math.max(0, ...drops.published.map(x => x.publishedAt)) >= DAY_GAP;
    await runCron();
    const published = (await api('GET', '/studio/drops', { token: ath })).data.published.some(x => x.id === d.id);
    if (due) {
      check('cron: publishes the next queued drop', published);
      const n = (await api('GET', '/notifications', { token: fanA })).data.notifications[0];
      check('cron: broadcasts "New drop"', n?.text === 'New drop: Smoke cron drop' && n.link === 'drop:' + d.id, n);
    } else {
      check('cron: holds the queue within 20 h of a publish', !published);
    }
    await api('POST', `/studio/drops/${d.id}/reject`, { token: ath });

    const s = (await api('GET', '/studio/queue', { token: ath })).data.questions.find(x => x.kind === 'starter' && x.draftSource === 'starter');
    if (!s) return console.log('  skip  starter approval (none pending)');
    const r = await api('POST', `/studio/questions/${s.id}/approve`, { token: ath, body: { text: s.draft } });
    check('starter: approve its unedited draft from the stored clip', r.status === 200 && r.data.audioKey, r.data);
    const hit = (await api('POST', '/questions', { token: fanA, body: { text: s.text } })).data.question;
    check('starter: its question now answers instantly', hit?.status === 'instant' && hit.audioKey === r.data.audioKey, hit);
    check('starter: approving notifies nobody', !(await api('GET', '/notifications', { token: fanA })).data.notifications.some(n => n.link === 'ask'));
  } finally {
    await api('DELETE', '/me', { token: fanA });
    await api('POST', '/auth/signout', { token: ath });
  }
}

main().catch(e => { console.error(e); process.exit(1); });

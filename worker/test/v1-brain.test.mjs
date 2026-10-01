#!/usr/bin/env node
/* Coach Angela's brain in the real /v1 question flow, end to end, against a LOCAL instance whose
   Claude is test/mock-anthropic.mjs — no key, no spend:
     STRIVE_TEST_KEY_ANGELA=<random> STRIVE_TEST_KEY_REVIEW=<random> STRIVE_LOCAL_BRAIN=mock scripts/local-up.sh
     STRIVE_TEST_KEY_REVIEW=<same> node test/v1-brain.test.mjs
     scripts/local-down.sh
   Covers: `drafting` while the brain runs · crisis first (never reaches Claude, even with a key) ·
   autopilot on + grounded answer → answered by "coach", voiced, cited, fan notified · the brain's
   inputs (the fan's thread, her approved answers) · autopilot off → pending with Coach Angela's draft,
   sources, confidence and reason · decline → guarded with its redirect · a failed voice render, an
   API error and autopilot switched off mid-flight all fall back to review · /v1/studio/coach ·
   keep (→ reviewed + library) · retract (→ pending + note, audio withdrawn, library entry gone, 409s).
   The autopilot reply is a starter answer whose clip local-up loads into KV, so it is voiced without a
   Fish key; anything else an autopilot answer says fails to render locally (that's case "nagano").
   Touches only the angela-review tenant and leaves it exactly as it found it. */

import { CRISIS_TEXT } from '../src/brain.js';
import { MOCK_REPLIES } from './mock-anthropic.mjs';

let base = (process.env.STRIVE_API_BASE || 'http://127.0.0.1:8787').replace(/\/+$/, '');
if (!base.endsWith('/v1')) base += '/v1';
const origin = new URL(base).origin;
const MOCK = (process.env.STRIVE_MOCK_URL || `http://127.0.0.1:${process.env.STRIVE_MOCK_PORT || 8789}`).replace(/\/+$/, '');
const PENDING_NOTE = "With Angela — she reviews every answer before it's sent.";
const RETRACT_NOTE = 'Angela is taking another look at this one.';
const NO_SCRIPT = 'Let me get Angela on this one.';   // the mock's default review reply

const sleep = ms => new Promise(r => setTimeout(r, ms));
const die = msg => { console.error('v1-brain: ' + msg); process.exit(2); };

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
  return { status: res.status, data: isJson ? await res.json() : new Uint8Array(await res.arrayBuffer()), headers: res.headers };
}
const isErr = (r, status) => r.status === status && typeof r.data.error === 'string' && r.data.error.length > 0;
const mock = async () => (await fetch(MOCK + '/__requests')).json();

async function main() {
  console.log(`Coach Angela brain × /v1 → ${base} (mock Claude at ${MOCK})`);
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) die('local instances only — this flips the review tenant\'s autopilot on.');
  const key = process.env.STRIVE_TEST_KEY_REVIEW || die('set STRIVE_TEST_KEY_REVIEW to the key you gave scripts/local-up.sh');
  let calls0;
  try { calls0 = (await mock()).count; } catch { die(`no mock Claude API at ${MOCK} — start the server with STRIVE_LOCAL_BRAIN=mock scripts/local-up.sh`); }
  const cfg = (await api('GET', '/config')).data;
  if (!cfg.drafting || !cfg.autopilot) die('the server has no brain key or isn\'t in grounded mode — start it with STRIVE_LOCAL_BRAIN=mock scripts/local-up.sh');

  const athlete = (await api('POST', '/auth/athlete', { body: { key } })).data.token || die('athlete sign-in failed (wrong STRIVE_TEST_KEY_REVIEW?)');
  const fan = (await api('POST', '/auth/fan', { body: { code: 'REVIEW', name: 'Brain Test' } })).data.token || die('fan sign-in failed');
  let fan2 = null;
  const before = await tenantSnapshot(athlete);
  const autopilotWas = before.settings.autopilot;

  const ask = (token, text) => api('POST', '/questions', { token, body: { text } });
  const fanQ = async (token, id) => (await api('GET', '/questions', { token })).data.questions.find(x => x.id === id);
  const queueItem = async id => (await api('GET', '/studio/queue', { token: athlete })).data.questions.find(x => x.id === id);
  const coachList = async () => (await api('GET', '/studio/coach', { token: athlete })).data.answers;
  const setAutopilot = async on => {
    const r = await api('PATCH', '/studio/settings', { token: athlete, body: { autopilot: on } });
    if (r.data.autopilot !== on) throw new Error('could not set autopilot ' + on);
  };
  // until the brain is done with it: the question left 'pending', or her queue no longer shows it drafting
  async function settle(token, id) {
    for (const t0 = Date.now(); Date.now() - t0 < 20e3; await sleep(150)) {
      const q = await fanQ(token, id);
      if (!q) throw new Error('question vanished: ' + id);
      if (q.status !== 'pending') return { q };
      const s = await queueItem(id);
      if (s && !s.drafting) return { q, s };
    }
    throw new Error('the brain never settled on ' + id);
  }
  const coachNotices = async token => (await api('GET', '/notifications', { token })).data.notifications.filter(n => n.text === 'Coach Angela answered');

  try {
    await setAutopilot(false);

    console.log('-- drafting, and the worker really talks to the mock');
    const slow = await ask(fan, 'slow one: how long should my warm-up be?');
    const sq = slow.data.question;
    check('ask → 201 pending, with the usual note', slow.status === 201 && sq?.status === 'pending' && sq.note === PENDING_NOTE
      && sq.answeredBy === null && sq.sources.length === 0, slow.data);
    const during = await queueItem(sq?.id);
    check('studio queue: drafting while the brain runs', during?.drafting === true && during.draftSource === 'none', during);
    const s0 = await settle(fan, sq.id);
    check('the brain call went to the mock', (await mock()).count > calls0);
    check('review: Coach Angela\'s reply is the draft, drafting cleared', s0.q.status === 'pending' && s0.s?.drafting === false
      && s0.s.draftSource === 'coach' && s0.s.draft === NO_SCRIPT && s0.s.confidence === 0.3 && s0.s.reason === 'No script'
      && Array.isArray(s0.s.sources) && s0.s.sources.length === 0, s0);

    console.log('-- crisis first');
    const calls1 = (await mock()).count;
    const crisis = await ask(fan, 'Honestly I want to kill myself after tryouts');
    const cq = crisis.data.question;
    check('crisis → guarded with the safety message, never voiced', crisis.status === 201 && cq?.status === 'guarded' && cq.note === CRISIS_TEXT
      && cq.answer === null && cq.audioKey === null && cq.answeredBy === null && cq.sources.length === 0, crisis.data);
    await sleep(400);
    check('crisis never reaches Claude, even with a key', (await mock()).count === calls1);
    check('crisis stays out of her queue', !(await queueItem(cq?.id)));
    check('crisis: the thread keeps the safety message', (await fanQ(fan, cq?.id))?.note === CRISIS_TEXT);

    console.log('-- autopilot on: a grounded answer goes out as Coach Angela');
    await setAutopilot(true);
    const Q1 = 'Autopilot check: what do you tell yourself on the bench?';
    const a1 = await ask(fan, Q1);
    const id1 = a1.data.question?.id;
    check('autopilot ask → 201 pending at first', a1.status === 201 && a1.data.question.status === 'pending', a1.data);
    const r1 = (await settle(fan, id1)).q;
    if (r1.status === 'pending') console.log('        (still pending: was its clip missing from KV? reason → ' + (await queueItem(id1))?.reason + ')');
    check('autopilot: answered, answeredBy coach', r1.status === 'answered' && r1.answeredBy === 'coach' && r1.answer === MOCK_REPLIES.PRE_RENDERED
      && r1.note === null && r1.answeredAt >= r1.createdAt, r1);
    check('autopilot: voiced', /^[0-9a-f]{40}$/.test(r1.audioKey || '') && r1.duration > 0, r1);
    check('autopilot: cited sources {id, title, url}', r1.sources?.length === 1
      && r1.sources.every(s => typeof s.id === 'string' && typeof s.title === 'string' && /^https?:\/\//.test(s.url)), r1.sources);
    const audio = await api('GET', '/audio/' + r1.audioKey, { token: fan, headers: { origin: 'http://localhost:8642' } });
    check('autopilot: the fan can play it (and the browser may read it)', audio.status === 200 && audio.headers.get('content-type') === 'audio/mpeg'
      && audio.data.length > 10000 && audio.headers.get('access-control-allow-origin') === 'http://localhost:8642');
    const n1 = (await api('GET', '/notifications', { token: fan })).data;
    check('autopilot: fan notified "Coach Angela answered"', n1.notifications[0]?.text === 'Coach Angela answered' && n1.notifications[0].sub === Q1
      && n1.notifications[0].link === 'ask' && n1.notifications[0].read === false && n1.unread >= 1, n1);
    check('autopilot: not in her queue', !(await queueItem(id1)));
    const c1 = (await coachList()).find(x => x.id === id1);
    check('studio coach: lists it, unreviewed, with what went out', c1?.reviewed === false && c1.text === Q1 && c1.answer === r1.answer
      && c1.fanName === 'Brain Test' && c1.confidence === 0.9 && c1.sources.length === 1 && c1.answeredAt === r1.answeredAt
      && c1.audioKey === r1.audioKey, c1);
    check('fan on /studio/coach → 403', isErr(await api('GET', '/studio/coach', { token: fan }), 403));

    console.log('-- autopilot off: Coach Angela drafts, Angela decides; what the brain was given');
    await setAutopilot(false);
    const Q2 = 'Autopilot check: how do you stay calm on the bench?';
    const a2 = await ask(fan, Q2);
    const id2 = a2.data.question?.id;
    const s2 = await settle(fan, id2);
    check('autopilot off: still pending for the fan', s2.q.status === 'pending' && s2.q.note === PENDING_NOTE && s2.q.answeredBy === null
      && s2.q.audioKey === null, s2.q);
    check('autopilot off: coach draft with sources, confidence and the reason', s2.s?.draftSource === 'coach' && s2.s.draft === MOCK_REPLIES.PRE_RENDERED
      && s2.s.drafting === false && /Angela has autopilot off/.test(s2.s.reason) && s2.s.confidence === 0.9 && s2.s.sources.length === 1
      && typeof s2.s.sources[0].url === 'string', s2.s);
    const sent = (await mock()).requests.at(-1).messages[0].content;
    check('brain input: the question', sent.includes(`<fan_question>${Q2}</fan_question>`), sent.slice(-300));
    check('brain input: the fan\'s thread, oldest first, with Coach Angela\'s answer',
      /<chat_history>\nFan: slow one: how long should my warm-up be\?\nFan: Autopilot check: what do you tell yourself on the bench\?\nCoach Angela: Short memory, long habits\.[^\n]*\n<\/chat_history>/.test(sent),
      (sent.match(/<chat_history>[\s\S]*<\/chat_history>/) || ['(no history)'])[0]);
    check('brain input: crisis and guardrail turns left out', !/kill myself/.test(sent));
    const approvedCount = (sent.match(/A \(approved by Angela\):/g) || []).length;
    check('brain input: her approved answers (1–10)', /<approved_answers>/.test(sent) && approvedCount >= 1 && approvedCount <= 10, approvedCount);

    console.log('-- decline');
    const a3 = await ask(fan, "What's your home address?");
    const r3 = (await settle(fan, a3.data.question?.id)).q;
    check('decline → guarded, Coach Angela\'s redirect as the note, not voiced', r3.status === 'guarded' && r3.note === MOCK_REPLIES.DECLINE
      && r3.answer === null && r3.audioKey === null && r3.answeredBy === null, r3);
    check('decline stays out of her queue', !(await queueItem(r3.id)));

    console.log('-- fallbacks to review');
    await setAutopilot(true);
    const a4 = await ask(fan, 'What did Nagano teach you?');
    const s4 = await settle(fan, a4.data.question?.id);
    check('autopilot answer whose voice render fails → review, with why', a4.data.question?.status === 'pending' && s4.q.status === 'pending'
      && s4.s?.draftSource === 'coach' && /Voice render failed/.test(s4.s.reason) && s4.s.sources.length === 1, s4);
    check('…and the fan wasn\'t notified', (await coachNotices(fan)).length === 1);
    const a5 = await ask(fan, 'apierror: what should I eat before a game?');
    const s5 = await settle(fan, a5.data.question?.id);
    check('API error → pending, drafting cleared, empty draft, a reason', s5.q.status === 'pending' && s5.s?.drafting === false && s5.s.draft === ''
      && s5.s.draftSource === 'none' && s5.s.confidence === null && typeof s5.s.reason === 'string' && s5.s.reason.length > 0, s5.s);
    fan2 = (await api('POST', '/auth/fan', { body: { code: 'REVIEW', name: 'Brain Test 2' } })).data.token;
    const a6 = await ask(fan2, 'slow autopilot check: how do you prep the night before?');
    await sleep(300);
    await setAutopilot(false);   // while the brain is still thinking
    const s6 = await settle(fan2, a6.data.question?.id);
    check('autopilot switched off mid-flight → review, nothing sent', s6.q.status === 'pending' && s6.s?.draftSource === 'coach'
      && /switched off/.test(s6.s.reason) && (await coachNotices(fan2)).length === 0, s6);

    console.log('-- keep');
    check('keep → ok', (await api('POST', `/studio/questions/${id1}/keep`, { token: athlete })).data.ok === true);
    check('keep again is harmless', (await api('POST', `/studio/questions/${id1}/keep`, { token: athlete })).data.ok === true);
    check('studio coach: kept → reviewed', (await coachList()).find(x => x.id === id1)?.reviewed === true);
    check('fan thread: still Coach Angela\'s cited answer', (await fanQ(fan, id1))?.answeredBy === 'coach');
    const lib = await ask(fan2, Q1);
    check('a kept answer answers the next fan instantly, from the library', lib.data.question?.status === 'instant'
      && lib.data.question.answeredBy === 'library' && lib.data.question.audioKey === r1.audioKey && lib.data.question.sources.length === 0, lib.data);

    console.log('-- retract');
    check('retract → ok', (await api('POST', `/studio/questions/${id1}/retract`, { token: athlete })).data.ok === true);
    const back = await fanQ(fan, id1);
    check('retract: the fan sees it pending with the note; answer and audio withdrawn', back?.status === 'pending' && back.note === RETRACT_NOTE
      && back.answer === null && back.audioKey === null && back.duration === null && back.answeredAt === null && back.answeredBy === null
      && back.sources.length === 0, back);
    const item = await queueItem(id1);
    check('retract: back in her queue, old answer as the draft', item?.draftSource === 'coach' && item.draft === MOCK_REPLIES.PRE_RENDERED
      && item.drafting === false && /retracted/i.test(item.reason) && item.sources.length === 1 && item.fanName === 'Brain Test', item);
    check('retract: gone from the coach list', !(await coachList()).some(x => x.id === id1));
    check('retract again → 409', isErr(await api('POST', `/studio/questions/${id1}/retract`, { token: athlete }), 409));
    check('keep a retracted answer → 409', isErr(await api('POST', `/studio/questions/${id1}/keep`, { token: athlete }), 409));
    const relib = await ask(fan2, Q1);
    check('retract: its library entry is gone too', relib.data.question?.status === 'pending', relib.data);
    await settle(fan2, relib.data.question?.id);

    console.log('-- after a retract, Angela answers it herself');
    const ap = await api('POST', `/studio/questions/${id1}/approve`, { token: athlete, body: { text: item.draft } });
    check('approve the retracted question → ok', ap.status === 200 && ap.data.audioKey === r1.audioKey, ap.data);
    const mineNow = await fanQ(fan, id1);
    check('fan thread: answeredBy angela, note cleared, no sources', mineNow?.status === 'answered' && mineNow.answeredBy === 'angela'
      && mineNow.note === null && mineNow.sources.length === 0, mineNow);
    for (const [what, id] of [['her own answer', id1], ['a library answer', lib.data.question?.id], ['a pending question', id2], ['a guarded question', cq?.id]]) {
      check(`retract ${what} → 409`, isErr(await api('POST', `/studio/questions/${id}/retract`, { token: athlete }), 409));
    }
    check('keep an unknown question → 404', isErr(await api('POST', '/studio/questions/q_nope/keep', { token: athlete }), 404));

    console.log('-- the coach list is newest first');
    await setAutopilot(true);
    const ids = [];
    for (const text of ['Autopilot check: what is your go-to reset?', 'Autopilot check: one cue for my next shift?']) {
      const r = await ask(fan2, text);
      ids.push(r.data.question?.id);
      await settle(fan2, r.data.question?.id);
    }
    const list = await coachList();
    check('studio coach: newest first', list.length >= 2 && list[0].id === ids[1] && list[1].id === ids[0]
      && list.every((x, i) => i === 0 || list[i - 1].answeredAt >= x.answeredAt), list.map(x => [x.id, x.answeredAt]));

    console.log('-- the demo\'s legacy /ask still works through the brain');
    const legacy = await fetch(origin + '/ask', { method: 'POST', headers: { origin: 'https://billyatminyawns.github.io', 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'What did Nagano teach you?', autopilot: true }) });
    const ld = await legacy.json();
    check('legacy POST /ask → the brain\'s decision', legacy.status === 200 && ld.route === 'answer' && ld.auto === true && ld.mode === 'grounded'
      && legacy.headers.get('access-control-allow-origin') === 'https://billyatminyawns.github.io', ld);
  } finally {
    await api('PATCH', '/studio/settings', { token: athlete, body: { autopilot: autopilotWas } });
    for (const t of [fan, fan2]) {
      if (t) check('cleanup: delete the test fan', (await api('DELETE', '/me', { token: t })).data.ok === true);
    }
    const after = await tenantSnapshot(athlete);
    check('review tenant is left exactly as it was found', JSON.stringify(after) === JSON.stringify(before), { before, after });
    await api('POST', '/auth/signout', { token: athlete });
  }

  console.log(`\n${passed} passed, ${failed.length} failed`);
  if (failed.length) console.log('failed: ' + failed.join(' · '));
  process.exit(failed.length ? 1 : 0);
}

// what fans and the studio can see of the tenant (as in smoke.mjs), plus the coach list
async function tenantSnapshot(athlete) {
  const get = async p => (await api('GET', p, { token: athlete })).data;
  const [queue, drops, settings, prompts, bio, coach] = await Promise.all(
    ['/studio/queue', '/studio/drops', '/studio/settings', '/studio/prompts', '/studio/bio', '/studio/coach'].map(get));
  const ids = list => list.map(d => `${d.id}${d.pinned ? '*' : ''}`);
  return {
    queue: queue.questions.map(q => q.id), drafts: ids(drops.drafts), queued: ids(drops.queued), published: ids(drops.published),
    settings, prompts: prompts.prompts.map(p => p.id), coverage: prompts.coverage, bio: [bio.status, bio.audioKey],
    coach: coach.answers.map(a => a.id),
  };
}

main().catch(e => { console.error(e); process.exit(1); });

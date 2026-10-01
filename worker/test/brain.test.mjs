#!/usr/bin/env node
/* Coach Angela's brain — routing and autopilot-gate tests against a mock Claude (no API key, no
   network). Run from worker/: node test/brain.test.mjs */

import assert from 'node:assert/strict';
import { startMock, MOCK_IDS } from './mock-anthropic.mjs';
import { think, unverifiedTerms, CRISIS_TEXT } from '../src/brain.js';
import BRAIN from '../src/brain-data.js';

const mock = await startMock();
const env = (over = {}) => ({ ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_BASE_URL: mock.url, AUTOPILOT_MODE: 'grounded', AUTOPILOT_MIN_CONFIDENCE: '0.75', ...over });
const GOOD = 'What did Nagano teach you?';

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message.split('\n')[0]); }
}

console.log('brain routing');

await t('crisis language → fixed safety message, never reaches Claude', async () => {
  const before = mock.requests.length;
  const r = await think(env(), { question: 'honestly I want to kill myself after tryouts', autopilot: true });
  assert.equal(r.route, 'crisis');
  assert.equal(r.reply, CRISIS_TEXT);
  assert.equal(mock.requests.length, before);
});

await t('grounded answer + server grounded + Angela autopilot on → auto-sends with resolved sources', async () => {
  const r = await think(env(), { question: GOOD, autopilot: true });
  assert.equal(r.route, 'answer');
  assert.equal(r.auto, true);
  assert.equal(r.sources[0].id, MOCK_IDS.NAGANO);
  assert.match(r.sources[0].url, /^https?:/);
});

await t('server AUTOPILOT_MODE=review → same answer waits for Angela', async () => {
  const r = await think(env({ AUTOPILOT_MODE: 'review' }), { question: GOOD, autopilot: true });
  assert.equal(r.route, 'review');
  assert.equal(r.auto, false);
  assert.match(r.reason, /off on the server/);
  assert.ok(r.reply.length > 40, 'draft still provided');
});

await t('unset AUTOPILOT_MODE defaults to review (safe default)', async () => {
  const r = await think(env({ AUTOPILOT_MODE: undefined }), { question: GOOD, autopilot: true });
  assert.equal(r.route, 'review');
  assert.equal(r.mode, 'review');
});

await t("Angela's studio toggle off → waits for her", async () => {
  const r = await think(env(), { question: GOOD, autopilot: false });
  assert.equal(r.route, 'review');
  assert.match(r.reason, /Angela has autopilot off/);
});

await t('invented year/team/person → blocked as unverified detail', async () => {
  const r = await think(env(), { question: 'invent a story about your best season', autopilot: true });
  assert.equal(r.route, 'review');
  assert.match(r.reason, /Unverified detail/);
  for (const w of ['2003', 'Stanley', 'Toronto', 'Brenda']) assert.ok(r.reason.includes(w), 'flags ' + w);
});

await t('model chose review → review', async () => {
  const r = await think(env(), { question: 'your opinion on the latest IOC ruling?', autopilot: true });
  assert.equal(r.route, 'review');
});

await t('decline → warm redirect, auto', async () => {
  const r = await think(env(), { question: 'who should I bet on tonight', autopilot: true });
  assert.equal(r.route, 'decline');
  assert.ok(r.reply.length > 10);
});

await t('confidence under threshold → review', async () => {
  const r = await think(env(), { question: 'lowconf: how do I bounce back', autopilot: true });
  assert.equal(r.route, 'review');
  assert.match(r.reason, /Confidence 0.40/);
});

await t('no cited source → review', async () => {
  const r = await think(env(), { question: 'nosource: how do I bounce back', autopilot: true });
  assert.equal(r.route, 'review');
  assert.match(r.reason, /No cited source/);
});

await t('medical/betting/legal trigger word overrides an "answer" → review', async () => {
  const r = await think(env(), { question: 'how do you handle an injury mentally?', autopilot: true });
  assert.equal(r.route, 'review');
  assert.match(r.reason, /medical, betting or legal/);
});

await t('refusal → review with no reply (Angela answers herself)', async () => {
  const r = await think(env(), { question: 'refuse this', autopilot: true });
  assert.equal(r.route, 'review');
  assert.equal(r.reply, null);
});

await t('unparseable output → review', async () => {
  const r = await think(env(), { question: 'garbage please', autopilot: true });
  assert.equal(r.route, 'review');
});

console.log('request shape');

await t('cached static system prompt, structured output, fallbacks beta, effort', async () => {
  await think(env(), { question: GOOD, autopilot: true, history: [{ role: 'fan', text: 'hi' }, { role: 'angela', text: 'hey!' }], approved: [{ q: 'Fav drill?', a: 'Two-touch angling walls.' }] });
  const { body, headers } = mock.requests.at(-1);
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.system[0].cache_control.type, 'ephemeral');
  assert.equal(body.system[0].cache_control.ttl, '1h');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.equal(body.output_config.effort, 'medium');
  assert.equal(body.fallbacks, 'default');
  assert.match(String(headers['anthropic-beta']), /server-side-fallback-2026-07-01/);
  const user = body.messages[0].content;
  assert.match(user, /<chat_history>[\s\S]*Fan: hi[\s\S]*<\/chat_history>/);
  assert.match(user, /<approved_answers>[\s\S]*Two-touch[\s\S]*<\/approved_answers>/);
  assert.match(user, /<fan_question>What did Nagano teach you\?<\/fan_question>/);
});

await t('system prompt is byte-identical across requests (cache-safe)', async () => {
  await think(env(), { question: GOOD, autopilot: true });
  await think(env(), { question: 'opinion?', autopilot: false });
  const [a, b] = mock.requests.slice(-2).map(r => r.body.system[0].text);
  assert.equal(a, b);
  for (const e of BRAIN.entries) assert.ok(a.includes(`[${e.id}]`), 'corpus entry in prompt: ' + e.id);
});

await t('fan text is length-capped and history/approved are bounded', async () => {
  const long = 'x'.repeat(1000);
  await think(env(), { question: long, autopilot: true, history: Array(20).fill({ role: 'fan', text: long }), approved: Array(30).fill({ q: 'q', a: long }) });
  const user = mock.requests.at(-1).body.messages[0].content;
  assert.ok(user.length < 12000, 'bounded user turn, got ' + user.length);
  assert.equal((user.match(/^Fan: /gm) || []).length, 6);
});

console.log('unverified-detail check');

await t('grounded terms pass', async () => {
  assert.deepEqual(unverifiedTerms('We won gold at Nagano in 1998, and the Olympics changed me.', 'gold Nagano 1998'), []);
});
await t('sentence-initial capitals are ignored, mid-sentence unknown names flagged', async () => {
  assert.deepEqual(unverifiedTerms('Practice matters. I learned that at Harvard.', 'practice'), ['Harvard']);
});
await t('numbers must appear in grounding', async () => {
  assert.deepEqual(unverifiedTerms('I played 256 games for Team USA.', 'games team usa'), ['256']);
});

await mock.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

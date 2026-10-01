/* Minimal stand-in for POST /v1/messages so the brain can be tested without an API key.
   The reply is chosen by a keyword in the fan question (see SCRIPTS); every request is recorded
   so tests can assert on what the brain actually sent.
   Standalone — scripts/local-up.sh starts it when STRIVE_LOCAL_BRAIN=mock:
     node test/mock-anthropic.mjs [port]     GET /__requests lists what it was sent (system prompt left out) */

import { createServer } from 'node:http';
import BRAIN from '../src/brain-data.js';

// cite real corpus ids so the brain's source/grounding checks run against the actual record
const idWhere = re => (BRAIN.entries.find(e => re.test(e.summary)) || BRAIN.entries[0]).id;
const NAGANO = idWhere(/nagano/i);
const ADVICE = (BRAIN.entries.find(e => e.kind === 'advice') || BRAIN.entries[0]).id;
export const MOCK_IDS = { NAGANO, ADVICE };

// Starter library answers from js/data.js ('kb-reset', 'kb-nerves'). local-up loads their clips into
// KV, so a reply using one can be voiced locally without a Fish key — that is what lets an autopilot
// answer (and approving a mock redraft) go all the way through on a local instance.
const PRE_RENDERED = 'Short memory, long habits. I gave myself one length of the bench to be frustrated — then eyes up, next play. The reset is a skill you train, not a mood you wait for.';
const REDRAFT = 'Nerves mean it matters. The night before gold in Nagano I barely slept — so I stopped chasing calm and built a routine I could do scared: same warm-up, same first touch, one cue word. Borrow mine until you build yours.';
const DECLINE = "That's private, so I keep it off the table. Ask me about training, mindset or leadership instead and I'm all yours.";
export const MOCK_REPLIES = { PRE_RENDERED, REDRAFT, DECLINE };

const ok = (decision) => ({ text: JSON.stringify(decision) });

// keyword in <fan_question> → what "Claude" returns (first match wins)
const SCRIPTS = [
  ['nagano', () => ok({ route: 'answer', reply: 'I was eighteen and the youngest player on the team when we won gold at Nagano in 1998. What I took from it is that preparation beats nerves. Practice like a scout is always in the stands, so the big moment feels like one more rep. What are you doing when nobody is watching?', sources: [NAGANO], confidence: 0.9, topic: 'Mindset', reason: 'Grounded in her Nagano story' })],
  ['invent', () => ok({ route: 'answer', reply: 'In 2003 I won the Stanley Cup in Toronto, and my coach Brenda told me the secret was cold showers before every game. I still swear by that routine today and I think every young defender should try it at least once this season.', sources: [NAGANO], confidence: 0.92, topic: 'Training', reason: 'Personal story' })],
  ['opinion', () => ok({ route: 'review', reply: 'That is a big question and I want to give it a real answer, so let me think about it and come back to you with something better than a hot take. What I can say is that athletes deserve a seat at the table.', sources: [], confidence: 0.5, topic: 'Culture', reason: 'Asks for her view on a current decision' })],
  ['bet', () => ok({ route: 'decline', reply: 'I stay out of betting. Ask me about how to read a play instead and I will happily nerd out with you.', sources: [], confidence: 0.95, topic: 'Other', reason: 'Betting' })],
  ['lowconf', () => ok({ route: 'answer', reply: 'Mistakes are information. Take one breath, look at what the play told you, and get ready for the next shift. The reset is a skill you practice, not a mood you wait for, so rehearse it on purpose when nothing is on the line.', sources: [ADVICE], confidence: 0.4, topic: 'Mindset', reason: 'Loose match' })],
  ['nosource', () => ok({ route: 'answer', reply: 'Mistakes are information. Take one breath, look at what the play told you, and get ready for the next shift. The reset is a skill you practice, not a mood you wait for, so rehearse it on purpose when nothing is on the line.', sources: [], confidence: 0.9, topic: 'Mindset', reason: 'General advice' })],
  ['injury', () => ok({ route: 'answer', reply: 'Mistakes are information, and so is a setback. Take one breath, look at what the play told you, and get ready for the next shift. The reset is a skill you practice, not a mood you wait for, so rehearse it on purpose.', sources: [ADVICE], confidence: 0.9, topic: 'Mindset', reason: 'Mindset after a setback' })],
  ['refuse', () => ({ refusal: true })],
  ['garbage', () => ({ text: 'not json at all' })],
  // /v1 integration (test/v1-brain.test.mjs) — appended so the keywords above keep their precedence
  ['autopilot', () => ok({ route: 'answer', reply: PRE_RENDERED, sources: [ADVICE], confidence: 0.9, topic: 'Mindset', reason: 'Grounded in her advice on resetting' })],
  ['address', () => ok({ route: 'decline', reply: DECLINE, sources: [], confidence: 0.95, topic: 'Other', reason: 'Asks for private information' })],
  ['apierror', () => ({ status: 500 })],
];

export async function startMock({ port = 0 } = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      if (req.method === 'GET' && req.url === '/__requests') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          count: requests.length,
          requests: requests.slice(-20).map(r => ({ model: r.body.model, messages: r.body.messages, structured: !!r.body.output_config?.format })),
        }));
        return;
      }
      if (req.method !== 'POST' || !req.url.startsWith('/v1/messages')) { res.writeHead(404); res.end('{}'); return; }
      const body = JSON.parse(raw || '{}');
      requests.push({ headers: req.headers, body });
      const user = (body.messages || []).map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n');
      const q = ((user.match(/<fan_question>([\s\S]*?)<\/fan_question>/) || [])[1] || '').toLowerCase();
      const hit = SCRIPTS.find(([k]) => q.includes(k));
      // no structured output = src/draft.js (revise): plain text
      const r = !body.output_config?.format ? { text: REDRAFT }
        : hit ? hit[1]() : ok({ route: 'review', reply: 'Let me get Angela on this one.', sources: [], confidence: 0.3, topic: 'Other', reason: 'No script' });
      const send = () => {
        if (r.status) {
          res.writeHead(r.status, { 'content-type': 'application/json', 'request-id': 'req_mock', 'x-should-retry': 'false' });
          res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'Mock API failure' } }));
          return;
        }
        const msg = {
          id: 'msg_mock_' + requests.length, type: 'message', role: 'assistant', model: body.model,
          content: r.refusal ? [] : [{ type: 'text', text: r.text }],
          stop_reason: r.refusal ? 'refusal' : 'end_turn', stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 60 },
        };
        res.writeHead(200, { 'content-type': 'application/json', 'request-id': 'req_mock' });
        res.end(JSON.stringify(msg));
      };
      // 'slow' in the question holds the reply, so a client can watch `drafting` while the brain runs
      if (q.includes('slow')) setTimeout(send, 2500); else send();
    });
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const { port: bound } = server.address();
  return { url: `http://127.0.0.1:${bound}`, requests, close: () => new Promise(r => server.close(r)) };
}

// `node test/mock-anthropic.mjs [port]` runs it standalone (for wrangler dev integration checks)
if (import.meta.url === `file://${process.argv[1]}`) {
  const m = await startMock({ port: Number(process.argv[2]) || 0 });
  console.log(m.url);
}

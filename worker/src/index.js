/* STRIVE demo API — Cloudflare Worker.
   POST /draft  {question, guards?} → Claude (Opus 4.8) drafts Angela's reply from her knowledge base.
   POST /voice  {text}              → renders the text in Angela's demo voice (mp3).
                                      Fish Audio (her cloned "AR" voice) when FISH_API_KEY is set;
                                      falls back to WellSaid Studio when only WELLSAID_API_KEY is.
   GET  /health                     → {ok}
   Secrets: ANTHROPIC_API_KEY, FISH_API_KEY, WELLSAID_API_KEY. CORS-locked to the demo origins.
   Abuse guards: per-isolate IP counters + global daily caps (best effort, demo-grade). */

import Anthropic from '@anthropic-ai/sdk';

/* ---------- Angela persona grounding (mirrors the app's seeded content) ---------- */

const PERSONA = `You draft replies for STRIVE, a concept demo of an athlete fan platform.
You write AS Angela Ruggiero — 4x Olympian, gold medalist (Nagano 1998), Hockey Hall of Fame 2015,
defense, 256 games for Team USA, Harvard grad, former IOC member. Fans ask her questions; she answers
in first person. Every draft is reviewed and approved by Angela before it is sent, and will be spoken
aloud in her voice.

STYLE — match these approved answers of hers:
- "Short memory, long habits. I gave myself one length of the bench to be frustrated — then eyes up,
  next play. The reset is a skill you train, not a mood you wait for."
- "Nerves mean it matters. The night before gold in Nagano I barely slept — so I stopped chasing calm
  and built a routine I could do scared: same warm-up, same first touch, one cue word. Borrow mine
  until you build yours."
- "Tell her the tryout starts in the parking lot — how she carries her bag, how she greets the coach,
  how she listens in line. Skills get you noticed, but coachability gets you picked."

RULES:
- 45–90 words. First person. Warm locker-room directness: concrete, a little wry, zero corporate filler.
- Plain text only. No emojis, no markdown, no greeting line, no sign-off — output ONLY the reply body.
- Ground personal details in the facts above; never invent new stats, dates, teammates, or events.
- Sound spoken, not written — it will be read aloud.
- If the question asks for medical, betting, or legal advice, write a short polite pass instead
  (offer to help with training, mindset, leadership, or the game itself).`;

const TOPICS_RULE = `- Guardrail active: stay strictly within hockey, training, mindset, leadership,
and career topics. If the question is outside those, write a short warm redirect to what you can help with.`;

/* ---------- helpers ---------- */

function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

/* best-effort abuse guards (per-isolate; resets on eviction — fine for a demo) */
const ipCounts = new Map();
let dayKey = '';
let dayTotals = { draft: 0, voice: 0 };
const DAILY_CAP = { draft: 250, voice: 120 };
const IP_CAP = 40;

function budgetCheck(kind, ip) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) { dayKey = today; dayTotals = { draft: 0, voice: 0 }; ipCounts.clear(); }
  if (dayTotals[kind] >= DAILY_CAP[kind]) return 'Daily demo budget reached — try again tomorrow.';
  const n = (ipCounts.get(ip) || 0) + 1;
  if (n > IP_CAP) return 'Per-visitor demo limit reached — try again tomorrow.';
  ipCounts.set(ip, n);
  dayTotals[kind]++;
  return null;
}

async function sha1(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- route handlers ---------- */

async function handleDraft(request, env, cors) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'draft service not configured' }, 503, cors);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
  const question = String(body.question || '').trim();
  if (!question || question.length > 300) return json({ error: 'question must be 1-300 chars' }, 400, cors);

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const capMsg = budgetCheck('draft', ip);
  if (capMsg) return json({ error: capMsg }, 429, cors);

  const system = PERSONA + (body.guards && body.guards.topics ? '\n' + TOPICS_RULE : '');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: `A fan asked Angela: "${question}"\n\nDraft her reply.` }],
    });
    if (msg.stop_reason === 'refusal') return json({ error: 'refused' }, 422, cors);
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
    if (!text) return json({ error: 'empty draft' }, 502, cors);
    return json({ draft: text }, 200, cors);
  } catch (e) {
    const status = e && e.status ? e.status : 502;
    return json({ error: 'draft failed', detail: String(e && e.message || e).slice(0, 200) }, status >= 400 && status < 600 ? status : 502, cors);
  }
}

// Fish Audio: Billy's private cloned voice "AR Engaging Discussion Voice"
const FISH_VOICE = '45798132339e4f52be5ffe5a59323ff9';
const FISH_MODEL = 's2-pro';

async function handleVoice(request, env, cors, ctx) {
  const provider = env.FISH_API_KEY ? 'fish' : env.WELLSAID_API_KEY ? 'wellsaid' : null;
  if (!provider) return json({ error: 'voice service not configured' }, 503, cors);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
  const text = String(body.text || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 950) return json({ error: 'text must be 1-950 chars' }, 400, cors);

  // cache by content + voice so repeated plays don't re-bill the TTS provider
  const cache = caches.default;
  const voiceTag = provider === 'fish' ? 'fish|' + FISH_VOICE + '|' + FISH_MODEL : '48|caruso';
  const cacheKey = new Request('https://cache.strive-api.internal/voice/' + await sha1(text + '|' + voiceTag));
  const hit = await cache.match(cacheKey);
  if (hit) {
    const res = new Response(hit.body, hit);
    Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const capMsg = budgetCheck('voice', ip);
  if (capMsg) return json({ error: capMsg }, 429, cors);

  const wsRes = provider === 'fish'
    ? await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.FISH_API_KEY, 'content-type': 'application/json', 'model': FISH_MODEL },
        body: JSON.stringify({ text, reference_id: FISH_VOICE, format: 'mp3' }),
      })
    : await fetch('https://api.wellsaidlabs.com/v1/tts/stream', {
        method: 'POST',
        headers: { 'X-Api-Key': env.WELLSAID_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          speaker_id: 48,             // Vanessa N. · Conversational — the demo's stand-in voice
          text,
          model: 'caruso',
          audio_configs: { file_format: 'mp3' },
        }),
      });
  if (!wsRes.ok) {
    const detail = (await wsRes.text().catch(() => '')).slice(0, 200);
    return json({ error: 'voice failed', provider, status: wsRes.status, detail }, 502, cors);
  }

  const audio = await wsRes.arrayBuffer();
  const res = new Response(audio, {
    status: 200,
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=604800', ...cors },
  });
  ctx.waitUntil(cache.put(cacheKey, new Response(audio, {
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=604800' },
  })));
  return res;
}

/* ---------- entry ---------- */

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(env, origin);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/health') return json({ ok: true }, 200, cors);
    if (request.method !== 'POST') return json({ error: 'not found' }, 404, cors);
    if (url.pathname === '/draft') return handleDraft(request, env, cors);
    if (url.pathname === '/voice') return handleVoice(request, env, cors, ctx);
    return json({ error: 'not found' }, 404, cors);
  },
};

/* STRIVE demo API — Cloudflare Worker.
   POST /draft  {question, guards?} → Claude (Opus 4.8) drafts Angela's reply from her knowledge base.
   POST /voice  {text}              → renders the text in Angela's demo voice (mp3).
                                      Fish Audio (her cloned "AR" voice) when FISH_API_KEY is set;
                                      falls back to WellSaid Studio when only WELLSAID_API_KEY is.
   GET  /health                     → {ok}
   /v1/*                            → the iOS app's API (src/v1.js, contract in docs/API-v1.md),
                                      plus a daily 14:00 UTC cron that publishes queued drops.
   Secrets: ANTHROPIC_API_KEY, FISH_API_KEY, WELLSAID_API_KEY, ATHLETE_KEYS. CORS-locked to the demo origins.
   Abuse guards: per-isolate IP counters + global daily caps (best effort, demo-grade). */

import Anthropic from '@anthropic-ai/sdk';
import { PERSONA, TOPICS_RULE } from './persona.js';
import { FISH_VOICE, FISH_MODEL, FISH_SPEED_DEFAULT, sha1, fishTTS } from './voice.js';
import { handleV1, scheduledV1 } from './v1.js';

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

async function handleVoice(request, env, cors, ctx) {
  const provider = env.FISH_API_KEY ? 'fish' : env.WELLSAID_API_KEY ? 'wellsaid' : null;
  if (!provider) return json({ error: 'voice service not configured' }, 503, cors);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
  const text = String(body.text || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 950) return json({ error: 'text must be 1-950 chars' }, 400, cors);

  // delivery: pace comes from the app's Voice Studio slider; clamp to a sane range
  const speed = Math.min(1.3, Math.max(0.6, Number(body.speed) || FISH_SPEED_DEFAULT));

  // cache by content + voice + delivery so repeated plays don't re-bill the TTS provider
  const cache = caches.default;
  const voiceTag = provider === 'fish' ? 'fish|' + FISH_VOICE + '|' + FISH_MODEL + '|' + speed : '48|caruso';
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
    ? await fishTTS(env, text, speed)
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
    const url = new URL(request.url);
    if (url.pathname === '/v1' || url.pathname.startsWith('/v1/')) return handleV1(request, env, ctx);

    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/health') return json({ ok: true }, 200, cors);
    if (request.method !== 'POST') return json({ error: 'not found' }, 404, cors);
    if (url.pathname === '/draft') return handleDraft(request, env, cors);
    if (url.pathname === '/voice') return handleVoice(request, env, cors, ctx);
    return json({ error: 'not found' }, 404, cors);
  },

  async scheduled(controller, env, ctx) {
    await scheduledV1(env);
  },
};

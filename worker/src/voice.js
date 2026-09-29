/* Angela's voice — Fish Audio (her cloned "AR" voice), shared by the legacy /voice route and /v1.
   /v1 keeps every rendered clip in KV (binding AUDIO) under the same key the legacy route caches
   under, so the pre-rendered starter clips uploaded by seed/build-seed.mjs are found, not re-billed. */

// Fish Audio: Billy's private cloned voice "AR Engaging Discussion Voice"
export const FISH_VOICE = '45798132339e4f52be5ffe5a59323ff9';
export const FISH_MODEL = 's2-pro';
export const FISH_SPEED_DEFAULT = 0.87;  // matches the pre-rendered library's slower, more deliberate pace

const FISH_KBPS = 128;                   // Fish returns 128 kbps CBR mp3, so size gives duration

export async function sha1(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function fishTTS(env, text, speed) {
  return fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.FISH_API_KEY, 'content-type': 'application/json', 'model': FISH_MODEL },
    body: JSON.stringify({ text, reference_id: FISH_VOICE, format: 'mp3', prosody: { speed } }),
  });
}

export const normText = text => String(text || '').replace(/\s+/g, ' ').trim();

export function audioKeyFor(text) {
  return sha1(normText(text) + '|fish|' + FISH_VOICE + '|' + FISH_MODEL + '|' + FISH_SPEED_DEFAULT);
}

const durationOf = bytes => Math.round(bytes * 8 / (FISH_KBPS * 1000) * 100) / 100;

export class VoiceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* → { audioKey, duration }. Already-rendered text is free and works without FISH_API_KEY;
   new text needs the key (503 without it) and a successful Fish render (502 otherwise). */
export async function renderVoice(env, text) {
  const t = normText(text);
  const audioKey = await audioKeyFor(t);

  const hit = await env.AUDIO.getWithMetadata(audioKey, { type: 'stream' });
  if (hit.value) {
    if (typeof hit.metadata?.duration === 'number') {
      await hit.value.cancel();
      return { audioKey, duration: hit.metadata.duration };
    }
    const bytes = (await new Response(hit.value).arrayBuffer()).byteLength;
    return { audioKey, duration: durationOf(bytes) };
  }

  if (!env.FISH_API_KEY) throw new VoiceError(503, 'Voice isn’t set up yet, so new text can’t be recorded in her voice.');
  let res;
  try {
    res = await fishTTS(env, t, FISH_SPEED_DEFAULT);
  } catch (e) {
    console.error('fish fetch failed', e && e.message);
    throw new VoiceError(502, 'The voice render failed — nothing was changed. Try again.');
  }
  const audio = res.ok ? await res.arrayBuffer() : null;
  if (!audio || audio.byteLength < 1000) {
    const detail = res.ok ? 'short body ' + (audio ? audio.byteLength : 0) : (await res.text().catch(() => '')).slice(0, 200);
    console.error('fish render failed', res.status, detail);
    throw new VoiceError(502, 'The voice render failed — nothing was changed. Try again.');
  }
  const duration = durationOf(audio.byteLength);
  await env.AUDIO.put(audioKey, audio, { metadata: { duration, bytes: audio.byteLength } });
  return { audioKey, duration };
}

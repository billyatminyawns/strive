/* APNs push for /v1 — dormant until the APNS_KEY (.p8 PEM), APNS_KEY_ID and APNS_TEAM_ID secrets
   exist. Never throws: a failed push must not fail the approval or publish that triggered it. */

const TOPIC = 'com.minyawns.strive';

export const pushConfigured = env => !!(env.APNS_KEY && env.APNS_KEY_ID && env.APNS_TEAM_ID);

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJson = obj => b64url(new TextEncoder().encode(JSON.stringify(obj)));

let cached = null;  // { jwt, at, kid }

// APNs wants one provider token reused for 20–60 minutes; minting one per request gets throttled.
async function providerToken(env) {
  if (cached && cached.kid === env.APNS_KEY_ID && Date.now() - cached.at < 50 * 60e3) return cached.jwt;
  const der = Uint8Array.from(atob(env.APNS_KEY.replace(/-----[^-]+-----|\s/g, '')), ch => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const unsigned = b64urlJson({ alg: 'ES256', kid: env.APNS_KEY_ID }) + '.' + b64urlJson({ iss: env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) });
  // WebCrypto returns the raw r||s signature, which is exactly JWS ES256's format
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  cached = { jwt: unsigned + '.' + b64url(sig), at: Date.now(), kid: env.APNS_KEY_ID };
  return cached.jwt;
}

async function send(env, device, jwt, payload) {
  const host = device.env === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const res = await fetch(`https://${host}/3/device/${device.token}`, {
    method: 'POST',
    headers: {
      authorization: 'bearer ' + jwt, 'apns-topic': env.APNS_TOPIC || TOPIC,
      'apns-push-type': 'alert', 'apns-priority': '10', 'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) return;
  const reason = (await res.json().catch(() => ({}))).reason || '';
  if (res.status === 410 || ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(reason)) {
    await env.DB.prepare('DELETE FROM devices WHERE token = ?').bind(device.token).run();
  } else {
    console.error('apns', res.status, reason);
  }
}

async function deliver(env, devices, { title, body, link }) {
  if (!devices.length) return;
  try {
    const jwt = await providerToken(env);
    const payload = { aps: { alert: { title, body }, sound: 'default' }, link };
    // every device is a subrequest, so the plan's per-invocation subrequest cap bounds a broadcast
    for (let i = 0; i < devices.length; i += 25) {
      await Promise.allSettled(devices.slice(i, i + 25).map(d => send(env, d, jwt, payload)));
    }
  } catch (e) {
    console.error('push failed', e && e.message);
  }
}

export async function pushToUser(env, userId, msg) {
  if (!pushConfigured(env)) return;
  const { results } = await env.DB.prepare('SELECT token, env FROM devices WHERE user_id = ?').bind(userId).all();
  await deliver(env, results, msg);
}

export async function pushToFans(env, athleteId, msg) {
  if (!pushConfigured(env)) return;
  const { results } = await env.DB.prepare(`SELECT d.token, d.env FROM devices d JOIN users u ON u.id = d.user_id
    WHERE d.athlete_id = ? AND u.role = 'fan' LIMIT 900`).bind(athleteId).all();
  await deliver(env, results, msg);
}

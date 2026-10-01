/* Stand-in for Resend (sign-in emails) and Google (ID-token keys), so v1.2 sign-in can be tested end to
   end with no accounts, keys or real mail:
     POST /emails             Resend-compatible: needs `Authorization: Bearer …` and {from, to, subject,
                              text|html}; records the message. A recipient containing "resend-fail" gets
                              a 500, so tests can watch a provider failure.
     GET  /__mail?to=<addr>   the latest message to that address (+ how many it got), 404 if none
     GET  /oauth2/v3/certs    JWKS for an RSA key generated at startup (kid changes every start)
     POST /__google-token     signs a Google-style ID token → { credential, claims }. Body: claims to set
                              ({ sub, email, email_verified, aud, iss, iat, exp, … }) over sensible defaults,
                              plus `omit: [claim names]`, `otherKey: true` (signed by a key the JWKS doesn't
                              list, same kid) and `header: {…}` (e.g. a different kid).
     GET  /__health
   Standalone — scripts/local-up.sh starts it when STRIVE_LOCAL_SIGNIN=mock:
     MOCK_GOOGLE_CLIENT_ID=<client id> node test/mock-identity.mjs [port] */

import { createServer } from 'node:http';
import { generateKeyPairSync, sign, randomBytes, randomInt } from 'node:crypto';

export const TEST_CLIENT_ID = 'strive-test.apps.googleusercontent.com';

const b64url = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

export async function startMock({ port = 0, clientId = process.env.MOCK_GOOGLE_CLIENT_ID || TEST_CLIENT_ID } = {}) {
  const key = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 });   // never published
  const kid = randomBytes(8).toString('hex');
  const jwk = { ...key.publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
  const mail = [];

  function token({ omit = [], otherKey: useOther = false, header = {}, ...claims } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const sub = claims.sub ?? '1' + Array.from({ length: 20 }, () => randomInt(10)).join('');   // Google subs are ~21 digits
    const all = {
      iss: 'https://accounts.google.com', azp: clientId, aud: clientId, sub,
      email: `g${sub.slice(-6)}@gmail.test`, email_verified: true, iat: now, exp: now + 3600, ...claims,
    };
    for (const k of omit) delete all[k];
    const unsigned = b64url({ alg: 'RS256', kid, typ: 'JWT', ...header }) + '.' + b64url(all);
    const sig = sign('sha256', Buffer.from(unsigned), (useOther ? otherKey : key).privateKey).toString('base64url');
    return { credential: unsigned + '.' + sig, claims: all };
  }

  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', ch => { raw += ch; });
    req.on('end', () => {
      const send = (status, body, headers = {}) => {
        res.writeHead(status, { 'content-type': 'application/json', ...headers });
        res.end(JSON.stringify(body));
      };
      const url = new URL(req.url, 'http://mock');
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { return send(400, { statusCode: 400, name: 'invalid_json', message: 'Invalid JSON' }); }

      if (req.method === 'GET' && url.pathname === '/__health') return send(200, { ok: true, messages: mail.length });
      if (req.method === 'GET' && url.pathname === '/oauth2/v3/certs') {
        return send(200, { keys: [jwk] }, { 'cache-control': 'public, max-age=3600, must-revalidate, no-transform' });
      }
      if (req.method === 'POST' && url.pathname === '/__google-token') return send(200, token(body));
      if (req.method === 'GET' && url.pathname === '/__mail') {
        const to = (url.searchParams.get('to') || '').toLowerCase();
        const mine = mail.filter(m => m.to.some(t => t.toLowerCase() === to));
        return mine.length ? send(200, { ...mine.at(-1), count: mine.length }) : send(404, { error: 'no mail for that address', count: 0 });
      }
      if (req.method === 'POST' && url.pathname === '/emails') {
        if (!/^Bearer \S+$/.test(req.headers.authorization || '')) {
          return send(401, { statusCode: 401, name: 'missing_api_key', message: 'Missing API key in the authorization header.' });
        }
        const to = typeof body.to === 'string' ? [body.to] : body.to;
        const ok = typeof body.from === 'string' && body.from && Array.isArray(to) && to.length && to.every(t => typeof t === 'string' && t.includes('@'))
          && typeof body.subject === 'string' && body.subject && (typeof body.text === 'string' || typeof body.html === 'string');
        if (!ok) return send(422, { statusCode: 422, name: 'validation_error', message: 'from, to, subject and text or html are required.' });
        if (to.some(t => t.includes('resend-fail'))) {
          return send(500, { statusCode: 500, name: 'internal_server_error', message: 'Mock provider failure' });
        }
        const id = 'mock_' + randomBytes(6).toString('hex');
        mail.push({ id, from: body.from, to, subject: body.subject, text: body.text ?? null, html: body.html ?? null, at: Date.now() });
        if (mail.length > 1000) mail.shift();
        return send(200, { id });
      }
      send(404, { error: 'not found' });
    });
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const { port: bound } = server.address();
  return { url: `http://127.0.0.1:${bound}`, mail, token, close: () => new Promise(r => server.close(r)) };
}

// `node test/mock-identity.mjs [port]` runs it standalone (for wrangler dev integration runs)
if (import.meta.url === `file://${process.argv[1]}`) {
  const m = await startMock({ port: Number(process.argv[2]) || 0 });
  console.log(m.url);
}

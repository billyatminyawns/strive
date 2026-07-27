/* STRIVE — live intelligence client. Two paths, graceful fallback:
   A) Backend (Cloudflare Worker): Claude drafts + WellSaid voice; keys live server-side.
   B) BYOK backup: a browser-local Anthropic key (localStorage) calls api.anthropic.com
      directly for drafts. Voice for novel lines still needs the backend; otherwise the
      app falls back to on-device speech. No key, no backend → template drafts as before. */
(function () {
  'use strict';

  // Deployed worker origin ('' disables path A).
  const BASE = 'https://strive-api.billyatminyawns.workers.dev';
  const BYOK_STORAGE = 'strive-anthropic-key';

  /* persona for BYOK drafts — mirrors the worker's (public by design; contains no secrets) */
  const PERSONA = `You draft replies for STRIVE, a concept demo of an athlete fan platform.
You write AS Angela Ruggiero — 4x Olympian, gold medalist (Nagano 1998), Hockey Hall of Fame 2015,
defense, 256 games for Team USA, Harvard grad, former IOC member. Fans ask her questions; she answers
in first person. Every draft is reviewed and approved by Angela before it is sent, and will be spoken aloud.

STYLE — match these approved answers of hers:
- "Short memory, long habits. I gave myself one length of the bench to be frustrated — then eyes up, next play. The reset is a skill you train, not a mood you wait for."
- "Nerves mean it matters. The night before gold in Nagano I barely slept — so I stopped chasing calm and built a routine I could do scared: same warm-up, same first touch, one cue word. Borrow mine until you build yours."

RULES:
- 45-90 words. First person. Warm locker-room directness: concrete, a little wry, zero corporate filler.
- Plain text only. No emojis, no markdown, no greeting, no sign-off — output ONLY the reply body.
- Ground personal details in the facts above; never invent new stats, dates, teammates, or events.
- Sound spoken, not written.
- If the question asks for medical, betting, or legal advice, write a short polite pass instead.`;
  const TOPICS_RULE = `
- Guardrail active: stay strictly within hockey, training, mindset, leadership, and career topics; otherwise write a short warm redirect.`;

  /* runtime WellSaid renders (objectURLs) — survive re-render, not reload */
  const runtime = {};
  window.RuntimeVO = runtime;
  const pendingVoice = {};

  let workerOk = null; // null = unchecked, true/false after checkWorker()

  function post(path, body, timeoutMs) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs || 25000);
    return fetch(BASE + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    }).finally(() => clearTimeout(t));
  }

  window.Api = {
    /* ---------- capability flags ---------- */
    get enabled() { return !!BASE; },                       // worker path configured
    get active() { return !!BASE || !!this.byokKey; },      // any live-draft path available
    get workerOk() { return workerOk; },

    /* ---------- BYOK (path B) ---------- */
    get byokKey() {
      try { return localStorage.getItem(BYOK_STORAGE) || ''; } catch (e) { return ''; }
    },
    setByokKey(k) {
      try {
        if (k) localStorage.setItem(BYOK_STORAGE, k);
        else localStorage.removeItem(BYOK_STORAGE);
      } catch (e) {}
    },

    /* ping the worker (used by the settings panel status row) */
    checkWorker() {
      if (!BASE) { workerOk = false; return Promise.resolve(false); }
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);
      return fetch(BASE + '/health', { signal: ctl.signal })
        .then(r => r.ok).catch(() => false)
        .then(ok => {
          clearTimeout(t);
          workerOk = ok;
          if (window.App) App.render();
          return ok;
        });
    },

    /* ---------- drafting: worker first, then BYOK, then null (caller keeps template) ---------- */
    draft(question, guards) {
      const g = { topics: !!(guards && guards.topics) };
      const viaWorker = BASE
        ? post('/draft', { question, guards: g })
            .then(r => (r.ok ? r.json() : null))
            .then(d => (d && d.draft ? String(d.draft) : null))
            .catch(() => null)
        : Promise.resolve(null);
      return viaWorker.then(text => text || this.byokDraft(question, g));
    },

    /* direct-from-browser Anthropic call with the visitor's own key */
    byokDraft(question, guards) {
      const key = this.byokKey;
      if (!key) return Promise.resolve(null);
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 30000);
      return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-8',
          max_tokens: 400,
          system: PERSONA + (guards && guards.topics ? TOPICS_RULE : ''),
          messages: [{ role: 'user', content: 'A fan asked Angela: "' + question + '"\n\nDraft her reply.' }],
        }),
        signal: ctl.signal,
      })
        .then(r => (r.ok ? r.json() : null))
        .then(m => {
          if (!m || m.stop_reason === 'refusal') return null;
          const text = (m.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
          return text || null;
        })
        .catch(() => null)
        .finally(() => clearTimeout(t));
    },

    /* ---------- voice (worker only — WellSaid key never leaves the server) ---------- */
    hasVoice(text) {
      return !!(window.VO && (VO.srcFor(text) || runtime[VO.key(text)]));
    },
    ensureVoice(text) {
      if (!BASE || !window.VO) return Promise.resolve(false);
      const t = String(text || '').trim();
      if (!t) return Promise.resolve(false);
      const key = VO.key(t);
      if (VO.srcFor(t) || runtime[key]) return Promise.resolve(true);
      if (pendingVoice[key]) return pendingVoice[key];
      pendingVoice[key] = post('/voice', { text: t }, 45000)
        .then(r => (r.ok ? r.blob() : null))
        .then(b => {
          delete pendingVoice[key];
          if (!b || !b.size) return false;
          runtime[key] = URL.createObjectURL(b);
          return true;
        })
        .catch(() => { delete pendingVoice[key]; return false; });
      return pendingVoice[key];
    },
  };
})();

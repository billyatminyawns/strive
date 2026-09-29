/* Text matching for /v1: the sensitive-topic guardrail, instant answers and coverage buckets.
   Everything compares whole tokens. The web prototype matched substrings, so "mediocre" hit the
   "ioc" key and "along the boards" hit "boards" — both must stay misses here. */

export const tokens = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

// crude plural folding: nerves→nerve, boards→board, injuries→injury (nervous, press, his untouched)
function stem(t) {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 3 && t.endsWith('s') && !/(ss|us|is)$/.test(t)) return t.slice(0, -1);
  return t;
}

/* ---------- guardrail (ported from js/data.js) ---------- */

// WORDS match whole tokens (so "issue"/"pursue" don't trip "sue"); PREFIX catches morphological variants.
const SENSITIVE_WORDS = new Set(['bet', 'bets', 'betting', 'parlay', 'parlays', 'odds', 'gamble', 'gambling', 'wager', 'wagers',
  'doctor', 'medical', 'medicine', 'meds', 'concussion', 'concussions', 'surgery', 'injury', 'injuries',
  'legal', 'lawyer', 'lawsuit', 'sue', 'suing']);
const SENSITIVE_PREFIX = ['injur', 'concuss', 'diagnos', 'medicat', 'prescri'];

export const isSensitive = text =>
  tokens(text).some(t => SENSITIVE_WORDS.has(t) || SENSITIVE_PREFIX.some(p => t.startsWith(p)));

/* ---------- instant answers ---------- */

const STOP = new Set(`a about above after again against all also am an and any anything are as at be because been before
being below between both but by can cant could d did didn didnt do does doesn doesnt doing don dont down during each
ever few for from further get gets getting got had has have having he her here hers herself him himself his how hows i
id if im in into is isn isnt it its itself ive just know like ll m make me more most much my myself need no nor not
now of off on once only or other our ours out over own re really s same she should so some something such t than that
thats the their theirs them themselves then there these they thing things this those through to too under until up
us ve very want was wasn we were what whats when where which while who whom whos why will with won wont would you
youre your yours yourself y best good great way ways tip tips advice`.split(/\s+/));

const content = text => tokens(text).filter(t => !STOP.has(t)).map(stem);

function hasPhrase(seq, phrase) {
  if (!phrase.length) return false;
  outer: for (let i = 0; i + phrase.length <= seq.length; i++) {
    for (let j = 0; j < phrase.length; j++) if (seq[i + j] !== phrase[j]) continue outer;
    return true;
  }
  return false;
}

/* Returns the library entry a fan question clearly asks again, or null. False positives are worse
   than misses (a wrong answer plays in her voice), so a hit needs one of:
   the same question modulo case/punctuation · ≥2 shared content words at Jaccard ≥ 0.6 ·
   ≥2 of the entry's key phrases (whole-token) plus some shared wording (Jaccard ≥ 0.25). */
export function matchKb(question, entries) {
  const seq = tokens(question).map(stem);
  const exact = seq.join(' ');
  const q = new Set(content(question));
  let best = null;
  for (const e of entries) {
    if (exact && tokens(e.question).map(stem).join(' ') === exact) return e;
    const k = new Set(content(e.question));
    const shared = [...q].filter(t => k.has(t)).length;
    const union = new Set([...q, ...k]).size;
    const jaccard = union ? shared / union : 0;
    const keyHits = (e.keys || []).filter(key => hasPhrase(seq, tokens(key).map(stem))).length;
    if ((shared >= 2 && jaccard >= 0.6) || (keyHits >= 2 && shared >= 1 && jaccard >= 0.25)) {
      const score = jaccard + keyHits / 10;
      if (!best || score > best.score) best = { e, score };
    }
  }
  return best ? best.e : null;
}

// Stable ranking of library entries by shared content words, for grounding drafts.
export function byRelevance(question, entries) {
  const q = new Set(content(question));
  return entries
    .map((e, i) => ({ e, i, s: content(e.question + ' ' + e.answer).filter(t => q.has(t)).length }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.e);
}

/* ---------- coverage ---------- */

const BUCKETS = {
  Training: 'train training practice drill skate skating workout warm warmup shot shooting stickhandling conditioning gap angling technique skill strength speed stride',
  Mindset: 'mindset nerve nervous confidence confident pressure focus mental fear scared reset mistake calm poise panic doubt motivation habit routine superstition memory frustrated',
  Nutrition: 'eat eating food meal diet nutrition hydrate hydration water breakfast lunch dinner oatmeal pasta snack protein coffee',
  Recovery: 'recovery recover rest sleep slept stretch stretching mobility sore soreness offseason rehab tired fatigue',
  Leadership: 'lead leader leadership captain teammate standard coachability coachable coach board boardroom executive business company',
  Culture: 'culture olympic ioc family home homesick homesickness community tradition travel road trip ritual village nagano harvard',
};
const BUCKET_TERMS = Object.entries(BUCKETS).map(([bucket, words]) => [bucket, new Set(words.split(' ').map(stem))]);
const COVERAGE_FULL = 25;   // approved items touching a bucket before it reads 100%

// items: strings (an approved answer, a published drop, a story) → [{ bucket, pct }]
export function coverage(items) {
  const counts = BUCKET_TERMS.map(() => 0);
  for (const text of items) {
    const words = new Set(tokens(text).map(stem));
    BUCKET_TERMS.forEach(([, terms], i) => { if ([...terms].some(t => words.has(t))) counts[i]++; });
  }
  return BUCKET_TERMS.map(([bucket], i) => ({ bucket, pct: Math.min(100, Math.round(counts[i] / COVERAGE_FULL * 100)) }));
}

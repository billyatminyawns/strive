#!/usr/bin/env node
/* Turns a research run (the angela-public-record workflow's output JSON) into the brain's
   reviewable source, plus a review packet for Angela.

     node scripts/import-research.mjs <workflow-output.json>

   Writes:
     persona/angela.json                  committed: entries (verifier drops removed, fixes applied),
                                          canonical facts, sanitized avoid topics, style guide.
                                          Status starts "unreviewed"; HOLD ids start "held".
     persona/research/<date>.json         NOT committed: the raw run, including sensitive notes
     persona/research/REVIEW-<date>.md    NOT committed: questions for Angela to settle
   Existing statuses in persona/angela.json (Angela's approvals/rejections) are carried over. */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) { console.error('usage: node scripts/import-research.mjs <workflow-output.json>'); process.exit(1); }
const raw = JSON.parse(readFileSync(src, 'utf8'));
const run = raw.result || raw;
const v = run.verified;
const date = new Date().toISOString().slice(0, 10);

// Stories she told publicly but that need her explicit OK before the AI repeats them.
const HOLD = new Set(['training-advice-96']);   // played a World Championship on a torn shoulder

// The committed corpus states rules, not allegations: these avoid topics keep their redirect but
// lose detail that doesn't belong in a public repo.
const SANITIZE = [
  [/lawsuit|abuse|nassar|ungerleider/i, { topic: 'Abuse cases, lawsuits and USOC governance during her board years', why: 'Legal and sensitive matters; she has spoken about athlete safety only in general terms.' }],
  [/trump|partisan|president/i, { topic: 'Partisan politics, presidents, elections and political figures', why: 'No partisan positions appear in her public record; The Apprentice is only a career fact.' }],
];

const prior = existsSync(join(root, 'persona', 'angela.json'))
  ? new Map((JSON.parse(readFileSync(join(root, 'persona', 'angela.json'), 'utf8')).entries || []).map(e => [e.id, e.status]))
  : new Map();

const drops = new Set(v.drop_ids || []);
const fixes = new Map((v.fixes || []).map(f => [f.id, f.corrected_summary]));
const entries = run.entries
  .filter(e => !drops.has(e.id) && e.kind !== 'avoid')
  .map(e => {
    const out = { ...e, summary: fixes.get(e.id) || e.summary };
    delete out.slice;
    const kept = prior.get(e.id);
    out.status = kept && kept !== 'unreviewed' ? kept : HOLD.has(e.id) ? 'held' : 'unreviewed';
    return out;
  });

const avoid = (v.avoid_topics || []).map(a => {
  const rule = SANITIZE.find(([re]) => re.test(a.topic + ' ' + a.why));
  return rule ? { ...a, ...rule[1] } : a;
});

const persona = {
  _about: `Coach Angela grounding, imported ${date} from a cited public-record research run, then compiled by scripts/build-brain.mjs. Angela reviews entries (status: unreviewed | approved | rejected | held). Held and rejected entries never reach the brain.`,
  canonical_facts: v.canonical_facts,
  entries,
  avoid_topics: avoid,
  style_guide: v.style_guide,
};
writeFileSync(join(root, 'persona', 'angela.json'), JSON.stringify(persona, null, 2) + '\n');

mkdirSync(join(root, 'persona', 'research'), { recursive: true });
writeFileSync(join(root, 'persona', 'research', `${date}.json`), JSON.stringify(run, null, 2));

const held = entries.filter(e => e.status === 'held');
const review = [
  `# Coach Angela — review packet for Angela (${date})`, '',
  'Coach Angela answers fans only from what is below. Anything you mark wrong is removed; anything you',
  'confirm becomes something it can say with confidence. Nothing here is published to fans by itself.', '',
  '## 1. Facts the sources disagree on — which is right?', '',
  ...(v.contradictions || []).map(c => `- **${c.topic}** — ${c.detail}`), '',
  '## 2. Your current roles — which are still true today?', '',
  'Sources from 2025–26 conflict. Until you confirm, Coach Angela speaks about these in the past tense:',
  '- Advisor at Genius Sports (after it acquired Sports Innovation Lab, Sept 2025)?',
  '- Chair of Sports Innovation Lab after the acquisition?',
  '- New York Rangers hockey operations advisor (hired 2023)?',
  '- World Rugby Executive Committee (term to Sept 2027)? · Harvard Alumni Association director (from July 2025)?', '',
  '## 3. Stories held until you OK them', '',
  ...held.map(e => `- ${e.summary} (${e.outlet || e.source_title}, ${e.source_date})`), '',
  '## 4. Demo answers written for the prototype — true to you, or rewrite?', '',
  'These five were placeholder copy in the demo, not your words. Coach Angela no longer uses them once',
  "it's live, unless you confirm them: the bad-shift reset, pre-game nerves (incl. 'the night before gold in",
  "Nagano I barely slept'), gap-control drill, morning routine (up at six, mobility, sticky note), and",
  "'what have you done since hockey'.", '',
  "Also your voice bio on the profile: it says you 'serve on boards, work across the Olympic movement' —",
  'still how you would put it today?', '',
  '## 5. Topics Coach Angela will never speak to (it redirects instead)', '',
  ...avoid.map(a => `- **${a.topic}** → ${a.redirect}`), '',
  `## 6. Everything it knows (${entries.length} notes, ${v.canonical_facts.length} facts)`, '',
  'Full list with sources: worker/persona/angela.json. Approve or reject per note in a later studio screen,',
  'or just tell Billy which ones are off.',
].join('\n');
writeFileSync(join(root, 'persona', 'research', `REVIEW-${date}.md`), review + '\n');

console.log(`imported ${entries.length} entries (${run.entries.length - entries.length} dropped/avoid, ${held.length} held, ${fixes.size} fixed) · ${v.canonical_facts.length} facts · ${avoid.length} avoid topics`);
console.log(`review packet: persona/research/REVIEW-${date}.md`);

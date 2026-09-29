/* Claude drafts of the athlete's replies for /v1 — grounded on her approved answers and recorded
   stories. Every draft is only a suggestion: nothing reaches a fan until she approves it. */

import Anthropic from '@anthropic-ai/sdk';
import { PERSONA, TOPICS_RULE } from './persona.js';

const DEFAULT_MODEL = 'claude-opus-5';

function systemPrompt(athlete, { answers, stories }) {
  let s = PERSONA + (athlete.guard_topics ? '\n' + TOPICS_RULE : '');
  if (answers.length) {
    s += '\n\nANSWERS SHE HAS ALREADY APPROVED — her own words; reuse their facts, never contradict them:\n'
      + answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
  }
  if (stories.length) {
    s += '\n\nSTORIES SHE RECORDED — transcripts in her own words; facts here are safe to use:\n'
      + stories.map(st => `${st.title}: ${st.transcript.slice(0, 1500)}`).join('\n\n');
  }
  return s;
}

/* → draft text, or null when Claude declines or returns nothing. Throws on API/network errors.
   `current`/`note` turn it into a revision of her existing draft. */
export async function draftReply(env, { athlete, question, grounding, current, note, timeout, maxRetries }) {
  const name = athlete.first_name;
  let prompt = `A fan asked ${name}: "${question}"\n\n`;
  if (note == null) prompt += 'Draft her reply.';
  else if (current) prompt += `Her current draft:\n${current}\n\n${name}'s note on what to change: ${note}\n\nRewrite the draft to apply her note. Output only the revised reply.`;
  else prompt += `${name}'s note on what she wants to say: ${note}\n\nDraft her reply along those lines.`;

  const model = env.DRAFT_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, timeout, maxRetries });
  const params = {
    model,
    max_tokens: 16000,
    // medium: short replies don't need deep thinking, and background drafts must finish inside
    // the ~30 s ctx.waitUntil window
    output_config: { effort: 'medium' },
    system: systemPrompt(athlete, grounding),
    messages: [{ role: 'user', content: prompt }],
  };
  // Opus 5 / Fable 5 safety classifiers can decline benign asks; let the API re-run those on
  // its recommended fallback model instead of returning a refusal.
  const msg = /^claude-(opus|fable)-5/.test(model)
    ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
    : await client.messages.create(params);
  if (msg.stop_reason === 'refusal') return null;
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
  return text || null;
}

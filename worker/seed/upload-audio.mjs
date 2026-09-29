#!/usr/bin/env node
/* Uploads the starter clips listed in seed/.build/audio.json (run build-seed.mjs first) into the
   AUDIO KV namespace, one `wrangler kv key put --path` per clip.
     node seed/upload-audio.mjs --local | --remote
   Not `kv bulk put`: its --local path stores base64 values as mangled text, not bytes. */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const worker = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const where = process.argv[2];
if (where !== '--local' && where !== '--remote') {
  console.error('usage: node seed/upload-audio.mjs --local | --remote');
  process.exit(1);
}
const clips = JSON.parse(fs.readFileSync(path.join(worker, 'seed', '.build', 'audio.json'), 'utf8'));
const wrangler = path.join(worker, 'node_modules', '.bin', 'wrangler');

for (const c of clips) {
  execFileSync(wrangler, ['kv', 'key', 'put', c.key, '--path', c.file, '--metadata', JSON.stringify(c.metadata), '--binding', 'AUDIO', where],
    { cwd: worker, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
}
console.log(`uploaded ${clips.length} clips (${where.slice(2)})`);

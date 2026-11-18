// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The reference file for an extract, made on the laptop with the app's own
// planner and assemble() from the staged hosted file:
//
//   node reference.mjs <hosted file> <w> <s> <e> <n> <maxzoom|-> <out file>
//   node reference.mjs --plan <plan.json> <hosted file> <out file>
//
// The second form assembles a plan made elsewhere (the app's WebView), given
// as JSON { head: base64, ranges: [[offset, length], ...], bytes }.
//
// Prints the plan (head size, ranges, size) and the SHA-256 of the result as JSON.
// Bundled to reference.mjs with: npx rolldown reference.ts -o reference.mjs -p node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assemble } from '../../../../../app/src/downloads/assemble';
import type { DownloadPlan } from '../../../../../app/src/downloads/download-plan';
import { planExtract } from '../../../../../app/src/downloads/extract-planner';
import { diskSource } from '../../../../../app/src/downloads/test-node';

const args = process.argv.slice(2);
let plan: DownloadPlan;
let source: ReturnType<typeof diskSource>;
let out: string;
if (args[0] === '--plan') {
  const given = JSON.parse(readFileSync(args[1]!, 'utf8')) as { head: string; ranges: [number, number][]; bytes: number };
  source = diskSource(args[2]!);
  out = args[3]!;
  plan = { head: new Uint8Array(Buffer.from(given.head, 'base64')), ranges: given.ranges.map(([offset, length]) => ({ offset, length })), bytes: given.bytes };
} else {
  const [file, w, s, e, n, z, o] = args;
  source = diskSource(file!);
  out = o!;
  plan = await planExtract(source, {
    bounds: [Number(w), Number(s), Number(e), Number(n)],
    ...(z && z !== '-' ? { maxzoom: Number(z) } : {}),
  });
}
const bytes = await assemble(plan, source);
writeFileSync(out, bytes);
console.log(
  JSON.stringify({
    headBytes: plan.head.length,
    headSha256: createHash('sha256').update(plan.head).digest('hex'),
    ranges: plan.ranges.map((r) => [r.offset, r.length]),
    bytes: plan.bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }),
);

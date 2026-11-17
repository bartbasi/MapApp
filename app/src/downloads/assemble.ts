// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The reference for what a downloader must produce from a plan: the head,
// then every range of the hosted file in order, nothing between them. The
// native downloader does the same job with resume; this one is for tests and
// for the browser.

import type { Source } from 'pmtiles';
import type { DownloadPlan } from './download-plan';

/** Ranges longer than this are read in pieces, so memory stays bounded. */
export const ASSEMBLE_CHUNK_BYTES = 8 * 1024 * 1024;

/** Writes the planned file to `write`, chunk by chunk, and returns its size. */
export async function assembleTo(
  plan: DownloadPlan,
  source: Source,
  write: (chunk: Uint8Array) => void | Promise<void>,
): Promise<number> {
  let written = 0;
  if (plan.head.length > 0) {
    await write(plan.head);
    written += plan.head.length;
  }
  for (const range of plan.ranges) {
    for (let done = 0; done < range.length; ) {
      const length = Math.min(ASSEMBLE_CHUNK_BYTES, range.length - done);
      const r = await source.getBytes(range.offset + done, length, undefined, plan.etag);
      const bytes = new Uint8Array(r.data);
      if (bytes.length < length) throw new Error(`short read at ${range.offset + done}: ${bytes.length} of ${length} bytes`);
      await write(bytes.length > length ? bytes.subarray(0, length) : bytes);
      done += length;
      written += length;
    }
  }
  if (written !== plan.bytes) throw new Error(`assembled ${written} bytes, the plan says ${plan.bytes}`);
  return written;
}

/** Builds the planned file in memory. */
export async function assemble(plan: DownloadPlan, source: Source): Promise<Uint8Array> {
  const out = new Uint8Array(plan.bytes);
  let at = 0;
  await assembleTo(plan, source, (chunk) => {
    out.set(chunk, at);
    at += chunk.length;
  });
  return out;
}

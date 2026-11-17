// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Compression of an archive's directories and metadata ("internal
// compression"). Gzip uses the platform's CompressionStream, which Android
// WebView, desktop browsers and Node all have. Brotli and Zstd have no
// built-in compressor, so archives that use them are refused.

import { Compression } from 'pmtiles';

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

/** True if this planner can write directories with that compression. */
export function supportedInternalCompression(c: Compression): boolean {
  return c === Compression.Gzip || c === Compression.None;
}

export async function compressInternal(bytes: Uint8Array, c: Compression): Promise<Uint8Array> {
  if (c === Compression.None) return bytes;
  if (c === Compression.Gzip) return through(bytes, new CompressionStream('gzip'));
  throw new Error(`internal compression ${Compression[c] ?? c} is not supported`);
}

export async function decompressInternal(bytes: Uint8Array, c: Compression): Promise<Uint8Array> {
  if (c === Compression.None) return bytes;
  if (c === Compression.Gzip) return through(bytes, new DecompressionStream('gzip'));
  throw new Error(`internal compression ${Compression[c] ?? c} is not supported`);
}

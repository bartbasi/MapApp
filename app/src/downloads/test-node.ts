// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Test helper: the few Node calls the real-archive tests need, typed by hand
// because the app's type settings carry no Node types. Everything is
// undefined when the tests do not run in Node.

import type { Source } from 'pmtiles';

interface NodeFs {
  existsSync(p: string): boolean;
  readFileSync(p: string, encoding: 'utf8'): string;
  openSync(p: string, flags: string): number;
  closeSync(fd: number): void;
  fstatSync(fd: number): { size: number };
  readSync(fd: number, buf: Uint8Array, offset: number, length: number, position: number): number;
  writeSync(fd: number, buf: Uint8Array, offset: number, length: number): number;
  mkdtempSync(prefix: string): string;
  rmSync(p: string, options: { recursive: boolean; force: boolean }): void;
}

interface NodeChildProcess {
  spawnSync(cmd: string, args: string[], options: { encoding: 'utf8'; maxBuffer: number }): {
    status: number | null;
    stdout: string;
    stderr: string;
    error?: Error;
  };
}

const builtin = (id: string): unknown => (globalThis as { process?: { getBuiltinModule?(id: string): unknown } }).process?.getBuiltinModule?.(id);

export const fs = builtin('node:fs') as NodeFs | undefined;
export const childProcess = builtin('node:child_process') as NodeChildProcess | undefined;
const os = builtin('node:os') as { tmpdir(): string } | undefined;
const path = builtin('node:path') as { join(...parts: string[]): string } | undefined;
const url = builtin('node:url') as { fileURLToPath(u: URL): string } | undefined;

/** A file path from a URL relative to this folder. */
export function localPath(relative: string): string | undefined {
  return url?.fileURLToPath(new URL(relative, import.meta.url));
}

export function joinPath(...parts: string[]): string {
  return path!.join(...parts);
}

/** A new empty folder in the OS temporary folder. */
export function makeTempDir(): string {
  return fs!.mkdtempSync(path!.join(os!.tmpdir(), 'mapapp-extract-'));
}

/** A byte source over a file on disk, read by ranges, never whole. Counts its reads. */
export function diskSource(file: string): Source & { reads: number; size: number; close(): void } {
  const fd = fs!.openSync(file, 'r');
  const size = fs!.fstatSync(fd).size;
  const src = {
    reads: 0,
    size,
    getKey: () => file,
    getBytes: async (offset: number, length: number) => {
      src.reads++;
      const n = Math.max(0, Math.min(length, size - offset));
      const buf = new Uint8Array(n);
      let done = 0;
      while (done < n) {
        const got = fs!.readSync(fd, buf, done, n - done, offset + done);
        if (got <= 0) throw new Error(`read failed at ${offset + done} in ${file}`);
        done += got;
      }
      return { data: buf.buffer };
    },
    close: () => fs!.closeSync(fd),
  };
  return src;
}

/** Opens a file for writing and returns a chunk writer and a closer. */
export function fileWriter(file: string): { write(chunk: Uint8Array): void; close(): void } {
  const fd = fs!.openSync(file, 'w');
  return {
    write(chunk) {
      for (let done = 0; done < chunk.length; ) done += fs!.writeSync(fd, chunk, done, chunk.length - done);
    },
    close: () => fs!.closeSync(fd),
  };
}

/** Runs a program and returns its exit status and output. */
export function run(cmd: string, args: string[]): { status: number | null; out: string } {
  const r = childProcess!.spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** The PMTiles command line tool, when it is on this machine. */
export const pmtilesTool: string | undefined = (() => {
  const exe = localPath('../../../.tools/pmtiles/pmtiles.exe');
  if (!exe || !fs?.existsSync(exe) || !childProcess) return undefined;
  try {
    return run(exe, ['version']).status === 0 ? exe : undefined;
  } catch {
    return undefined;
  }
})();

/** Runs `pmtiles verify` on archive bytes written to a temporary file. */
export function verifyBytes(bytes: Uint8Array): { status: number | null; out: string } {
  const dir = makeTempDir();
  try {
    const file = joinPath(dir, 'check.pmtiles');
    const w = fileWriter(file);
    try {
      w.write(bytes);
    } finally {
      w.close();
    }
    return run(pmtilesTool!, ['verify', file]);
  } finally {
    fs!.rmSync(dir, { recursive: true, force: true });
  }
}

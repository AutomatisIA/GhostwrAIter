import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import yazl from "yazl";
import { assertUnderRoot } from "../../workspace/workspace.service";
import { isSafeEntryName, MANIFEST_ENTRY_NAME } from "./archive-format";

/**
 * Promise wrappers around yazl/yauzl, which are callback based.
 *
 * Nothing here knows what a workspace is: it writes and reads ZIP entries, and
 * refuses entry names that would escape the destination. Keeping it that
 * narrow is what lets the export and import services be tested against real
 * archives rather than against a mock of this module.
 */

export type ArchiveSource =
  | { entryName: string; sourcePath: string }
  | { entryName: string; content: Buffer | string };

/**
 * Writes every source into a ZIP at `destinationPath`.
 *
 * Resolves only once the output stream is closed. An earlier version resolved
 * on `zip.end()`, which returns as soon as the entries are queued: the caller
 * then read a file that was still being written.
 */
export async function writeArchive(
  sources: readonly ArchiveSource[],
  destinationPath: string
): Promise<void> {
  mkdirSync(dirname(destinationPath), { recursive: true });

  const zip = new yazl.ZipFile();
  for (const source of sources) {
    if ("sourcePath" in source) {
      zip.addFile(source.sourcePath, source.entryName);
    } else {
      const buffer =
        typeof source.content === "string"
          ? Buffer.from(source.content, "utf8")
          : source.content;
      zip.addBuffer(buffer, source.entryName);
    }
  }
  zip.end();

  await pipeline(zip.outputStream, createWriteStream(destinationPath));
}

type OpenedArchive = {
  zipFile: yauzl.ZipFile;
  /** Resolves when the `close` event has fired, whoever triggered the close. */
  closed: Promise<void>;
};

function openArchive(archivePath: string): Promise<OpenedArchive> {
  return new Promise((resolvePromise, rejectPromise) => {
    yauzl.open(archivePath, { lazyEntries: true }, (err, zipFile) => {
      if (err || !zipFile) {
        rejectPromise(err ?? new Error("Archive illisible."));
        return;
      }
      // The listener is attached here, before anything can close the file.
      // yauzl runs with autoClose on, so it closes on its own at `end` and on
      // error: by the time a caller reacts, `close()` may already have been
      // called and the event already emitted. Subscribing after the fact would
      // wait for an event that will never fire again.
      const closed = new Promise<void>((resolveClosed) => {
        zipFile.once("close", () => resolveClosed());
      });
      resolvePromise({ zipFile, closed });
    });
  });
}

/**
 * Settles a promise only once the archive's file descriptor is really released.
 *
 * `zipFile.close()` returns before the descriptor is gone; yauzl emits `close`
 * when it actually is. On POSIX the distinction is invisible, since an open
 * file can still be unlinked. On Windows it is not: deleting or moving a file
 * whose descriptor is open fails, so returning early leaves the user's archive
 * locked for as long as the application runs, right after an import that was
 * refused.
 *
 * The wait is on the promise captured at open time, not on a listener attached
 * here. A first version tested `zipFile.isOpen` and settled immediately when it
 * was already false, which is the common case: yauzl closes on its own when it
 * rejects an entry name, so by the time this runs the close is under way but
 * NOT finished. Windows then reported `EPERM ... lstat hostile.zip` on a file
 * that had been deleted, because a delete against an open handle only takes
 * effect once the last handle goes.
 */
async function afterClose(
  archive: OpenedArchive,
  settle: () => void
): Promise<void> {
  if (archive.zipFile.isOpen) {
    archive.zipFile.close();
  }
  await archive.closed;
  settle();
}

function readEntryBuffer(zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolvePromise, rejectPromise) => {
    zipFile.openReadStream(entry, (err, stream) => {
      if (err || !stream) {
        rejectPromise(err ?? new Error(`Entrée illisible : ${entry.fileName}`));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", rejectPromise);
      stream.on("end", () => resolvePromise(Buffer.concat(chunks)));
    });
  });
}

/**
 * Reads a single entry without extracting the archive.
 *
 * Used for the manifest, so that the import confirmation can tell the user
 * what an archive holds before anything touches their workspace.
 */
export async function readArchiveEntry(
  archivePath: string,
  entryName: string
): Promise<Buffer | null> {
  const archive = await openArchive(archivePath);
  const { zipFile } = archive;

  return new Promise<Buffer | null>((resolvePromise, rejectPromise) => {
    const succeed = (value: Buffer | null) =>
      void afterClose(archive, () => resolvePromise(value));
    const fail = (err: unknown) =>
      void afterClose(archive, () => rejectPromise(asArchiveError(err)));

    let found = false;
    zipFile.on("entry", (entry: yauzl.Entry) => {
      if (entry.fileName !== entryName) {
        zipFile.readEntry();
        return;
      }
      found = true;
      readEntryBuffer(zipFile, entry).then(succeed, fail);
    });
    zipFile.on("end", () => {
      if (!found) succeed(null);
    });
    zipFile.on("error", fail);
    zipFile.readEntry();
  });
}

export class UnsafeArchiveEntryError extends Error {
  readonly entryName: string;

  constructor(entryName: string) {
    super(
      `Archive refusée : elle contient une entrée dont le chemin sort du dossier de destination ("${entryName}").`
    );
    this.name = "UnsafeArchiveEntryError";
    this.entryName = entryName;
  }
}

/**
 * yauzl rejects traversal and absolute entry names on its own, before any
 * `entry` event is emitted, and it does so after folding backslashes into
 * slashes. Measured, not assumed: `..\escaped.txt` is rejected as
 * `../escaped.txt`, while `files\x\note.md` is accepted as `files/x/note.md`.
 *
 * Its wording is a library internal ("invalid relative path: ..."), which is
 * not what a user should read when an archive is refused. It is translated
 * here so that the reason surfaces intact, and the name check in
 * `isSafeEntryName` stays as the second lock: it is what still holds if a
 * future yauzl option or version stops validating for us.
 */
function asArchiveError(err: unknown): unknown {
  const message = err instanceof Error ? err.message : "";
  const match = /^(?:invalid relative path|absolute path): (.+)$/.exec(message);
  return match ? new UnsafeArchiveEntryError(match[1] ?? message) : err;
}

/**
 * Extracts every entry under `destinationDirectory` and returns the entry
 * names written, in archive order.
 *
 * Extraction is the one place where a foreign file dictates where bytes land,
 * so each name passes three locks: yauzl's own validation, then the name as
 * text before a path is built from it, then the resolved path through
 * `assertUnderRoot`. A single check that is bypassed is silent.
 */
export async function extractArchive(
  archivePath: string,
  destinationDirectory: string
): Promise<string[]> {
  const root = resolve(destinationDirectory);
  mkdirSync(root, { recursive: true });

  const archive = await openArchive(archivePath);
  const { zipFile } = archive;
  const extracted: string[] = [];

  return new Promise<string[]>((resolvePromise, rejectPromise) => {
    const fail = (err: unknown) =>
      void afterClose(archive, () => rejectPromise(asArchiveError(err)));

    zipFile.on("entry", (entry: yauzl.Entry) => {
      // Directory entries carry no content; the parent directories of each
      // file entry are created below, so they can be skipped entirely.
      if (entry.fileName.endsWith("/")) {
        zipFile.readEntry();
        return;
      }

      if (!isSafeEntryName(entry.fileName)) {
        fail(new UnsafeArchiveEntryError(entry.fileName));
        return;
      }

      let targetPath: string;
      try {
        targetPath = assertUnderRoot(join(root, entry.fileName), root);
      } catch {
        fail(new UnsafeArchiveEntryError(entry.fileName));
        return;
      }

      zipFile.openReadStream(entry, (err, stream) => {
        if (err || !stream) {
          fail(err ?? new Error(`Entrée illisible : ${entry.fileName}`));
          return;
        }
        mkdirSync(dirname(targetPath), { recursive: true });
        pipeline(stream, createWriteStream(targetPath)).then(
          () => {
            extracted.push(entry.fileName);
            zipFile.readEntry();
          },
          fail
        );
      });
    });

    zipFile.on("end", () => void afterClose(archive, () => resolvePromise(extracted)));
    zipFile.on("error", fail);
    zipFile.readEntry();
  });
}

/** Convenience for callers that already extracted an archive to disk. */
export function readExtractedManifest(extractionDirectory: string): string {
  return readFileSync(join(extractionDirectory, MANIFEST_ENTRY_NAME), "utf8");
}

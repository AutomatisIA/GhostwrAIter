/**
 * Shape of a GhostwrAIter workspace backup archive.
 *
 * The archive is a plain ZIP so that a user can inspect or salvage it without
 * the application. Its layout is fixed:
 *
 *   manifest.json              this manifest, always the first entry
 *   data/ghostwraiter.db       a consistent snapshot of the SQLite database
 *   files/<relative path>      workspace files worth restoring
 *
 * The database is snapshotted with `VACUUM INTO`, never copied. The live
 * database runs in WAL mode, so a file copy silently drops every transaction
 * still sitting in `ghostwraiter.db-wal`, which is exactly the most recent work
 * the user wants backed up.
 */

/**
 * Bumped whenever the archive layout changes in a way an older application
 * cannot read. Import refuses an unknown version instead of guessing, because
 * a partial restore over a live workspace is worse than a refusal.
 */
export const ARCHIVE_FORMAT_VERSION = 1;

export const MANIFEST_ENTRY_NAME = "manifest.json";
export const DATABASE_ENTRY_NAME = "data/ghostwraiter.db";
/** Directory holding workspace files inside the archive, without separator. */
export const FILES_DIRECTORY = "files";
/** Same directory as an entry-name prefix, where the separator is part of the name. */
export const FILES_ENTRY_PREFIX = `${FILES_DIRECTORY}/`;

export type ArchiveManifest = {
  formatVersion: number;
  appVersion: string;
  exportedAt: string;
  /**
   * Row count per table, read from the snapshot rather than from the live
   * database. It is what the import confirmation shows the user before they
   * commit, and what the export gate compares against the source.
   */
  tableCounts: Record<string, number>;
  fileCount: number;
};

/**
 * Directories excluded from every export, relative to the workspace root.
 *
 * `content/exports` holds previous archives, including the one being written
 * when a user picks the default directory: including it would nest backups
 * inside backups and grow without bound.
 *
 * `logs` holds raw CLI execution transcripts. `PrivacyService` exists to purge
 * them, so shipping them into a file the user may store elsewhere or send to
 * someone would undo that. They are reproducible output, not authored content.
 */
export const EXCLUDED_DIRECTORIES = ["content/exports", "logs"] as const;

/**
 * Files excluded by name pattern anywhere in the workspace.
 *
 * The SQLite sidecars belong to the live database and are meaningless next to
 * a `VACUUM INTO` snapshot. The `.bak-*` copies are previous manual backups
 * that would multiply on every export.
 */
export function isExcludedFile(fileName: string): boolean {
  if (fileName.endsWith("-wal") || fileName.endsWith("-shm")) return true;
  if (fileName.includes(".db.bak-")) return true;
  return fileName === ".DS_Store";
}

/**
 * Rejects any archive entry name that would let extraction write outside the
 * destination directory.
 *
 * A ZIP stores entry names as free text, so a hostile or corrupt archive can
 * carry `../../.ssh/authorized_keys` or `/etc/passwd`. In practice yauzl
 * already refuses both before emitting an entry, so this is the second of
 * three locks, not the first: name text here, then the resolved path through
 * `assertUnderRoot`. It is deliberately kept even though it is currently
 * redundant, because it is what still holds if a yauzl option or version
 * change stops validating on our behalf.
 *
 * Backslashes are rejected outright rather than folded into slashes the way
 * yauzl does: a legitimate GhostwrAIter archive never contains one, since
 * entry names are always written with forward slashes on every platform.
 */
export function isSafeEntryName(entryName: string): boolean {
  if (entryName.length === 0) return false;
  if (entryName.startsWith("/")) return false;
  if (entryName.includes("\\")) return false;
  if (entryName.includes("\0")) return false;
  // Windows drive letters, e.g. "C:/Windows/System32".
  if (/^[a-zA-Z]:/.test(entryName)) return false;
  return !entryName.split("/").includes("..");
}

import type BetterSqlite3 from "better-sqlite3";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import {
  ARCHIVE_FORMAT_VERSION,
  DATABASE_ENTRY_NAME,
  EXCLUDED_DIRECTORIES,
  FILES_ENTRY_PREFIX,
  isExcludedFile,
  MANIFEST_ENTRY_NAME,
  type ArchiveManifest
} from "./archive-format";
import { writeArchive, type ArchiveSource } from "./workspace-archive";

export type ExportResult = {
  exportPath: string;
  tableCounts: Record<string, number>;
  fileCount: number;
  byteSize: number;
};

/**
 * Default file name offered by the save dialog.
 *
 * Dated down to the minute so that successive backups sort chronologically and
 * do not silently overwrite each other. The date is a parameter rather than a
 * `new Date()` call so the naming can be asserted without measuring the clock
 * of the machine running the test.
 */
export function buildDefaultExportFileName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `ghostwraiter-sauvegarde-${stamp}.zip`;
}

/**
 * Lists every user table in a database, excluding SQLite's own bookkeeping.
 *
 * Read from `sqlite_master` rather than from a hardcoded list: a table added
 * later is counted without anyone remembering to update this file, which is
 * the only version of this check that cannot quietly go stale.
 */
export function listUserTables(database: BetterSqlite3.Database): string[] {
  const rows = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all() as { name: string }[];
  return rows.map((row) => row.name);
}

export function countRowsPerTable(
  database: BetterSqlite3.Database
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const table of listUserTables(database)) {
    // Table names come from sqlite_master, never from user input, and SQLite
    // does not accept an identifier as a bound parameter.
    const row = database.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get() as {
      total: number;
    };
    counts[table] = row.total;
  }
  return counts;
}

function isExcludedDirectory(relativePath: string): boolean {
  const normalized = relativePath.split(sep).join("/");
  return EXCLUDED_DIRECTORIES.some(
    (excluded) => normalized === excluded || normalized.startsWith(`${excluded}/`)
  );
}

function collectFiles(
  rootDirectory: string,
  currentDirectory: string,
  collected: ArchiveSource[]
): void {
  for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
    const absolutePath = join(currentDirectory, entry.name);
    const relativePath = relative(rootDirectory, absolutePath);

    if (entry.isDirectory()) {
      if (isExcludedDirectory(relativePath)) continue;
      collectFiles(rootDirectory, absolutePath, collected);
      continue;
    }

    if (!entry.isFile()) continue;
    if (isExcludedFile(entry.name)) continue;

    collected.push({
      entryName: `${FILES_ENTRY_PREFIX}${relativePath.split(sep).join("/")}`,
      sourcePath: absolutePath
    });
  }
}

export class ExportService {
  constructor(
    private readonly database: BetterSqlite3.Database,
    private readonly workspaceRoot: string,
    private readonly databasePath: string,
    private readonly appVersion: string
  ) {}

  /**
   * Writes a restorable backup of the workspace at `destinationPath`.
   *
   * What earlier versions produced was a listing: directory names, log file
   * names, and an empty `manifestPreview` whose only branch read files at the
   * workspace root, where there are none. It restored nothing while announcing
   * a backup was ready.
   */
  async exportWorkspace(destinationPath: string): Promise<ExportResult> {
    const stagingDirectory = mkdtempSync(join(tmpdir(), "ghostwraiter-export-"));
    const snapshotPath = join(stagingDirectory, "ghostwraiter.db");

    try {
      // A file copy would drop everything still in the write-ahead log, which
      // is precisely the user's most recent work. VACUUM INTO writes one
      // consistent file with no sidecars, from the live connection.
      this.database.prepare("VACUUM INTO ?").run(snapshotPath);

      const files: ArchiveSource[] = [];
      collectFiles(this.workspaceRoot, this.workspaceRoot, files);
      const databaseFileName = this.databasePath.split(sep).pop() ?? "";
      const withoutLiveDatabase = files.filter(
        (file) => !file.entryName.endsWith(`/${databaseFileName}`)
      );

      const manifest: ArchiveManifest = {
        formatVersion: ARCHIVE_FORMAT_VERSION,
        appVersion: this.appVersion,
        exportedAt: new Date().toISOString(),
        tableCounts: countRowsPerTable(this.database),
        fileCount: withoutLiveDatabase.length
      };

      await writeArchive(
        [
          { entryName: MANIFEST_ENTRY_NAME, content: JSON.stringify(manifest, null, 2) },
          { entryName: DATABASE_ENTRY_NAME, sourcePath: snapshotPath },
          ...withoutLiveDatabase
        ],
        destinationPath
      );

      return {
        exportPath: destinationPath,
        tableCounts: manifest.tableCounts,
        fileCount: manifest.fileCount,
        byteSize: statSync(destinationPath).size
      };
    } finally {
      rmSync(stagingDirectory, { recursive: true, force: true });
    }
  }
}

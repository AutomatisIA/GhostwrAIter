import type BetterSqlite3 from "better-sqlite3";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { assertUnderRoot } from "../../workspace/workspace.service";
import {
  ARCHIVE_FORMAT_VERSION,
  DATABASE_ENTRY_NAME,
  FILES_DIRECTORY,
  MANIFEST_ENTRY_NAME,
  type ArchiveManifest
} from "./archive-format";
import { listUserTables } from "./export.service";
import { extractArchive, readArchiveEntry } from "./workspace-archive";

export class ArchiveRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveRejectedError";
  }
}

export type ImportPreview = {
  formatVersion: number;
  appVersion: string;
  exportedAt: string;
  tableCounts: Record<string, number>;
  fileCount: number;
};

export type ImportResult = {
  restoredTables: Record<string, number>;
  /** Tables the archive holds that this version of the app does not know. */
  ignoredTables: string[];
  restoredFileCount: number;
  /** Snapshot of the pre-import database, kept so a mistaken import is undoable. */
  backupPath: string;
};

function parseManifest(raw: string): ArchiveManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ArchiveRejectedError(
      "Ce fichier n'est pas une sauvegarde GhostwrAIter : son manifeste est illisible."
    );
  }

  const manifest = parsed as Partial<ArchiveManifest>;
  if (typeof manifest?.formatVersion !== "number") {
    throw new ArchiveRejectedError(
      "Ce fichier n'est pas une sauvegarde GhostwrAIter : son manifeste est incomplet."
    );
  }
  if (manifest.formatVersion > ARCHIVE_FORMAT_VERSION) {
    throw new ArchiveRejectedError(
      `Cette sauvegarde a été créée par une version plus récente de GhostwrAIter ` +
        `(format ${manifest.formatVersion}, cette version lit jusqu'au format ${ARCHIVE_FORMAT_VERSION}). ` +
        "Mettez l'application à jour avant de l'importer."
    );
  }

  return {
    formatVersion: manifest.formatVersion,
    appVersion: typeof manifest.appVersion === "string" ? manifest.appVersion : "inconnue",
    exportedAt: typeof manifest.exportedAt === "string" ? manifest.exportedAt : "",
    tableCounts:
      manifest.tableCounts && typeof manifest.tableCounts === "object"
        ? manifest.tableCounts
        : {},
    fileCount: typeof manifest.fileCount === "number" ? manifest.fileCount : 0
  };
}

function columnsOf(
  database: BetterSqlite3.Database,
  schema: string,
  table: string
): string[] {
  const rows = database.pragma(`${schema}.table_info("${table}")`) as { name: string }[];
  return rows.map((row) => row.name);
}

function restoreFiles(extractionDirectory: string, workspaceRoot: string): number {
  // Joined from the separator-free constant: a trailing slash in the base of
  // `relative()` happens to be absorbed on both POSIX and Windows, but relying
  // on that is a platform question nobody should have to re-answer.
  const filesRoot = join(extractionDirectory, FILES_DIRECTORY);
  if (!existsSync(filesRoot)) return 0;

  let restored = 0;
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;

      const relativePath = relative(filesRoot, absolutePath);
      // Third check on top of the two performed during extraction: the copy
      // target is built here, so it is verified here too.
      const target = assertUnderRoot(join(workspaceRoot, relativePath), workspaceRoot);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(absolutePath, target);
      restored += 1;
    }
  };
  walk(filesRoot);
  return restored;
}

export class ImportService {
  constructor(
    private readonly database: BetterSqlite3.Database,
    private readonly workspaceRoot: string,
    private readonly databaseDirectory: string
  ) {}

  /**
   * Reads what an archive holds without touching anything.
   *
   * The confirmation dialog needs this: replacing a workspace is destructive,
   * so the user must see "10 idées, 30 brouillons" from the archive before
   * they commit, not after.
   */
  async previewArchive(archivePath: string): Promise<ImportPreview> {
    const raw = await readArchiveEntry(archivePath, MANIFEST_ENTRY_NAME);
    if (!raw) {
      throw new ArchiveRejectedError(
        "Ce fichier n'est pas une sauvegarde GhostwrAIter : il ne contient pas de manifeste."
      );
    }
    return parseManifest(raw.toString("utf8"));
  }

  /**
   * Replaces the workspace with the contents of the archive.
   *
   * The database is restored through ATTACH rather than by overwriting the
   * file: eight services hold the live connection, Windows would refuse the
   * swap outright, and on macOS the running process would keep pointing at the
   * replaced inode. One connection throughout, one transaction, no restart.
   */
  async importWorkspace(archivePath: string, now: Date): Promise<ImportResult> {
    // Validates the manifest before anything is extracted or replaced: an
    // archive this version cannot read must be refused while the workspace is
    // still untouched.
    await this.previewArchive(archivePath);
    const stagingDirectory = mkdtempSync(join(tmpdir(), "ghostwraiter-import-"));

    try {
      await extractArchive(archivePath, stagingDirectory);

      const importedDatabasePath = join(stagingDirectory, DATABASE_ENTRY_NAME);
      if (!existsSync(importedDatabasePath)) {
        throw new ArchiveRejectedError(
          "Ce fichier n'est pas une sauvegarde GhostwrAIter : il ne contient pas de base de données."
        );
      }

      const backupPath = this.backupCurrentDatabase(now);

      // ATTACH and PRAGMA foreign_keys are both refused inside a transaction,
      // so they are set up before BEGIN and undone after COMMIT.
      const foreignKeysWereOn = this.database.pragma("foreign_keys", { simple: true }) === 1;
      if (foreignKeysWereOn) this.database.pragma("foreign_keys = OFF");
      this.database.prepare("ATTACH DATABASE ? AS imported").run(importedDatabasePath);

      try {
        const targetTables = listUserTables(this.database);
        const importedTables = new Set(
          (
            this.database
              .prepare(
                "SELECT name FROM imported.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
              )
              .all() as { name: string }[]
          ).map((row) => row.name)
        );

        const restoredTables: Record<string, number> = {};

        this.database.transaction(() => {
          for (const table of targetTables) {
            // Emptied even when the archive does not carry the table. Leaving
            // current rows in place would blend two different workspaces:
            // restored drafts alongside stale versions of themselves, with
            // identifiers pointing at rows that no longer exist. A visible
            // gap beats a silent inconsistency.
            this.database.prepare(`DELETE FROM main."${table}"`).run();
            if (!importedTables.has(table)) {
              restoredTables[table] = 0;
              continue;
            }

            const targetColumns = columnsOf(this.database, "main", table);
            const sourceColumns = new Set(columnsOf(this.database, "imported", table));
            const shared = targetColumns.filter((column) => sourceColumns.has(column));
            if (shared.length === 0) {
              restoredTables[table] = 0;
              continue;
            }

            const columnList = shared.map((column) => `"${column}"`).join(", ");
            const result = this.database
              .prepare(
                `INSERT INTO main."${table}" (${columnList}) SELECT ${columnList} FROM imported."${table}"`
              )
              .run();
            restoredTables[table] = result.changes;
          }
        })();

        const ignoredTables = [...importedTables]
          .filter((table) => !targetTables.includes(table))
          .sort();

        return {
          restoredTables,
          ignoredTables,
          restoredFileCount: restoreFiles(stagingDirectory, this.workspaceRoot),
          backupPath
        };
      } finally {
        this.database.prepare("DETACH DATABASE imported").run();
        if (foreignKeysWereOn) this.database.pragma("foreign_keys = ON");
      }
    } finally {
      rmSync(stagingDirectory, { recursive: true, force: true });
    }
  }

  /**
   * Snapshots the current database before it is replaced.
   *
   * An import the user regrets is otherwise unrecoverable, and the request
   * that led here was itself about recovering from a problem.
   */
  private backupCurrentDatabase(now: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    const stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    mkdirSync(this.databaseDirectory, { recursive: true });
    const backupPath = join(
      this.databaseDirectory,
      `ghostwraiter.db.bak-avant-import-${stamp}`
    );
    rmSync(backupPath, { force: true });
    this.database.prepare("VACUUM INTO ?").run(backupPath);
    return backupPath;
  }
}

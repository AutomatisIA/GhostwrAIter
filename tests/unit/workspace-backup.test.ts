import Database from "better-sqlite3";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ARCHIVE_FORMAT_VERSION,
  DATABASE_ENTRY_NAME,
  isSafeEntryName,
  MANIFEST_ENTRY_NAME,
  type ArchiveManifest
} from "../../app/main/domains/export/archive-format";
import {
  buildDefaultExportFileName,
  countRowsPerTable,
  ExportService
} from "../../app/main/domains/export/export.service";
import {
  ArchiveRejectedError,
  ImportService
} from "../../app/main/domains/export/import.service";
import {
  extractArchive,
  UnsafeArchiveEntryError,
  writeArchive
} from "../../app/main/domains/export/workspace-archive";
import {
  SettingsRuntimeService,
  type WorkspaceBackupDialogs
} from "../../app/main/ipc/settings-ipc";
import { PrivacyService } from "../../app/main/domains/privacy/privacy.service";
import { summarizeArchiveContents } from "../../app/shared/backup-summary";
import { createIdeasTables, IdeasRepository } from "../../app/main/domains/ideas/ideas.repository";
import { createStrategyTables, StrategyRepository } from "../../app/main/domains/strategy/strategy.repository";
import { createWorkshopTables } from "../../app/main/domains/workshop/workshop.service";
import { SettingsService } from "../../app/main/domains/settings/settings.service";

/**
 * Round-trip gate for the workspace backup.
 *
 * The feature it replaces was green on its own test while exporting nothing a
 * user had written: the assertions checked that a file had been produced and
 * that it listed execution logs, never that a single row of the database was
 * in it. This file therefore asserts on the restored side, by name and by row
 * count over every table, because that is the only thing a backup is for.
 */

const TEMP_DIRECTORIES: string[] = [];
const OPEN_DATABASES: Database.Database[] = [];

function makeTempDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  TEMP_DIRECTORIES.push(directory);
  return directory;
}

type Workspace = {
  root: string;
  databasePath: string;
  database: Database.Database;
};

function createWorkspace(prefix: string): Workspace {
  const root = makeTempDirectory(prefix);
  for (const directory of [
    "content/strategy",
    "content/ideas",
    "content/drafts",
    "content/exports",
    "data",
    "logs/executions",
    "skills",
    "config"
  ]) {
    mkdirSync(join(root, directory), { recursive: true });
  }

  const databasePath = join(root, "data", "ghostwraiter.db");
  const database = new Database(databasePath);
  // Same journal mode as the running application. It is what makes the
  // snapshot question meaningful: rows committed here stay in the -wal file,
  // so a copy of ghostwraiter.db would not carry them.
  database.pragma("journal_mode = WAL");
  createIdeasTables(database);
  createStrategyTables(database);
  createWorkshopTables(database);
  new SettingsService(database);
  OPEN_DATABASES.push(database);

  return { root, databasePath, database };
}

function seedWorkspace(workspace: Workspace) {
  new StrategyRepository(workspace.database).saveStrategyBundle({
    profile: {
      name: "Philippe",
      positioning: "Consultant IA generative pour PME",
      bio: "J aide les PME a deployer l IA sans theatre.",
      expertiseSummary: "Adoption IA, cadrage, ROI."
    },
    offers: [
      {
        name: "Audit IA PME",
        promise: "Prioriser les cas d usage deployables.",
        problems: "Trop d idees, pas de priorisation.",
        proofPoints: "",
        ctaModes: ""
      }
    ],
    icps: [
      {
        segment: "Dirigeants de PME industrielles",
        pains: "Pression sur les marges",
        desiredOutcomes: "Gagner du temps",
        objections: "Trop cher",
        languageCues: "Terrain, marge, cadence"
      }
    ],
    pillars: [
      { label: "Adoption IA", description: "Montrer le reel", position: 0, isDefault: false }
    ],
    voiceRules: [{ category: "ton", ruleText: "Pas de superlatif", ruleType: "dont" }]
  });

  const ideas = new IdeasRepository(workspace.database);
  ideas.createIdea({
    title: "Pourquoi les PME ratent l adoption IA",
    angle: "Le probleme est organisationnel avant d etre technique",
    pillarLabel: "Adoption IA",
    targetIcpSegment: "Dirigeants de PME industrielles"
  });

  const idea = ideas.listIdeas()[0];
  workspace.database
    .prepare(
      `INSERT INTO drafts (id, idea_id, headline, body_markdown, quality_score, created_at, status,
        typology, objective, structure_key, structure_label, selected_hook_text)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', 'expertise', 'awareness', 'belief-terrain-reality',
        'Croyance -> terrain -> realite', ?)`
    )
    .run(
      "draft_seed_1",
      idea?.id ?? "idea_missing",
      "Trois signaux qu une PME n est pas prete",
      "Corps du brouillon de reference.",
      0.72,
      new Date("2026-07-20T09:00:00.000Z").toISOString(),
      "Trois signaux qu une PME n est pas prete"
    );

  // A tag and its link to the draft. Link tables are the one place a
  // count-based comparison can pass over structurally broken data: 242 rows
  // restored say nothing if they point at identifiers that no longer exist.
  workspace.database
    .prepare("INSERT INTO tags (id, label, normalized_label) VALUES (?, ?, ?)")
    .run("tag_seed_1", "Adoption IA", "adoption ia");
  workspace.database
    .prepare("INSERT INTO tag_links (id, draft_id, tag_id) VALUES (?, ?, ?)")
    .run("taglink_seed_1", "draft_seed_1", "tag_seed_1");

  new SettingsService(workspace.database).setPreference("theme", "dark");

  // Authored content, restored. Execution logs and previous exports, excluded.
  writeFileSync(join(workspace.root, "content", "strategy", "note.md"), "# Positionnement\n");
  writeFileSync(join(workspace.root, "logs", "executions", "run-1.json"), '{"prompt":"secret"}');
  writeFileSync(join(workspace.root, "content", "exports", "old-backup.zip"), "PKstale");
}

afterEach(() => {
  while (OPEN_DATABASES.length > 0) OPEN_DATABASES.pop()?.close();
  while (TEMP_DIRECTORIES.length > 0) {
    const directory = TEMP_DIRECTORIES.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

describe("workspace backup, export side", () => {
  it("carries every row of every table, including rows still in the write-ahead log", async () => {
    const workspace = createWorkspace("ghostwraiter-source-");
    seedWorkspace(workspace);
    // Deliberately NOT checkpointed. A file copy of ghostwraiter.db would lose
    // everything seeded above; VACUUM INTO does not. This omission is the
    // whole discriminating power of the assertion below.

    const destination = join(makeTempDirectory("ghostwraiter-dest-"), "backup.zip");
    const result = await new ExportService(
      workspace.database,
      workspace.root,
      workspace.databasePath,
      "2.0.1"
    ).exportWorkspace(destination);

    expect(existsSync(destination)).toBe(true);

    const extracted = makeTempDirectory("ghostwraiter-open-");
    const entries = await extractArchive(destination, extracted);
    expect(entries).toContain(MANIFEST_ENTRY_NAME);
    expect(entries).toContain(DATABASE_ENTRY_NAME);

    const snapshot = new Database(join(extracted, DATABASE_ENTRY_NAME), { readonly: true });
    OPEN_DATABASES.push(snapshot);

    // Whole-schema comparison rather than a handful of named tables: a table
    // added later is covered without anyone remembering to extend this test.
    const sourceCounts = countRowsPerTable(workspace.database);
    expect(countRowsPerTable(snapshot)).toEqual(sourceCounts);
    expect(result.tableCounts).toEqual(sourceCounts);

    // And the counts are not all zero, which would make the equality vacuous.
    expect(sourceCounts.ideas).toBe(1);
    expect(sourceCounts.drafts).toBe(1);
    expect(sourceCounts.icps).toBe(1);
    expect(sourceCounts.app_settings).toBeGreaterThan(0);

    expect(
      snapshot.prepare("SELECT target_icp_segment AS segment FROM ideas").get()
    ).toEqual({ segment: "Dirigeants de PME industrielles" });
  });

  it("carries authored files but neither execution logs nor previous exports", async () => {
    const workspace = createWorkspace("ghostwraiter-source-");
    seedWorkspace(workspace);

    const destination = join(makeTempDirectory("ghostwraiter-dest-"), "backup.zip");
    await new ExportService(
      workspace.database,
      workspace.root,
      workspace.databasePath,
      "2.0.1"
    ).exportWorkspace(destination);

    const extracted = makeTempDirectory("ghostwraiter-open-");
    const entries = await extractArchive(destination, extracted);

    expect(entries).toContain("files/content/strategy/note.md");
    expect(entries.some((entry) => entry.includes("logs/executions"))).toBe(false);
    expect(entries.some((entry) => entry.includes("content/exports"))).toBe(false);
    // The live database file is snapshotted, never copied alongside itself.
    expect(entries.filter((entry) => entry.endsWith("ghostwraiter.db"))).toEqual([
      DATABASE_ENTRY_NAME
    ]);
  });

  it("names the file by date so successive backups never overwrite each other", () => {
    expect(buildDefaultExportFileName(new Date(2026, 6, 26, 14, 5))).toBe(
      "ghostwraiter-sauvegarde-20260726-1405.zip"
    );
  });
});

describe("workspace backup, import side", () => {
  async function exportSeededWorkspace() {
    const source = createWorkspace("ghostwraiter-source-");
    seedWorkspace(source);
    const destination = join(makeTempDirectory("ghostwraiter-dest-"), "backup.zip");
    await new ExportService(
      source.database,
      source.root,
      source.databasePath,
      "2.0.1"
    ).exportWorkspace(destination);
    return { source, destination };
  }

  it("restores an idea, its target and its draft by name into an empty workspace", async () => {
    const { source, destination } = await exportSeededWorkspace();
    const target = createWorkspace("ghostwraiter-target-");

    const result = await new ImportService(
      target.database,
      target.root,
      join(target.root, "data")
    ).importWorkspace(destination, new Date(2026, 6, 26, 14, 30, 0));

    expect(
      target.database.prepare("SELECT title, target_icp_segment AS segment FROM ideas").get()
    ).toEqual({
      title: "Pourquoi les PME ratent l adoption IA",
      segment: "Dirigeants de PME industrielles"
    });
    expect(target.database.prepare("SELECT segment FROM icps").get()).toEqual({
      segment: "Dirigeants de PME industrielles"
    });
    expect(target.database.prepare("SELECT headline FROM drafts").get()).toEqual({
      headline: "Trois signaux qu une PME n est pas prete"
    });

    // Every table, not only the three named above.
    expect(countRowsPerTable(target.database)).toEqual(countRowsPerTable(source.database));

    // Foreign keys are disabled during the restore transaction, so the counts
    // above would be satisfied by link rows pointing at nothing. This resolves
    // one through both sides of the join.
    expect(
      target.database
        .prepare(
          `SELECT t.label AS label, d.headline AS headline
           FROM tag_links l
           JOIN tags t ON t.id = l.tag_id
           JOIN drafts d ON d.id = l.draft_id`
        )
        .get()
    ).toEqual({
      label: "Adoption IA",
      headline: "Trois signaux qu une PME n est pas prete"
    });

    expect(readFileSync(join(target.root, "content", "strategy", "note.md"), "utf8")).toBe(
      "# Positionnement\n"
    );
    expect(result.restoredFileCount).toBeGreaterThan(0);
    expect(existsSync(result.backupPath)).toBe(true);
  });

  it("replaces existing rows instead of blending two workspaces", async () => {
    const { destination } = await exportSeededWorkspace();
    const target = createWorkspace("ghostwraiter-target-");
    new IdeasRepository(target.database).createIdea({
      title: "Idee locale a remplacer",
      angle: "Elle ne doit pas survivre a un import",
      pillarLabel: "Autre"
    });

    await new ImportService(
      target.database,
      target.root,
      join(target.root, "data")
    ).importWorkspace(destination, new Date(2026, 6, 26, 14, 30, 0));

    const titles = (
      target.database.prepare("SELECT title FROM ideas").all() as { title: string }[]
    ).map((row) => row.title);
    expect(titles).toEqual(["Pourquoi les PME ratent l adoption IA"]);
  });

  it("shows what an archive holds before anything is replaced", async () => {
    const { destination } = await exportSeededWorkspace();
    const target = createWorkspace("ghostwraiter-target-");

    const preview = await new ImportService(
      target.database,
      target.root,
      join(target.root, "data")
    ).previewArchive(destination);

    expect(preview.formatVersion).toBe(ARCHIVE_FORMAT_VERSION);
    expect(preview.appVersion).toBe("2.0.1");
    expect(preview.tableCounts.ideas).toBe(1);
    // Nothing was touched by the preview.
    expect(countRowsPerTable(target.database).ideas).toBe(0);
  });

  it("refuses an archive written by a newer version rather than restoring it partly", async () => {
    const target = createWorkspace("ghostwraiter-target-");
    const future: ArchiveManifest = {
      formatVersion: ARCHIVE_FORMAT_VERSION + 1,
      appVersion: "9.9.9",
      exportedAt: "2027-01-01T00:00:00.000Z",
      tableCounts: { ideas: 3 },
      fileCount: 0
    };
    const archivePath = join(makeTempDirectory("ghostwraiter-dest-"), "future.zip");
    await writeArchive(
      [{ entryName: MANIFEST_ENTRY_NAME, content: JSON.stringify(future) }],
      archivePath
    );

    const service = new ImportService(target.database, target.root, join(target.root, "data"));
    await expect(service.importWorkspace(archivePath, new Date())).rejects.toBeInstanceOf(
      ArchiveRejectedError
    );

    // Refusing on the manifest must release the file too: this path reads a
    // single entry rather than extracting, and it closes its own descriptor.
    rmSync(archivePath);
    expect(existsSync(archivePath)).toBe(false);
  });

  it("refuses an archive whose entry name escapes the destination", async () => {
    const holder = makeTempDirectory("ghostwraiter-evasion-");
    const destinationDirectory = join(holder, "inside");
    const escapedPath = join(holder, "escaped.txt");

    // yazl validates entry names and will not write "../escaped.txt", so the
    // hostile archive is forged: a legitimate archive is written, then the
    // stored name is overwritten in place with a traversal name of exactly the
    // same byte length, which leaves every ZIP offset valid. The name appears
    // in both the local header and the central directory, hence replaceAll.
    const innocent = "xx/escaped.txt";
    const hostile = "../escaped.txt";
    expect(hostile.length).toBe(innocent.length);

    const archivePath = join(makeTempDirectory("ghostwraiter-dest-"), "hostile.zip");
    await writeArchive(
      [{ entryName: innocent, content: "written outside the destination" }],
      archivePath
    );
    const forged = readFileSync(archivePath);
    let cursor = forged.indexOf(innocent, 0, "latin1");
    while (cursor !== -1) {
      forged.write(hostile, cursor, "latin1");
      cursor = forged.indexOf(innocent, cursor + 1, "latin1");
    }
    writeFileSync(archivePath, forged);

    await expect(extractArchive(archivePath, destinationDirectory)).rejects.toBeInstanceOf(
      UnsafeArchiveEntryError
    );
    expect(existsSync(escapedPath)).toBe(false);

    // A refused archive must also be released. Windows cannot delete or move a
    // file whose descriptor is still open, so a refusal that returns before the
    // descriptor is closed leaves the user's own archive locked. POSIX unlinks
    // open files happily, which is why this only bites on one platform, and why
    // it is asserted explicitly rather than left to the cleanup hook: it first
    // showed up as an intermittent ENOTEMPTY on the Windows runner.
    rmSync(archivePath);
    expect(existsSync(archivePath)).toBe(false);
  });
});

describe("workspace backup, IPC surface", () => {
  function buildRuntime(workspace: Workspace, dialogs: Partial<WorkspaceBackupDialogs>) {
    // Defaults refuse everything, so a test that forgets to override a dialog
    // gets a cancellation rather than a silent real operation.
    const service = new SettingsRuntimeService(
      new ExportService(
        workspace.database,
        workspace.root,
        workspace.databasePath,
        "2.0.1"
      ),
      new PrivacyService(join(workspace.root, "logs", "executions")),
      new SettingsService(workspace.database),
      undefined,
      new ImportService(workspace.database, workspace.root, join(workspace.root, "data")),
      {
        askExportDestination: async () => null,
        askArchiveToImport: async () => null,
        confirmImport: async () => false,
        ...dialogs
      }
    );
    return { service };
  }

  it("treats a closed save dialog as a cancellation, not a failure", async () => {
    const workspace = createWorkspace("ghostwraiter-source-");
    const { service } = buildRuntime(workspace, {});

    await expect(service.exportWorkspace()).resolves.toEqual({ canceled: true });
  });

  it("does not replace anything when the confirmation is declined", async () => {
    const source = createWorkspace("ghostwraiter-source-");
    seedWorkspace(source);
    const archivePath = join(makeTempDirectory("ghostwraiter-dest-"), "backup.zip");
    await new ExportService(
      source.database,
      source.root,
      source.databasePath,
      "2.0.1"
    ).exportWorkspace(archivePath);

    const target = createWorkspace("ghostwraiter-target-");
    new IdeasRepository(target.database).createIdea({
      title: "Idee locale conservee",
      angle: "Le refus de confirmer ne doit rien detruire",
      pillarLabel: "Autre"
    });
    let confirmationsAsked = 0;
    let summaryShown = "";
    const { service } = buildRuntime(target, {
      askArchiveToImport: async () => archivePath,
      confirmImport: async (preview) => {
        confirmationsAsked += 1;
        summaryShown = summarizeArchiveContents(preview.tableCounts);
        return false;
      }
    });

    await expect(service.importWorkspace()).resolves.toEqual({ canceled: true });
    // The confirmation was actually asked, and it named what the archive holds
    // rather than asking a blank question.
    expect(confirmationsAsked).toBe(1);
    expect(summaryShown).toContain("1 idée");
    expect(summaryShown).toContain("1 cible");
    expect(
      (target.database.prepare("SELECT title FROM ideas").all() as { title: string }[]).map(
        (row) => row.title
      )
    ).toEqual(["Idee locale conservee"]);
  });

  it("asks for the destination itself, so the renderer never supplies a path", async () => {
    const workspace = createWorkspace("ghostwraiter-source-");
    seedWorkspace(workspace);
    const destination = join(makeTempDirectory("ghostwraiter-dest-"), "chosen.zip");
    let offeredDefault = "";
    const { service } = buildRuntime(workspace, {
      askExportDestination: async (defaultFileName) => {
        offeredDefault = defaultFileName;
        return destination;
      }
    });

    const result = await service.exportWorkspace();

    expect(result.canceled).toBe(false);
    expect(existsSync(destination)).toBe(true);
    expect(offeredDefault).toMatch(/^ghostwraiter-sauvegarde-\d{8}-\d{4}\.zip$/);
    // exportWorkspace takes no argument: there is no path parameter for a
    // renderer to populate, which is what makes the guarantee structural.
    expect(service.exportWorkspace.length).toBe(0);
  });
});

describe("archive entry names", () => {
  it.each([
    ["../escaped.txt", "parent traversal"],
    ["files/../../escaped.txt", "traversal in the middle"],
    ["/etc/passwd", "absolute POSIX path"],
    ["C:/Windows/System32/drivers/etc/hosts", "Windows drive letter"],
    ["files\\..\\escaped.txt", "backslash separators"],
    ["", "empty name"]
  ])("rejects %s (%s)", (entryName) => {
    expect(isSafeEntryName(entryName)).toBe(false);
  });

  it.each(["manifest.json", "data/ghostwraiter.db", "files/content/strategy/note.md"])(
    "accepts %s",
    (entryName) => {
      expect(isSafeEntryName(entryName)).toBe(true);
    }
  );
});

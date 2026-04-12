import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

const root = process.cwd();
const directories = [
  "app/main/db",
  "app/main/domains/strategy",
  "app/main/domains/ideas",
  "app/main/domains/content",
  "app/main/domains/library",
  "app/main/domains/calendar",
  "app/main/domains/export",
  "app/main/domains/privacy",
  "app/main/ipc",
  "app/main/logging",
  "app/main/runner",
  "app/main/workspace",
  "app/preload",
  "app/shared/schemas",
  "content/strategy",
  "content/ideas",
  "content/drafts",
  "content/published",
  "content/research",
  "content/exports",
  "data",
  "data/migrations",
  "logs/executions",
  "skills/linkedin-strategy-foundation",
  "skills/linkedin-topic-generator",
  "skills/linkedin-hook-engine",
  "skills/linkedin-structure-selector",
  "skills/linkedin-post-writer",
  "skills/linkedin-post-editor",
  "skills/linkedin-repurpose",
  "skills/linkedin-news-to-post",
  "tests/unit",
  "tests/integration",
  "tests/e2e"
];

for (const directory of directories) {
  mkdirSync(join(root, directory), { recursive: true });
}

const placeholderFiles = [
  "content/strategy/.gitkeep",
  "content/ideas/.gitkeep",
  "content/drafts/.gitkeep",
  "content/published/.gitkeep",
  "content/research/.gitkeep",
  "content/exports/.gitkeep",
  "logs/executions/.gitkeep",
  "data/migrations/.gitkeep",
  "tests/unit/.gitkeep",
  "tests/integration/.gitkeep",
  "tests/e2e/.gitkeep"
];

for (const file of placeholderFiles) {
  const fullPath = join(root, file);
  if (!existsSync(fullPath)) {
    writeFileSync(fullPath, "");
  }
}

const dbPath = join(root, "data", "ghostwraiter.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS workspace_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

db.prepare(`
  INSERT OR IGNORE INTO workspace_meta (key, value)
  VALUES (?, ?)
`).run("initialized_at", new Date().toISOString());

db.close();

const readmePath = join(root, "skills", "README.md");
if (!existsSync(readmePath)) {
  writeFileSync(
    readmePath,
    [
      "# GhostwrAIter Skills",
      "",
      "Les skills du MVP seront implementees ici avec leur `SKILL.md`, schemas et templates."
    ].join("\n")
  );
}

console.log(`Workspace initialized at ${dirname(dbPath)}`);

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { IdeasRepository } from "../ideas/ideas.repository";
import type { StrategyBundle } from "../../../shared/types/strategy";
import type { WorkshopSession } from "../../../shared/types/workshop";

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;

  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

function tokenizeTags(input: string) {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .split(/[^a-z0-9à-ÿ]+/i)
        .filter((token) => token.length >= 5)
    )
  ).slice(0, 6);
}

export function createWorkshopTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL,
      headline TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      quality_score REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS draft_versions (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      quality_score REAL NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hooks (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS execution_runs (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL,
      draft_id TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      normalized_label TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS tag_links (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      UNIQUE(draft_id, tag_id)
    );
  `);

  ensureColumn(db, "drafts", "status", "status TEXT NOT NULL DEFAULT 'draft'");
  ensureColumn(db, "drafts", "source_draft_id", "source_draft_id TEXT");
}

export class WorkshopService {
  constructor(
    private readonly db: Database.Database,
    private readonly ideasRepository: IdeasRepository,
    private readonly getActiveStrategy?: () => StrategyBundle | null,
    private readonly executionLogsDirectory?: string
  ) {}

  generateDraftFromIdea(ideaId: string): WorkshopSession {
    const idea = this.ideasRepository.getIdeaById(ideaId);
    const draftId = createId("draft");
    const createdAt = new Date().toISOString();
    const headline = idea.title;
    const bodyMarkdown = [
      `${idea.title}.`,
      "",
      `${idea.angle}.`,
      "",
      "Ce post part d'un constat terrain en PME : le blocage vient souvent du process avant de venir de l'outil.",
      "",
      "On gagne plus vite avec un cadre simple, un cas d'usage priorise et un pilote concret."
    ].join("\n");

    this.db
      .prepare(`
        INSERT INTO drafts (id, idea_id, headline, body_markdown, quality_score, created_at, status, source_draft_id)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL)
      `)
      .run(draftId, idea.id, headline, bodyMarkdown, 0.61, createdAt);

    const hookTexts = [
      `Le vrai probleme avec ${idea.title.toLowerCase()}, ce n'est presque jamais l'outil.`,
      "Si votre projet IA n'avance pas, regardez d'abord votre process.",
      "Une PME n'a pas besoin de plus d'IA. Elle a besoin d'un meilleur cadrage."
    ];

    for (const text of hookTexts) {
      this.db
        .prepare("INSERT INTO hooks (id, draft_id, text) VALUES (?, ?, ?)")
        .run(createId("hook"), draftId, text);
    }

    this.recordExecutionRun(
      createId("run"),
      idea.id,
      draftId,
      "linkedin-post-writer",
      "succeeded",
      "Draft generated",
      createdAt
    );
    this.recordDraftVersion(draftId, bodyMarkdown, 0.61, "generation", createdAt);
    this.syncDraftTags(draftId, idea.title, idea.angle, idea.pillarLabel, false);

    return this.getSessionByDraftId(draftId);
  }

  correctDraft(draftId: string): WorkshopSession {
    const draft = this.db
      .prepare("SELECT id, idea_id AS ideaId, body_markdown AS bodyMarkdown FROM drafts WHERE id = ?")
      .get(draftId) as { id: string; ideaId: string; bodyMarkdown: string } | undefined;

    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const correctedAt = new Date().toISOString();
    const correctedBody = `${draft.bodyMarkdown}\n\nVersion revue : plus concret, plus net, plus utile pour un decideur PME.`;

    this.db
      .prepare("UPDATE drafts SET body_markdown = ?, quality_score = ? WHERE id = ?")
      .run(correctedBody, 0.89, draftId);

    this.recordExecutionRun(
      createId("run"),
      draft.ideaId,
      draftId,
      "linkedin-post-editor",
      "succeeded",
      "Draft corrected",
      correctedAt
    );
    this.recordDraftVersion(draftId, correctedBody, 0.89, "correction", correctedAt);

    return this.getSessionByDraftId(draftId);
  }

  getSessionByIdeaId(ideaId: string): WorkshopSession | null {
    const latestDraft = this.db
      .prepare(`
        SELECT id
        FROM drafts
        WHERE idea_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get(ideaId) as { id: string } | undefined;

    if (!latestDraft) {
      return null;
    }

    return this.getSessionByDraftId(latestDraft.id);
  }

  private getSessionByDraftId(draftId: string): WorkshopSession {
    const draft = this.db
      .prepare(`
        SELECT id, idea_id AS ideaId, headline, body_markdown AS bodyMarkdown, quality_score AS qualityScore
        FROM drafts
        WHERE id = ?
      `)
      .get(draftId) as
        | {
            id: string;
            ideaId: string;
            headline: string;
            bodyMarkdown: string;
            qualityScore: number;
          }
        | undefined;

    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const idea = this.ideasRepository.getIdeaById(draft.ideaId);
    const hooks = this.db
      .prepare("SELECT id, text FROM hooks WHERE draft_id = ? ORDER BY rowid ASC")
      .all(draftId) as WorkshopSession["hooks"];
    const run = this.db
      .prepare(`
        SELECT id, skill_name AS skillName, status, summary
        FROM execution_runs
        WHERE draft_id = ?
        ORDER BY rowid DESC
        LIMIT 1
      `)
      .get(draftId) as WorkshopSession["run"];
    const versions = this.db
      .prepare(`
        SELECT
          id,
          body_markdown AS bodyMarkdown,
          quality_score AS qualityScore,
          reason,
          created_at AS createdAt
        FROM draft_versions
        WHERE draft_id = ?
        ORDER BY rowid ASC
      `)
      .all(draftId) as WorkshopSession["versions"];

    return {
      idea,
      draft,
      hooks,
      run,
      versions,
      contextUsed: this.buildContextUsed(idea.pillarLabel)
    };
  }

  private buildContextUsed(pillarLabel: string): WorkshopSession["contextUsed"] {
    const strategy = this.getActiveStrategy?.() ?? null;
    const antiStyleRule =
      strategy?.voiceRules.find((rule) => rule.ruleType === "anti_style")?.ruleText ??
      "Pas de hype, du terrain.";

    return {
      pillarLabel,
      strategyProfileName: strategy?.profile.name,
      strategyPositioning: strategy?.profile.positioning,
      voiceGuardrail: antiStyleRule,
      activeSkills: ["linkedin-hook-engine", "linkedin-post-writer", "linkedin-post-editor"]
    };
  }

  private recordExecutionRun(
    runId: string,
    ideaId: string,
    draftId: string,
    skillName: string,
    status: "succeeded" | "failed" | "partial",
    summary: string,
    createdAt: string
  ) {
    this.db
      .prepare(`
        INSERT INTO execution_runs (id, idea_id, draft_id, skill_name, status, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(runId, ideaId, draftId, skillName, status, summary, createdAt);

    if (this.executionLogsDirectory) {
      mkdirSync(this.executionLogsDirectory, { recursive: true });
      writeFileSync(
        join(this.executionLogsDirectory, `${createdAt.replace(/[:.]/g, "-")}__${runId}.json`),
        JSON.stringify(
          {
            id: runId,
            ideaId,
            draftId,
            skillName,
            status,
            summary,
            createdAt
          },
          null,
          2
        )
      );
    }
  }

  private recordDraftVersion(
    draftId: string,
    bodyMarkdown: string,
    qualityScore: number,
    reason: "generation" | "correction" | "variant",
    createdAt: string
  ) {
    this.db
      .prepare(`
        INSERT INTO draft_versions (id, draft_id, body_markdown, quality_score, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(createId("version"), draftId, bodyMarkdown, qualityScore, reason, createdAt);
  }

  private syncDraftTags(
    draftId: string,
    title: string,
    angle: string,
    pillarLabel: string,
    isVariant: boolean
  ) {
    const tags = Array.from(
      new Set([
        ...tokenizeTags(title),
        ...tokenizeTags(angle),
        pillarLabel.toLowerCase(),
        ...(isVariant ? ["variante"] : [])
      ])
    );

    const upsertTag = this.db.prepare(`
      INSERT INTO tags (id, label, normalized_label)
      VALUES (?, ?, ?)
      ON CONFLICT(normalized_label) DO UPDATE SET label = excluded.label
    `);
    const readTag = this.db.prepare("SELECT id FROM tags WHERE normalized_label = ?");
    const linkTag = this.db.prepare(`
      INSERT OR IGNORE INTO tag_links (id, draft_id, tag_id)
      VALUES (?, ?, ?)
    `);

    for (const tag of tags) {
      upsertTag.run(createId("tag"), tag, tag);
      const storedTag = readTag.get(tag) as { id: string } | undefined;

      if (storedTag) {
        linkTag.run(createId("tag_link"), draftId, storedTag.id);
      }
    }
  }
}

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { IdeasRepository } from "../ideas/ideas.repository";
import {
  SkillRunnerService,
  type SkillRunnerInvocation,
  type SkillRunnerResult
} from "../execution/skill-runner.service";
import type { StrategyBundle } from "../../../shared/types/strategy";
import type {
  HookOption,
  PostObjective,
  PostTypology,
  StructureOption,
  WorkshopSession
} from "../../../shared/types/workshop";

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
  ensureColumn(db, "drafts", "typology", "typology TEXT");
  ensureColumn(db, "drafts", "structure_key", "structure_key TEXT");
  ensureColumn(db, "execution_runs", "skill_version", "skill_version TEXT");
  ensureColumn(db, "execution_runs", "input_json", "input_json TEXT");
  ensureColumn(db, "execution_runs", "output_json", "output_json TEXT");
  ensureColumn(db, "execution_runs", "output_markdown", "output_markdown TEXT");
  ensureColumn(db, "execution_runs", "error_message", "error_message TEXT");
  ensureColumn(db, "execution_runs", "log_path", "log_path TEXT");
  ensureColumn(db, "execution_runs", "started_at", "started_at TEXT");
  ensureColumn(db, "execution_runs", "finished_at", "finished_at TEXT");
}

export class WorkshopService {
  constructor(
    private readonly db: Database.Database,
    private readonly ideasRepository: IdeasRepository,
    private readonly getActiveStrategy?: () => StrategyBundle | null,
    private readonly executionLogsDirectory?: string,
    private readonly skillRunnerService: SkillRunnerService = new SkillRunnerService()
  ) {}

  generateDraftFromIdea(ideaId: string): WorkshopSession {
    const structures = this.getSuggestedStructures(ideaId, "expertise", "awareness");
    const hooks = this.generateHooks(ideaId, "expertise", structures[0].key);
    return this.generateFinalDraft(ideaId, "expertise", "awareness", structures[0].key, hooks[0].id);
  }

  getSuggestedStructures(
    ideaId: string,
    typology: PostTypology,
    objective: PostObjective
  ): StructureOption[] {
    const idea = this.ideasRepository.getIdeaById(ideaId);
    const invocation: SkillRunnerInvocation = {
      runId: createId("run"),
      skillName: "linkedin-structure-selector",
      skillVersion: "1.0.0",
      context: this.buildRunnerContext(idea.pillarLabel),
      payload: {
        ideaId: idea.id,
        title: idea.title,
        angle: idea.angle,
        typology,
        objective
      },
      attachments: []
    };
    const result = this.executeSkill(invocation);

    if (result.status !== "succeeded" || !result.data?.structure) {
      throw new Error(result.error?.message ?? result.summary);
    }

    this.recordExecutionRun(invocation, result, idea.id, "pending_draft", new Date().toISOString());

    return [
      {
        key: result.data.structure.key,
        label: result.data.structure.label,
        rationale: result.data.structure.rationale
      }
    ];
  }

  generateHooks(ideaId: string, typology: PostTypology, structureKey: string): HookOption[] {
    const idea = this.ideasRepository.getIdeaById(ideaId);
    const invocation: SkillRunnerInvocation = {
      runId: createId("run"),
      skillName: "linkedin-hook-engine",
      skillVersion: "1.0.0",
      context: this.buildRunnerContext(idea.pillarLabel),
      payload: {
        ideaId: idea.id,
        title: idea.title,
        angle: idea.angle,
        typology,
        structureKey
      },
      attachments: []
    };
    const result = this.executeSkill(invocation);

    if (result.status !== "succeeded" || !result.data?.hooks) {
      throw new Error(result.error?.message ?? result.summary);
    }

    this.recordExecutionRun(invocation, result, idea.id, "pending_draft", new Date().toISOString());

    return result.data.hooks.map((hook, index) => ({
      id: `hook_option_${index}`,
      family: hook.family,
      text: hook.text,
      score: hook.score
    }));
  }

  generateFinalDraft(
    ideaId: string,
    typology: PostTypology,
    objective: PostObjective,
    structureKey: string,
    selectedHookId: string
  ): WorkshopSession {
    const idea = this.ideasRepository.getIdeaById(ideaId);
    const draftId = createId("draft");
    const createdAt = new Date().toISOString();

    const hooks = this.generateHooks(ideaId, typology, structureKey);
    const selectedHook =
      hooks.find((h) => h.id === selectedHookId) ||
      hooks[0] ||
      ({ text: "Accroche par defaut", family: "default" } as HookOption);

    const structures = this.getSuggestedStructures(ideaId, typology, objective);
    const selectedStructure = structures.find((s) => s.key === structureKey) || structures[0];

    const writerInvocation: SkillRunnerInvocation = {
      runId: createId("run"),
      skillName: "linkedin-post-writer",
      skillVersion: "1.0.0",
      context: this.buildRunnerContext(idea.pillarLabel),
      payload: {
        ideaId: idea.id,
        title: idea.title,
        angle: idea.angle,
        typology,
        objective,
        structureKey,
        structureLabel: selectedStructure.label,
        selectedHook: selectedHook.text,
        hooks: hooks.map((h) => ({ text: h.text, family: h.family, score: h.score }))
      },
      attachments: []
    };
    const writerResult = this.executeSkill(writerInvocation);

    if (writerResult.status !== "succeeded" || !writerResult.data?.draft) {
      throw new Error(writerResult.error?.message ?? writerResult.summary);
    }

    const headline = writerResult.data.draft.headline;
    const bodyMarkdown = writerResult.data.draft.bodyMarkdown;

    this.db
      .prepare(
        `
        INSERT INTO drafts (id, idea_id, headline, body_markdown, quality_score, created_at, status, typology, structure_key)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)
      `
      )
      .run(draftId, idea.id, headline, bodyMarkdown, 0.61, createdAt, typology, structureKey);

    const hookTexts = (writerResult.data.hooks || hooks).map((hook) => hook.text);

    for (const text of hookTexts) {
      this.db
        .prepare("INSERT INTO hooks (id, draft_id, text) VALUES (?, ?, ?)")
        .run(createId("hook"), draftId, text);
    }

    this.recordExecutionRun(writerInvocation, writerResult, idea.id, draftId, createdAt);
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
    const idea = this.ideasRepository.getIdeaById(draft.ideaId);
    const editorInvocation: SkillRunnerInvocation = {
      runId: createId("run"),
      skillName: "linkedin-post-editor",
      skillVersion: "1.0.0",
      context: this.buildRunnerContext(idea.pillarLabel),
      payload: {
        draftId,
        headline: this.db
          .prepare("SELECT headline FROM drafts WHERE id = ?")
          .get(draftId)?.headline ?? idea.title,
        bodyMarkdown: draft.bodyMarkdown
      },
      attachments: []
    };
    const editorResult = this.executeSkill(editorInvocation);

    if (editorResult.status !== "succeeded" || !editorResult.data?.draft) {
      throw new Error(editorResult.error?.message ?? editorResult.summary);
    }

    const correctedBody = editorResult.data.draft.bodyMarkdown;

    this.db
      .prepare("UPDATE drafts SET body_markdown = ?, quality_score = ? WHERE id = ?")
      .run(correctedBody, 0.89, draftId);

    this.recordExecutionRun(editorInvocation, editorResult, draft.ideaId, draftId, correctedAt);
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
      activeSkills: [
        "linkedin-structure-selector",
        "linkedin-hook-engine",
        "linkedin-post-writer",
        "linkedin-post-editor"
      ]
    };
  }

  private executeSkill(invocation: SkillRunnerInvocation): SkillRunnerResult {
    return this.skillRunnerService.execute(invocation) as unknown as SkillRunnerResult;
  }

  private buildRunnerContext(pillarLabel: string) {
    const strategy = this.getActiveStrategy?.() ?? null;

    return {
      profileId: strategy?.profile.id ?? "profile_active",
      strategyProfileName: strategy?.profile.name,
      strategyPositioning: strategy?.profile.positioning,
      pillarLabel,
      voiceGuardrail:
        strategy?.voiceRules.find((rule) => rule.ruleType === "anti_style")?.ruleText ??
        "Pas de hype, du terrain."
    };
  }

  private recordExecutionRun(
    invocation: SkillRunnerInvocation,
    result: SkillRunnerResult,
    ideaId: string,
    draftId: string,
    createdAt: string
  ) {
    const logPath = this.executionLogsDirectory
      ? join(
          this.executionLogsDirectory,
          `${createdAt.replace(/[:.]/g, "-")}__${invocation.runId}.json`
        )
      : null;

    this.db
      .prepare(`
        INSERT INTO execution_runs (
          id, idea_id, draft_id, skill_name, skill_version, status, summary, input_json, output_json,
          output_markdown, error_message, log_path, started_at, finished_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        invocation.runId,
        ideaId,
        draftId,
        invocation.skillName,
        invocation.skillVersion,
        result.status,
        result.summary,
        JSON.stringify(invocation),
        JSON.stringify(result),
        result.artifacts?.find((artifact) => artifact.kind === "markdown")?.content ?? null,
        result.error?.message ?? null,
        logPath,
        createdAt,
        createdAt,
        createdAt
      );

    if (this.executionLogsDirectory) {
      mkdirSync(this.executionLogsDirectory, { recursive: true });
      writeFileSync(
        logPath!,
        JSON.stringify(
          {
            id: invocation.runId,
            ideaId,
            draftId,
            invocation,
            result,
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

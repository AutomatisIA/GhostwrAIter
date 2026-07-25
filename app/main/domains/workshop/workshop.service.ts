import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WebContents } from "electron";
import Database from "better-sqlite3";
import { IdeasRepository } from "../ideas/ideas.repository";
import {
  SkillRunnerService,
  type SkillRunnerInvocation,
  type SkillRunnerResult
} from "../execution/skill-runner.service";
import {
  emitPhaseSettled,
  emitPhaseStarted
} from "../execution/execution-progress-emitter";
import type { ExecutionPhase } from "../../../shared/types/execution-progress";
import type { IdeaRecord } from "../../../shared/types/ideas";
import type { StrategyBundle } from "../../../shared/types/strategy";
import type {
  HookOption,
  PostObjective,
  PostTypology,
  StructureOption,
  WorkshopSession
} from "../../../shared/types/workshop";
import { createId } from "../../shared/create-id";
import { tokenizeTags } from "./tokenize-tags";
import { skillRunError } from "../execution/skill-run-error";
import {
  buildStrategyContext,
  summarizeIcps,
  summarizeOffers
} from "../strategy/strategy-context";
import { insertExecutionRun, recordExecutionRun } from "../execution/execution-runs.repository";

type WorkshopColumnSpec = {
  readonly table: "drafts" | "execution_runs";
  readonly column: string;
  readonly ddl: string;
};

/**
 * Explicit allowlist of (table, column) pairs that may be added via
 * ensureColumn. Every entry is hardcoded; callers pass only a symbolic key.
 * This guarantees that ensureColumn never issues a DDL statement with a
 * caller-controlled identifier, even if a future contributor wires user input
 * into a workshop schema helper by mistake.
 */
export const WORKSHOP_COLUMN_ALLOWLIST = {
  "drafts.status": {
    table: "drafts",
    column: "status",
    ddl: "status TEXT NOT NULL DEFAULT 'draft'"
  },
  "drafts.source_draft_id": {
    table: "drafts",
    column: "source_draft_id",
    ddl: "source_draft_id TEXT"
  },
  "drafts.typology": {
    table: "drafts",
    column: "typology",
    ddl: "typology TEXT"
  },
  "drafts.objective": {
    table: "drafts",
    column: "objective",
    ddl: "objective TEXT"
  },
  "drafts.structure_key": {
    table: "drafts",
    column: "structure_key",
    ddl: "structure_key TEXT"
  },
  "drafts.structure_label": {
    table: "drafts",
    column: "structure_label",
    ddl: "structure_label TEXT"
  },
  "drafts.selected_hook_text": {
    table: "drafts",
    column: "selected_hook_text",
    ddl: "selected_hook_text TEXT"
  },
  "execution_runs.skill_version": {
    table: "execution_runs",
    column: "skill_version",
    ddl: "skill_version TEXT"
  },
  "execution_runs.input_json": {
    table: "execution_runs",
    column: "input_json",
    ddl: "input_json TEXT"
  },
  "execution_runs.output_json": {
    table: "execution_runs",
    column: "output_json",
    ddl: "output_json TEXT"
  },
  "execution_runs.output_markdown": {
    table: "execution_runs",
    column: "output_markdown",
    ddl: "output_markdown TEXT"
  },
  "execution_runs.error_message": {
    table: "execution_runs",
    column: "error_message",
    ddl: "error_message TEXT"
  },
  "execution_runs.log_path": {
    table: "execution_runs",
    column: "log_path",
    ddl: "log_path TEXT"
  },
  "execution_runs.started_at": {
    table: "execution_runs",
    column: "started_at",
    ddl: "started_at TEXT"
  },
  "execution_runs.finished_at": {
    table: "execution_runs",
    column: "finished_at",
    ddl: "finished_at TEXT"
  },
  "execution_runs.engine": {
    table: "execution_runs",
    column: "engine",
    ddl: "engine TEXT"
  }
} as const satisfies Record<string, WorkshopColumnSpec>;

export type WorkshopColumnKey = keyof typeof WORKSHOP_COLUMN_ALLOWLIST;

const ALLOWED_WORKSHOP_TABLES = new Set(["drafts", "execution_runs"]);

/**
 * Idempotent column addition constrained by the workshop column allowlist.
 *
 * The caller passes only a symbolic key (e.g. "drafts.status"). The function
 * looks up the table name and the full DDL definition in the allowlist and
 * issues the ALTER TABLE statement only if the column is missing. The table
 * name is re-validated against ALLOWED_WORKSHOP_TABLES as defense in depth,
 * so even if the allowlist map is mutated at runtime the function cannot
 * issue DDL against an unexpected table.
 *
 * Throws if the key is not in the allowlist, if the key maps to a table that
 * is not in the allowed workshop tables set, or if the key is malformed.
 */
export function ensureColumn(db: Database.Database, key: WorkshopColumnKey): void {
  const spec = (WORKSHOP_COLUMN_ALLOWLIST as Record<string, WorkshopColumnSpec>)[key];
  if (!spec) {
    throw new Error(
      `ensureColumn: '${key}' is not in the workshop column allowlist`
    );
  }
  if (!ALLOWED_WORKSHOP_TABLES.has(spec.table)) {
    throw new Error(
      `ensureColumn: '${spec.table}' is not in the workshop column allowlist of tables`
    );
  }

  const existingColumns = db
    .prepare(`PRAGMA table_info(${spec.table})`)
    .all() as Array<{ name: string }>;

  if (existingColumns.some((entry) => entry.name === spec.column)) {
    return;
  }

  const alterStatement = `ALTER TABLE ${spec.table} ADD COLUMN ${spec.ddl}`;
  db.prepare(alterStatement).run();
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

  ensureColumn(db, "drafts.status");
  ensureColumn(db, "drafts.source_draft_id");
  ensureColumn(db, "drafts.typology");
  ensureColumn(db, "drafts.objective");
  ensureColumn(db, "drafts.structure_key");
  ensureColumn(db, "drafts.structure_label");
  ensureColumn(db, "drafts.selected_hook_text");
  ensureColumn(db, "execution_runs.skill_version");
  ensureColumn(db, "execution_runs.input_json");
  ensureColumn(db, "execution_runs.output_json");
  ensureColumn(db, "execution_runs.output_markdown");
  ensureColumn(db, "execution_runs.error_message");
  ensureColumn(db, "execution_runs.log_path");
  ensureColumn(db, "execution_runs.started_at");
  ensureColumn(db, "execution_runs.finished_at");
  ensureColumn(db, "execution_runs.engine");
}

export class WorkshopService {
  constructor(
    private readonly db: Database.Database,
    private readonly ideasRepository: IdeasRepository,
    private readonly getActiveStrategy?: () => StrategyBundle | null,
    private readonly executionLogsDirectory?: string,
    private readonly skillRunnerService: SkillRunnerService = new SkillRunnerService(),
    private readonly getFoundationSummary?: () => string | null
  ) {}

  async generateDraftFromIdea(ideaId: string, sender?: WebContents): Promise<WorkshopSession> {
    // Appel composite : chaque sous-etape reelle emet sa propre paire de bornes
    // (structure -> hook -> redaction) via le `sender` propage. Pas de paire
    // composite additionnelle par-dessus (cf. contrat).
    const structures = await this.getSuggestedStructures(ideaId, "expertise", "awareness", sender);
    const topStructure = structures[0];
    if (!topStructure) {
      throw new Error("Aucune structure suggeree disponible pour generer le brouillon.");
    }
    const hooks = await this.generateHooks(ideaId, "expertise", topStructure.key, sender);
    const topHook = hooks[0];
    if (!topHook) {
      throw new Error("Aucune accroche generee pour finaliser le brouillon.");
    }
    return this.generateFinalDraft(
      ideaId,
      "expertise",
      "awareness",
      topStructure.key,
      topStructure.label,
      topHook.id,
      topHook.text,
      hooks,
      sender
    );
  }

  async getSuggestedStructures(
    ideaId: string,
    typology: PostTypology,
    objective: PostObjective,
    sender?: WebContents
  ): Promise<StructureOption[]> {
    const idea = this.ideasRepository.getIdeaById(ideaId);
    const invocation: SkillRunnerInvocation = {
      runId: createId("run"),
      skillName: "linkedin-structure-selector",
      skillVersion: "1.0.0",
      context: this.buildRunnerContext(idea),
      payload: {
        ideaId: idea.id,
        title: idea.title,
        angle: idea.angle,
        typology,
        objective
      },
      attachments: []
    };
    const result = await this.runPhase("structure", invocation, sender);

    if (result.status !== "succeeded") {
      throw skillRunError(result);
    }

    this.persistExecutionRun(invocation, result, idea.id, "pending_draft", new Date().toISOString());

    if (result.data?.structures && result.data.structures.length > 0) {
      return result.data.structures.map((s) => ({
        key: s.key,
        label: s.label,
        rationale: s.rationale
      }));
    }

    if (result.data?.structure) {
      return [
        {
          key: result.data.structure.key,
          label: result.data.structure.label,
          rationale: result.data.structure.rationale
        }
      ];
    }

    throw new Error(result.summary);
  }

  async generateHooks(
    ideaId: string,
    typology: PostTypology,
    structureKey: string,
    sender?: WebContents
  ): Promise<HookOption[]> {
    const idea = this.ideasRepository.getIdeaById(ideaId);
    const invocation: SkillRunnerInvocation = {
      runId: createId("run"),
      skillName: "linkedin-hook-engine",
      skillVersion: "1.0.0",
      context: this.buildRunnerContext(idea),
      payload: {
        ideaId: idea.id,
        title: idea.title,
        angle: idea.angle,
        typology,
        structureKey
      },
      attachments: []
    };
    const result = await this.runPhase("hook", invocation, sender);

    if (result.status !== "succeeded" || !result.data?.hooks) {
      throw skillRunError(result);
    }

    this.persistExecutionRun(invocation, result, idea.id, "pending_draft", new Date().toISOString());

    return result.data.hooks.map((hook, index) => ({
      id: `hook_option_${index}`,
      family: hook.family,
      text: hook.text,
      score: hook.score
    }));
  }

  async generateFinalDraft(
    ideaId: string,
    typology: PostTypology,
    objective: PostObjective,
    structureKey: string,
    structureLabel: string,
    selectedHookId: string,
    selectedHookText: string,
    hooks: HookOption[],
    sender?: WebContents
  ): Promise<WorkshopSession> {
    const idea = this.ideasRepository.getIdeaById(ideaId);
    const draftId = createId("draft");
    const createdAt = new Date().toISOString();

    const selectedHook = hooks.find((h) => h.id === selectedHookId);
    const selectedStructure = {
      key: structureKey,
      label: structureLabel,
      rationale: ""
    };

    if (!selectedHook) {
      throw new Error("Selected hook is missing or invalid.");
    }

    if (!selectedStructure.key || !selectedStructure.label) {
      throw new Error("Selected structure is missing or invalid.");
    }

    const writerInvocation: SkillRunnerInvocation = {
      runId: createId("run"),
      skillName: "linkedin-post-writer",
      skillVersion: "1.0.0",
      context: this.buildRunnerContext(idea),
      payload: {
        ideaId: idea.id,
        title: idea.title,
        angle: idea.angle,
        typology,
        objective,
        structureKey,
        structureLabel: selectedStructure.label,
        selectedHook: selectedHookText || selectedHook.text,
        hooks: hooks.map((h) => ({ text: h.text, family: h.family, score: h.score }))
      },
      attachments: []
    };
    const writerResult = await this.runPhase("redaction", writerInvocation, sender);

    if (writerResult.status !== "succeeded" || !writerResult.data?.draft) {
      throw skillRunError(writerResult);
    }

    const headline = writerResult.data.draft.headline;
    const bodyMarkdown = writerResult.data.draft.bodyMarkdown;
    const generationQualityScore = this.computeDraftQualityScore(writerResult, headline, bodyMarkdown);

    this.db
      .prepare(
        `
        INSERT INTO drafts (
          id, idea_id, headline, body_markdown, quality_score, created_at, status,
          typology, objective, structure_key, structure_label, selected_hook_text
        )
        VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `
      )
      .run(
        draftId,
        idea.id,
        headline,
        bodyMarkdown,
        generationQualityScore,
        createdAt,
        typology,
        objective,
        structureKey,
        selectedStructure.label,
        selectedHookText || selectedHook.text
      );

    const hookTexts = (writerResult.data.hooks ?? hooks).map((hook) => hook.text);

    for (const text of hookTexts) {
      this.db
        .prepare("INSERT INTO hooks (id, draft_id, text) VALUES (?, ?, ?)")
        .run(createId("hook"), draftId, text);
    }

    this.persistExecutionRun(writerInvocation, writerResult, idea.id, draftId, createdAt);
    this.recordDraftVersion(draftId, bodyMarkdown, generationQualityScore, "generation", createdAt);
    this.syncDraftTags(draftId, idea.title, idea.angle, idea.pillarLabel, false);

    return this.getSessionByDraftId(draftId);
  }

  async createVariant(draftId: string, variantType: string, sender?: WebContents): Promise<WorkshopSession> {
    const draft = this.db
      .prepare(
        `SELECT
          idea_id AS ideaId,
          headline,
          body_markdown AS bodyMarkdown,
          typology,
          objective,
          structure_key AS structureKey,
          structure_label AS structureLabel,
          selected_hook_text AS selectedHookText,
          quality_score AS qualityScore
        FROM drafts
        WHERE id = ?`
      )
      .get(draftId) as
        | {
            ideaId: string;
            headline: string;
            bodyMarkdown: string;
            typology?: string;
            objective?: string;
            structureKey?: string;
            structureLabel?: string;
            selectedHookText?: string;
            qualityScore: number;
          }
        | undefined;

    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const idea = this.ideasRepository.getIdeaById(draft.ideaId);
    const createdAt = new Date().toISOString();
    const variantId = createId("draft");

    const invocation: SkillRunnerInvocation = {
      runId: createId("run"),
      skillName: "linkedin-repurpose",
      skillVersion: "1.0.0",
      context: this.buildRunnerContext(idea),
      payload: {
        headline: draft.headline,
        bodyMarkdown: draft.bodyMarkdown,
        variantType,
        sourceQualityScore: draft.qualityScore,
        originalTypology: draft.typology ?? "unknown",
        originalObjective: draft.objective ?? "unknown",
        originalStructureKey: draft.structureKey ?? "unknown",
        originalStructureLabel: draft.structureLabel ?? "unknown",
        originalHook: draft.selectedHookText ?? ""
      },
      attachments: []
    };

    const result = await this.runPhase("variante", invocation, sender);
    if (result.status !== "succeeded" || !result.data?.draft) {
      throw skillRunError(result);
    }

    const variantBody = result.data.draft.bodyMarkdown;

    this.db
      .prepare(
        `
        INSERT INTO drafts (id, idea_id, headline, body_markdown, quality_score, created_at, status, source_draft_id)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
      `
      )
      .run(variantId, idea.id, result.data.draft.headline, variantBody, 0.72, createdAt, draftId);

    this.persistExecutionRun(invocation, result, idea.id, variantId, createdAt);
    this.recordDraftVersion(variantId, variantBody, 0.72, "variant", createdAt);
    this.syncDraftTags(variantId, idea.title, idea.angle, idea.pillarLabel, true);

    return this.getSessionByDraftId(variantId);
  }

  /**
   * Cree un brouillon a partir d un texte fourni (post importe a ameliorer) et
   * le persiste comme tout autre brouillon, de sorte que `correctDraft` puisse
   * ensuite l ameliorer par son id. Sert au parcours "importer un post existant
   * pour le retravailler" et permet a l evaluation editoriale d exercer le skill
   * post-editor sur des brouillons controles (cas de test reproductibles).
   */
  createDraftFromContent(input: {
    pillarLabel: string;
    headline: string;
    bodyMarkdown: string;
  }): WorkshopSession {
    const idea = this.ideasRepository.createIdea({
      title: input.headline,
      angle: "Brouillon importe pour correction",
      pillarLabel: input.pillarLabel
    });
    const draftId = createId("draft");
    const runId = createId("run");
    const createdAt = new Date().toISOString();
    // Note neutre : un brouillon importe n est pas encore evalue par un skill.
    const qualityScore = 0.5;

    // L editeur (post-editor) exige un contexte de production complet
    // (typologie, objectif, structure, accroche) pour pouvoir le PRESERVER lors
    // de la correction. Un brouillon importe n en a pas : on fournit des valeurs
    // par defaut sures. L accroche par defaut est la premiere ligne non vide du
    // corps (de facto l ouverture a preserver), bornee pour ne pas confondre tout
    // un post mono-ligne avec son accroche.
    const HOOK_MAX_LENGTH = 200;
    const firstLine =
      input.bodyMarkdown
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? input.headline;
    const typology: PostTypology = "expertise";
    const objective: PostObjective = "awareness";
    const structureKey = "belief-terrain-reality";
    const structureLabel = "Croyance -> terrain -> realite";
    const selectedHookText = firstLine.slice(0, HOOK_MAX_LENGTH);

    this.db
      .prepare(`
        INSERT INTO drafts (
          id, idea_id, headline, body_markdown, quality_score, created_at, status,
          typology, objective, structure_key, structure_label, selected_hook_text
        )
        VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `)
      .run(
        draftId,
        idea.id,
        input.headline,
        input.bodyMarkdown,
        qualityScore,
        createdAt,
        typology,
        objective,
        structureKey,
        structureLabel,
        selectedHookText
      );

    this.recordDraftVersion(draftId, input.bodyMarkdown, qualityScore, "manual_edit", createdAt);
    this.syncDraftTags(draftId, idea.title, idea.angle, idea.pillarLabel, false);

    // Trace de provenance : pas une execution de skill, mais un import. Garantit
    // que la session retournee porte un `run` bien forme (le type WorkshopSession
    // l exige) plutot qu un `run` undefined pour un brouillon sans execution.
    insertExecutionRun(this.db, {
      id: runId,
      ideaId: idea.id,
      draftId,
      skillName: "manual-import",
      skillVersion: "1.0.0",
      status: "succeeded",
      summary: "Brouillon importe pour correction",
      inputJson: JSON.stringify({ pillarLabel: input.pillarLabel, headline: input.headline }),
      outputJson: JSON.stringify({ draftId }),
      outputMarkdown: input.bodyMarkdown,
      errorMessage: null,
      logPath: null,
      startedAt: createdAt,
      finishedAt: createdAt,
      createdAt,
      // Import manuel : aucun moteur n a produit ce texte, c est l utilisateur.
      engine: null
    });

    return this.getSessionByDraftId(draftId);
  }

  async correctDraft(draftId: string, sender?: WebContents): Promise<WorkshopSession> {
    const draft = this.db
      .prepare(`
        SELECT id, idea_id AS ideaId, headline, body_markdown AS bodyMarkdown,
               quality_score AS qualityScore, typology, objective,
               structure_key AS structureKey, structure_label AS structureLabel,
               selected_hook_text AS selectedHookText
        FROM drafts WHERE id = ?
      `)
      .get(draftId) as {
        id: string; ideaId: string; headline: string; bodyMarkdown: string;
        qualityScore: number; typology: string | null; objective: string | null;
        structureKey: string | null; structureLabel: string | null;
        selectedHookText: string | null;
      } | undefined;

    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const correctedAt = new Date().toISOString();
    const idea = this.ideasRepository.getIdeaById(draft.ideaId);
    const editorInvocation: SkillRunnerInvocation = {
      runId: createId("run"),
      skillName: "linkedin-post-editor",
      skillVersion: "1.0.0",
      context: this.buildRunnerContext(idea),
      payload: {
        draftId,
        headline: draft.headline ?? idea.title,
        bodyMarkdown: draft.bodyMarkdown,
        currentQualityScore: draft.qualityScore,
        ideaTitle: idea.title,
        ideaAngle: idea.angle,
        typology: draft.typology,
        objective: draft.objective,
        structureKey: draft.structureKey,
        structureLabel: draft.structureLabel,
        selectedHookText: draft.selectedHookText
      },
      attachments: []
    };
    const editorResult = await this.runPhase("correction", editorInvocation, sender);

    if (editorResult.status !== "succeeded" || !editorResult.data?.draft) {
      throw skillRunError(editorResult);
    }

    const correctedBody = editorResult.data.draft.bodyMarkdown;
    const correctedHeadline = editorResult.data.draft.headline ?? draft.headline;
    const correctedQualityScore = this.computeDraftQualityScore(
      editorResult,
      correctedHeadline,
      correctedBody
    );

    this.persistExecutionRun(editorInvocation, editorResult, draft.ideaId, draftId, correctedAt);

    // La correction etait auparavant conditionnee a une hausse du score. Ce
    // score est en grande partie auto-declare par le modele, et l editeur rend
    // des signaux voisins de ceux du redacteur : la condition n etait donc
    // quasiment jamais remplie, et la fonctionnalite n a jamais applique la
    // moindre correction en usage reel. Refuser un travail sur la foi d un
    // chiffre invente est exactement le defaut releve par l audit editorial.
    //
    // La decision revient desormais a la skill, a qui son contrat demande
    // explicitement de rendre le texte inchange si elle ne peut pas l ameliorer.
    // Le seul cas ou l on ne touche a rien est celui ou elle a effectivement
    // rendu le meme texte.
    const unchanged =
      correctedBody.trim() === draft.bodyMarkdown.trim() &&
      correctedHeadline.trim() === (draft.headline ?? "").trim();

    if (unchanged) {
      return { ...this.getSessionByDraftId(draftId), correctionApplied: false };
    }

    this.db
      .prepare("UPDATE drafts SET headline = ?, body_markdown = ?, quality_score = ? WHERE id = ?")
      .run(correctedHeadline, correctedBody, correctedQualityScore, draftId);

    this.recordDraftVersion(draftId, correctedBody, correctedQualityScore, "correction", correctedAt);

    return this.getSessionByDraftId(draftId);
  }

  updateDraftText(draftId: string, headline: string, bodyMarkdown: string): WorkshopSession {
    const draft = this.db
      .prepare("SELECT id, idea_id AS ideaId, quality_score AS qualityScore FROM drafts WHERE id = ?")
      .get(draftId) as { id: string; ideaId: string; qualityScore: number } | undefined;

    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const now = new Date().toISOString();

    this.db
      .prepare("UPDATE drafts SET headline = ?, body_markdown = ? WHERE id = ?")
      .run(headline, bodyMarkdown, draftId);

    this.recordDraftVersion(draftId, bodyMarkdown, draft.qualityScore, "manual_edit", now);

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
        SELECT
          id,
          idea_id AS ideaId,
          headline,
          body_markdown AS bodyMarkdown,
          quality_score AS qualityScore,
          typology,
          objective,
          structure_key AS structureKey,
          structure_label AS structureLabel,
          selected_hook_text AS selectedHookText
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
            typology?: PostTypology;
            objective?: PostObjective;
            structureKey?: string;
            structureLabel?: string;
            selectedHookText?: string;
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
      contextUsed: this.buildContextUsed(idea)
    };
  }

  private buildContextUsed(idea: IdeaRecord): WorkshopSession["contextUsed"] {
    const strategy = this.requireActiveStrategy();
    const pillarLabel = idea.pillarLabel;

    return {
      pillarLabel,
      strategyProfileName: strategy.profile.name,
      strategyPositioning: strategy.profile.positioning,
      strategyBio: strategy.profile.bio,
      strategyExpertiseSummary: strategy.profile.expertiseSummary,
      strategyOffersSummary: summarizeOffers(strategy),
      strategyIcpSummary: summarizeIcps(strategy, idea.targetIcpSegment),
      pillarDescription:
        strategy.pillars.find((pillar) => pillar.label === pillarLabel)?.description ?? "",
      voiceGuardrail: strategy.voiceRules.map((r) => `[${r.ruleType}] ${r.ruleText}`).join(" | "),
      activeSkills: [
        "linkedin-structure-selector",
        "linkedin-hook-engine",
        "linkedin-post-writer",
        "linkedin-post-editor"
      ]
    };
  }

  private async executeSkill(invocation: SkillRunnerInvocation): Promise<SkillRunnerResult> {
    return this.skillRunnerService.executeAsync(invocation);
  }

  /**
   * Execute une etape moteur en emettant les bornes de progression
   * (feature 010, T027) : `started` avant l'appel, puis `completed`/`failed`
   * apres. L'emission est best-effort (cf. emitter) et n'altere jamais le
   * resultat metier.
   *
   * L'etiquette de moteur n'est plus codee en dur : `started` annonce le moteur
   * choisi (lecture en base, sans appel systeme), et la borne terminale reprend
   * le moteur reellement utilise, tel que le runner l'a estampille.
   */
  private async runPhase(
    phase: ExecutionPhase,
    invocation: SkillRunnerInvocation,
    sender: WebContents | undefined
  ): Promise<SkillRunnerResult> {
    const announced = this.skillRunnerService.getSelectedEngineName?.() ?? "codex";
    emitPhaseStarted(sender, { runId: invocation.runId, phase, engine: announced });
    const result = await this.executeSkill(invocation);
    const usedEngine = result.engine ?? announced;
    // `completed` n'est emis QUE pour un succes franc : les appelants amont
    // throw des que `status !== "succeeded"` (y compris `partial`). Emettre
    // `completed` sur un `partial` produirait un faux signal de succes alors
    // que le flux metier va echouer. On aligne donc la borne terminale sur le
    // throw aval : succeeded => completed, tout le reste => failed.
    if (result.status === "succeeded") {
      emitPhaseSettled(sender, {
        runId: invocation.runId,
        phase,
        engine: usedEngine,
        status: "completed"
      });
    } else {
      emitPhaseSettled(sender, {
        runId: invocation.runId,
        phase,
        engine: usedEngine,
        status: "failed",
        errorCode: result.error?.code
      });
    }
    return result;
  }

  /**
   * Le contexte est construit a partir de l idee entiere, et non de son seul
   * pilier : la cible visee voyage avec elle. Les cinq etapes du pipeline
   * (structure, accroche, redaction, variante, correction) passent par ici,
   * donc elles ecrivent toutes pour la meme personne.
   */
  private buildRunnerContext(idea: IdeaRecord) {
    return buildStrategyContext(
      this.requireActiveStrategy(),
      idea.pillarLabel,
      this.getFoundationSummary?.() ?? null,
      { requireVoiceRules: true, targetIcpSegment: idea.targetIcpSegment }
    );
  }

  private requireActiveStrategy() {
    const strategy = this.getActiveStrategy?.();

    if (!strategy) {
      throw new Error("No active strategy bundle is available.");
    }

    return strategy;
  }

  private persistExecutionRun(
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

    recordExecutionRun(this.db, {
      invocation,
      result,
      ideaId,
      draftId,
      createdAt,
      logPath
    });

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
    reason: "generation" | "correction" | "variant" | "manual_edit",
    createdAt: string
  ) {
    this.db
      .prepare(`
        INSERT INTO draft_versions (id, draft_id, body_markdown, quality_score, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(createId("version"), draftId, bodyMarkdown, qualityScore, reason, createdAt);
  }

  private computeDraftQualityScore(
    result: SkillRunnerResult,
    headline: string,
    bodyMarkdown: string
  ) {
    const signals = result.data?.qualitySignals;
    const signalScore = signals
      ? signals.clarity * 0.4 + signals.specificity * 0.4 + signals.antiHypeAlignment * 0.2
      : 0.55;
    const heuristicScore = this.estimateDraftQuality(headline, bodyMarkdown);

    return Number(
      Math.max(0.2, Math.min(0.95, signalScore * 0.45 + heuristicScore * 0.55)).toFixed(2)
    );
  }

  private estimateDraftQuality(headline: string, bodyMarkdown: string) {
    const nonEmptyLines = bodyMarkdown
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const normalizedLines = nonEmptyLines.map((line) => line.toLowerCase());
    const wordCount = bodyMarkdown
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean).length;
    const duplicatePenalty = normalizedLines.length - new Set(normalizedLines).size;
    const genericPatterns = [
      /structure retenue/i,
      /version revue/i,
      /ce post part d['’]un constat/i,
      /on gagne plus vite/i,
      /^ma grille de lecture ici/i
    ];
    const genericHits = genericPatterns.filter((pattern) => pattern.test(bodyMarkdown)).length;
    const startsByRepeatingHeadline =
      normalizedLines[0] === headline.trim().toLowerCase() ||
      normalizedLines[0] === `${headline.trim().toLowerCase()}.`;
    const specificitySignals =
      (/[0-9]/.test(bodyMarkdown) ? 1 : 0) +
      (/:/.test(bodyMarkdown) ? 1 : 0) +
      (/vs|contre|compar|cout|risque|process|pilot|roi/i.test(bodyMarkdown) ? 1 : 0);

    let score = 0.58;

    if (nonEmptyLines.length >= 4 && nonEmptyLines.length <= 9) {
      score += 0.08;
    } else if (nonEmptyLines.length < 3) {
      score -= 0.12;
    }

    if (wordCount >= 70 && wordCount <= 220) {
      score += 0.08;
    } else if (wordCount < 45) {
      score -= 0.16;
    }

    score += Math.min(0.09, specificitySignals * 0.03);
    score -= Math.min(0.2, genericHits * 0.1);
    score -= Math.min(0.12, duplicatePenalty * 0.04);

    if (startsByRepeatingHeadline) {
      score -= 0.08;
    }

    return Math.max(0.15, Math.min(0.92, score));
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

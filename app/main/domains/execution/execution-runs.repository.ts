import type Database from "better-sqlite3";
import type { SkillRunnerInvocation, SkillRunnerResult } from "./skill-runner.service";

// Single source of truth for writing rows to the execution_runs table.
// Consolidates the formerly-duplicated INSERT statements that lived inline in
// workshop.service.ts, library.service.ts, and news-to-post.service.ts.
//
// The function is a thin persistence helper. It does not wrap the INSERT in a
// transaction (callers stay in control of transaction boundaries) and does
// not deduplicate (callers are responsible for unique ids). It does not
// catch errors from db.prepare().run() so the existing error-handling paths
// at each call site continue to work unchanged.

export type ExecutionRunPayload = {
  id: string;
  ideaId: string | null;
  draftId: string | null;
  skillName: string;
  skillVersion: string;
  status: string;
  summary: string | null;
  inputJson: string;
  outputJson: string;
  outputMarkdown: string | null;
  errorMessage: string | null;
  logPath: string | null;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
  /**
   * Moteur qui a produit ce resultat. Sans cette colonne, la provenance d un
   * texte est indeterminable apres coup (cf. docs/audit-2026-07-fonctionnel.md).
   */
  engine: string | null;
};

const INSERT_STATEMENT = `
  INSERT INTO execution_runs (
    id, idea_id, draft_id, skill_name, skill_version, status, summary, input_json, output_json,
    output_markdown, error_message, log_path, started_at, finished_at, created_at, engine
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export function insertExecutionRun(db: Database.Database, payload: ExecutionRunPayload): void {
  db.prepare(INSERT_STATEMENT).run(
    payload.id,
    payload.ideaId,
    payload.draftId,
    payload.skillName,
    payload.skillVersion,
    payload.status,
    payload.summary,
    payload.inputJson,
    payload.outputJson,
    payload.outputMarkdown,
    payload.errorMessage,
    payload.logPath,
    payload.startedAt,
    payload.finishedAt,
    payload.createdAt,
    payload.engine
  );
}

/**
 * Helper unique d enregistrement d une execution : assemble la ligne
 * `execution_runs` a partir de l invocation et du resultat, puis l ecrit via
 * insertExecutionRun. Remplace les assemblages de payload dupliques (atelier,
 * bibliotheque, veille) par un mapping unique de colonnes/valeurs. La cle est
 * `invocation.runId` ; `startedAt`/`finishedAt`/`createdAt` partagent `createdAt`
 * (instant unique de persistance, comportement preexistant).
 */
export function recordExecutionRun(
  db: Database.Database,
  params: {
    invocation: SkillRunnerInvocation;
    result: SkillRunnerResult;
    ideaId: string | null;
    draftId: string | null;
    createdAt: string;
    logPath?: string | null;
  }
): void {
  const { invocation, result, ideaId, draftId, createdAt } = params;
  insertExecutionRun(db, {
    id: invocation.runId,
    ideaId,
    draftId,
    skillName: invocation.skillName,
    skillVersion: invocation.skillVersion,
    status: result.status,
    summary: result.summary,
    inputJson: JSON.stringify(invocation),
    outputJson: JSON.stringify(result),
    outputMarkdown:
      result.artifacts?.find((artifact) => artifact.kind === "markdown")?.content ?? null,
    errorMessage: result.error?.message ?? null,
    logPath: params.logPath ?? null,
    startedAt: createdAt,
    finishedAt: createdAt,
    engine: result.engine ?? null,
    createdAt
  });
}

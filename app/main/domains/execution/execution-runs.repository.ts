import type Database from "better-sqlite3";

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
};

const INSERT_STATEMENT = `
  INSERT INTO execution_runs (
    id, idea_id, draft_id, skill_name, skill_version, status, summary, input_json, output_json,
    output_markdown, error_message, log_path, started_at, finished_at, created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    payload.createdAt
  );
}

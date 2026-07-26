import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  insertExecutionRun,
  recordExecutionRun,
  type ExecutionRunPayload
} from "../../app/main/domains/execution/execution-runs.repository";
import type {
  SkillRunnerInvocation,
  SkillRunnerResult
} from "../../app/main/domains/execution/skill-runner.service";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS execution_runs (
    id TEXT PRIMARY KEY,
    idea_id TEXT,
    draft_id TEXT,
    skill_name TEXT NOT NULL,
    skill_version TEXT,
    status TEXT NOT NULL,
    summary TEXT,
    input_json TEXT NOT NULL,
    output_json TEXT NOT NULL,
    output_markdown TEXT,
    error_message TEXT,
    log_path TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    engine TEXT
  );
`;

function makePayload(overrides: Partial<ExecutionRunPayload> = {}): ExecutionRunPayload {
  return {
    id: "run_1",
    ideaId: "idea_1",
    draftId: "draft_1",
    skillName: "linkedin-post-writer",
    skillVersion: "1.0.0",
    status: "succeeded",
    summary: "Draft generated",
    inputJson: JSON.stringify({ runId: "run_1", skillName: "linkedin-post-writer" }),
    outputJson: JSON.stringify({ status: "succeeded", data: { draft: { headline: "Title" } } }),
    outputMarkdown: "# Markdown body",
    errorMessage: null,
    logPath: null,
    startedAt: "2026-04-12T01:00:00.000Z",
    finishedAt: "2026-04-12T01:00:01.000Z",
    createdAt: "2026-04-12T01:00:00.000Z",
    engine: null,
    ...overrides
  };
}

describe("insertExecutionRun", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(SCHEMA);
  });

  afterEach(() => {
    db.close();
  });

  it("inserts exactly one row per call", () => {
    insertExecutionRun(db, makePayload());
    const count = (db.prepare("SELECT COUNT(*) AS c FROM execution_runs").get() as { c: number }).c;
    expect(count).toBe(1);
  });

  it("preserves every column value from the payload", () => {
    const payload = makePayload();
    insertExecutionRun(db, payload);
    const row = db.prepare("SELECT * FROM execution_runs WHERE id = ?").get(payload.id) as Record<
      string,
      unknown
    >;
    expect(row.id).toBe(payload.id);
    expect(row.idea_id).toBe(payload.ideaId);
    expect(row.draft_id).toBe(payload.draftId);
    expect(row.skill_name).toBe(payload.skillName);
    expect(row.skill_version).toBe(payload.skillVersion);
    expect(row.status).toBe(payload.status);
    expect(row.summary).toBe(payload.summary);
    expect(row.input_json).toBe(payload.inputJson);
    expect(row.output_json).toBe(payload.outputJson);
    expect(row.output_markdown).toBe(payload.outputMarkdown);
    expect(row.error_message).toBe(payload.errorMessage);
    expect(row.log_path).toBe(payload.logPath);
    expect(row.started_at).toBe(payload.startedAt);
    expect(row.finished_at).toBe(payload.finishedAt);
    expect(row.created_at).toBe(payload.createdAt);
  });

  it("stores the JSON strings exactly as provided so they round-trip via JSON.parse", () => {
    const invocation = { runId: "run_2", skillName: "linkedin-hook-engine", payload: { foo: 42 } };
    const result = { status: "succeeded", data: { hooks: ["a", "b", "c"] } };
    insertExecutionRun(
      db,
      makePayload({
        id: "run_2",
        inputJson: JSON.stringify(invocation),
        outputJson: JSON.stringify(result)
      })
    );
    const row = db.prepare("SELECT input_json, output_json FROM execution_runs WHERE id = ?").get(
      "run_2"
    ) as { input_json: string; output_json: string };
    expect(JSON.parse(row.input_json)).toEqual(invocation);
    expect(JSON.parse(row.output_json)).toEqual(result);
  });

  it("handles null fields without throwing", () => {
    insertExecutionRun(
      db,
      makePayload({
        id: "run_3",
        ideaId: null,
        draftId: null,
        outputMarkdown: null,
        errorMessage: "Codex refused",
        logPath: "/tmp/log.json",
        summary: null
      })
    );
    const row = db.prepare("SELECT * FROM execution_runs WHERE id = ?").get("run_3") as Record<
      string,
      unknown
    >;
    expect(row.idea_id).toBeNull();
    expect(row.draft_id).toBeNull();
    expect(row.output_markdown).toBeNull();
    expect(row.error_message).toBe("Codex refused");
    expect(row.log_path).toBe("/tmp/log.json");
    expect(row.summary).toBeNull();
  });

  it("does not deduplicate — two distinct payloads produce two distinct rows", () => {
    insertExecutionRun(db, makePayload({ id: "run_4" }));
    insertExecutionRun(db, makePayload({ id: "run_5" }));
    const count = (db.prepare("SELECT COUNT(*) AS c FROM execution_runs").get() as { c: number }).c;
    expect(count).toBe(2);
  });
});

describe("recordExecutionRun (mapping unique des 3 chemins)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(SCHEMA);
  });

  afterEach(() => {
    db.close();
  });

  const invocation: SkillRunnerInvocation = {
    runId: "run_shared",
    skillName: "linkedin-post-writer",
    skillVersion: "1.0.0",
    context: { pillarLabel: "Cadrage" },
    payload: { title: "T", angle: "A" },
    attachments: []
  };

  it("derive la cle de invocation.runId et serialise invocation/result", () => {
    const result: SkillRunnerResult = {
      status: "succeeded",
      summary: "ok",
      artifacts: [{ kind: "markdown", label: "post", content: "# Corps" }]
    };
    recordExecutionRun(db, {
      invocation,
      result,
      ideaId: "idea_9",
      draftId: "draft_9",
      createdAt: "2026-05-01T10:00:00.000Z"
    });
    const row = db.prepare("SELECT * FROM execution_runs WHERE id = ?").get("run_shared") as Record<
      string,
      unknown
    >;
    expect(row.id).toBe("run_shared");
    expect(row.idea_id).toBe("idea_9");
    expect(row.draft_id).toBe("draft_9");
    expect(row.skill_name).toBe("linkedin-post-writer");
    expect(row.skill_version).toBe("1.0.0");
    expect(row.output_markdown).toBe("# Corps");
    expect(row.error_message).toBeNull();
    expect(row.log_path).toBeNull();
    expect(row.started_at).toBe("2026-05-01T10:00:00.000Z");
    expect(row.finished_at).toBe("2026-05-01T10:00:00.000Z");
    expect(JSON.parse(row.input_json as string)).toEqual(invocation);
  });

  it("ne lit que l artefact markdown pour output_markdown, et l erreur pour error_message", () => {
    const result: SkillRunnerResult = {
      status: "failed",
      summary: "ko",
      artifacts: [{ kind: "json", label: "x", content: "{}" }],
      error: { code: "X", message: "boom" }
    };
    recordExecutionRun(db, {
      invocation: { ...invocation, runId: "run_err" },
      result,
      ideaId: null,
      draftId: null,
      createdAt: "2026-05-01T10:00:00.000Z",
      logPath: "/tmp/r.json"
    });
    const row = db.prepare("SELECT * FROM execution_runs WHERE id = ?").get("run_err") as Record<
      string,
      unknown
    >;
    // artefact non-markdown -> output_markdown null (jamais artifacts[0] aveugle)
    expect(row.output_markdown).toBeNull();
    expect(row.error_message).toBe("boom");
    expect(row.log_path).toBe("/tmp/r.json");
  });
});

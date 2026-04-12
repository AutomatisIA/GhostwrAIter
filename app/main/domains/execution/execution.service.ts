import Database from "better-sqlite3";
import { shell } from "electron";
import type {
  ExecutionDiagnostics,
  ExecutionRunEntry,
  OpenRunLogResult
} from "../../../shared/types/execution";
import { SkillRegistryService } from "./skill-registry.service";
import { SkillRunnerService } from "./skill-runner.service";

type ExecutionRunRow = {
  id: string;
  skillName: string;
  status: "succeeded" | "failed" | "partial";
  summary: string;
  createdAt: string;
  errorMessage: string | null;
  logPath: string | null;
  outputJson: string | null;
};

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Execution run "${runId}" not found.`);
    this.name = "RUN_NOT_FOUND";
  }
}

export class RunLogUnavailableError extends Error {
  constructor(runId: string) {
    super(`Execution run "${runId}" has no technical log available.`);
    this.name = "RUN_LOG_UNAVAILABLE";
  }
}

function extractErrorCode(outputJson: string | null): string | null {
  if (!outputJson) {
    return null;
  }
  try {
    const parsed = JSON.parse(outputJson) as { error?: { code?: unknown } };
    const code = parsed.error?.code;
    return typeof code === "string" && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}

export class ExecutionService {
  constructor(
    private readonly db: Database.Database,
    private readonly codexAvailabilityCheck: () => boolean,
    private readonly skillRegistryService: SkillRegistryService,
    private readonly skillRunnerService?: SkillRunnerService
  ) {}

  listRuns(): ExecutionRunEntry[] {
    const rows = this.db
      .prepare(`
        SELECT
          id,
          skill_name AS skillName,
          status,
          summary,
          created_at AS createdAt,
          error_message AS errorMessage,
          log_path AS logPath,
          output_json AS outputJson
        FROM execution_runs
        ORDER BY rowid DESC
      `)
      .all() as ExecutionRunRow[];

    return rows.map((row) => ({
      id: row.id,
      skillName: row.skillName,
      status: row.status,
      summary: row.summary,
      createdAt: row.createdAt,
      errorCode: extractErrorCode(row.outputJson),
      errorMessage: row.errorMessage,
      logPath: row.logPath
    }));
  }

  getDiagnostics(): ExecutionDiagnostics {
    const codexAvailable = this.codexAvailabilityCheck();
    const runnerMode = this.skillRunnerService?.getRunnerMode() ?? "unavailable";

    return {
      runnerMode,
      codexAvailable,
      message:
        runnerMode === "codex"
          ? "Codex disponible et actif. Les generations passent uniquement si la sortie respecte le contrat attendu."
          : "Codex indisponible. Aucune generation n'est autorisee tant que le runner n'est pas disponible.",
      availableSkills: this.skillRegistryService.listInstalledSkills()
    };
  }

  async openRunLog(runId: string): Promise<OpenRunLogResult> {
    const row = this.db
      .prepare(`SELECT log_path AS logPath FROM execution_runs WHERE id = ?`)
      .get(runId) as { logPath: string | null } | undefined;

    if (!row) {
      throw new RunNotFoundError(runId);
    }
    if (!row.logPath) {
      throw new RunLogUnavailableError(runId);
    }

    const failure = await shell.openPath(row.logPath);
    if (failure) {
      throw new RunLogUnavailableError(runId);
    }
    return { opened: true };
  }
}

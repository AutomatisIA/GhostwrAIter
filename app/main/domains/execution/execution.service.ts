import Database from "better-sqlite3";
import { resolve } from "node:path";
import { shell } from "electron";
import type {
  ExecutionDiagnostics,
  ExecutionRunEntry,
  OpenRunLogResult
} from "../../../shared/types/execution";
import { SkillRegistryService } from "./skill-registry.service";
import { SkillRunnerService } from "./skill-runner.service";
import type { EngineRegistry } from "./engine-registry";

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
    private readonly skillRunnerService?: SkillRunnerService,
    private readonly executionLogsDirectory?: string,
    private readonly engineRegistry?: EngineRegistry
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
      hasLog: row.logPath !== null
    }));
  }

  async getDiagnostics(): Promise<ExecutionDiagnostics> {
    const engines = this.engineRegistry
      ? await this.engineRegistry.detectEngines()
      : [];
    const activeSelection = this.engineRegistry
      ? await this.engineRegistry.getActiveEngine()
      : null;
    const activeEngine = activeSelection?.engine ?? "unavailable";
    const hasAuthenticated = engines.some((e) => e.installState === "authenticated");

    return {
      activeEngine,
      engines,
      message: hasAuthenticated
        ? "Moteur IA disponible et actif. Les generations passent uniquement si la sortie respecte le contrat attendu."
        : "Aucun moteur IA disponible. Aucune generation n'est autorisee tant qu'un moteur n'est pas connecte.",
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

    if (this.executionLogsDirectory) {
      const resolved = resolve(row.logPath);
      const expectedPrefix = resolve(this.executionLogsDirectory);
      if (!resolved.startsWith(expectedPrefix + "/") && resolved !== expectedPrefix) {
        throw new RunLogUnavailableError(runId);
      }
    }

    const failure = await shell.openPath(row.logPath);
    if (failure) {
      throw new RunLogUnavailableError(runId);
    }
    return { opened: true };
  }
}

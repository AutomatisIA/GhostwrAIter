import Database from "better-sqlite3";
import type {
  ExecutionDiagnostics,
  ExecutionRunEntry
} from "../../../shared/types/execution";
import { SkillRegistryService } from "./skill-registry.service";
import { SkillRunnerService } from "./skill-runner.service";

export class ExecutionService {
  constructor(
    private readonly db: Database.Database,
    private readonly codexAvailabilityCheck: () => boolean,
    private readonly skillRegistryService: SkillRegistryService,
    private readonly skillRunnerService?: SkillRunnerService
  ) {}

  listRuns(): ExecutionRunEntry[] {
    return this.db
      .prepare(`
        SELECT
          id,
          skill_name AS skillName,
          status,
          summary,
          created_at AS createdAt
        FROM execution_runs
        ORDER BY rowid DESC
      `)
      .all() as ExecutionRunEntry[];
  }

  getDiagnostics(): ExecutionDiagnostics {
    const codexAvailable = this.codexAvailabilityCheck();
    const runnerMode = this.skillRunnerService?.getRunnerMode() ?? "local-simulated";

    return {
      runnerMode,
      codexAvailable,
      message: `Runner operationnel en mode ${runnerMode}. Codex disponible: ${codexAvailable ? "oui" : "non"}.`,
      availableSkills: this.skillRegistryService.listInstalledSkills()
    };
  }
}

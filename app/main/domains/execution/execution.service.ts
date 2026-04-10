import Database from "better-sqlite3";
import type {
  ExecutionDiagnostics,
  ExecutionRunEntry
} from "../../../shared/types/execution";
import { SkillRegistryService } from "./skill-registry.service";

export class ExecutionService {
  constructor(
    private readonly db: Database.Database,
    private readonly codexAvailabilityCheck: () => boolean,
    private readonly skillRegistryService: SkillRegistryService
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

    return {
      runnerMode: "local-simulated",
      codexAvailable,
      message: `Runner operationnel en mode local-simulated. Codex disponible: ${codexAvailable ? "oui" : "non"}.`,
      availableSkills: this.skillRegistryService.listInstalledSkills()
    };
  }
}

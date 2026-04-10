import Database from "better-sqlite3";
import { ExecutionService } from "../domains/execution/execution.service";
import { SkillRegistryService } from "../domains/execution/skill-registry.service";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";

type IpcRegistrar = {
  handle: (
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
};

export class ExecutionRuntimeService {
  private readonly service: ExecutionService;

  constructor(
    db: Database.Database,
    codexAvailabilityCheck: () => boolean,
    skillRegistryService: SkillRegistryService,
    skillRunnerService?: SkillRunnerService
  ) {
    this.service = new ExecutionService(
      db,
      codexAvailabilityCheck,
      skillRegistryService,
      skillRunnerService
    );
  }

  listRuns() {
    return this.service.listRuns();
  }

  getDiagnostics() {
    return this.service.getDiagnostics();
  }
}

export function registerExecutionIpcHandlers(
  ipcRegistrar: IpcRegistrar,
  executionService: ExecutionRuntimeService
) {
  ipcRegistrar.handle("execution:list-runs", async () => executionService.listRuns());
  ipcRegistrar.handle("execution:get-diagnostics", async () =>
    executionService.getDiagnostics()
  );
}

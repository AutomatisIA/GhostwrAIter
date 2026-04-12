import Database from "better-sqlite3";
import { ExecutionService } from "../domains/execution/execution.service";
import { SkillRegistryService } from "../domains/execution/skill-registry.service";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import {
  registerKnownErrorCode,
  registerValidatedHandler,
  type IpcRegistrar
} from "./register-validated-handler";
import { emptyInputSchema, openRunLogInputSchema } from "../../shared/schemas/execution";

registerKnownErrorCode("RUN_NOT_FOUND", "RUN_NOT_FOUND");
registerKnownErrorCode("RUN_LOG_UNAVAILABLE", "RUN_LOG_UNAVAILABLE");

export class ExecutionRuntimeService {
  private readonly service: ExecutionService;

  constructor(
    db: Database.Database,
    codexAvailabilityCheck: () => boolean,
    skillRegistryService: SkillRegistryService,
    skillRunnerService?: SkillRunnerService,
    executionLogsDirectory?: string
  ) {
    this.service = new ExecutionService(
      db,
      codexAvailabilityCheck,
      skillRegistryService,
      skillRunnerService,
      executionLogsDirectory
    );
  }

  listRuns() {
    return this.service.listRuns();
  }

  getDiagnostics() {
    return this.service.getDiagnostics();
  }

  openRunLog(runId: string) {
    return this.service.openRunLog(runId);
  }
}

export function registerExecutionIpcHandlers(
  ipcRegistrar: IpcRegistrar,
  executionService: ExecutionRuntimeService
) {
  registerValidatedHandler(
    ipcRegistrar,
    "execution:list-runs",
    emptyInputSchema,
    () => executionService.listRuns()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "execution:get-diagnostics",
    emptyInputSchema,
    () => executionService.getDiagnostics()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "execution:open-run-log",
    openRunLogInputSchema,
    (runId: string) => executionService.openRunLog(runId)
  );
}

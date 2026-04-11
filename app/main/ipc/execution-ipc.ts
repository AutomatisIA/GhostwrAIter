import Database from "better-sqlite3";
import { ExecutionService } from "../domains/execution/execution.service";
import { SkillRegistryService } from "../domains/execution/skill-registry.service";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import { emptyInputSchema } from "../../shared/schemas/execution";
import {
  registerValidatedHandler,
  type IpcRegistrar
} from "./register-validated-handler";

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
}

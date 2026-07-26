import Database from "better-sqlite3";
import { ExecutionService } from "../domains/execution/execution.service";
import type { EngineRegistry } from "../domains/execution/engine-registry";
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

/**
 * Codes lies au choix du moteur IA. Sans cet enregistrement, `classifyThrown`
 * ecrase le message en "Une erreur interne s est produite cote application" et
 * l utilisateur ne sait pas que son moteur n est simplement pas connecte
 * (cf. docs/audit-2026-07-fonctionnel.md section 2).
 */
registerKnownErrorCode("ENGINE_NOT_AUTHENTICATED", "ENGINE_NOT_AUTHENTICATED");
registerKnownErrorCode("ENGINE_NOT_REGISTERED", "ENGINE_NOT_REGISTERED");
registerKnownErrorCode("ENGINE_RESOLUTION_FAILED", "ENGINE_RESOLUTION_FAILED");
registerKnownErrorCode("ENGINE_UNAVAILABLE", "ENGINE_UNAVAILABLE");

/**
 * Les six autres codes que `skill-runner.service.ts` sait produire. Seuls les
 * quatre ci-dessus etaient enregistres : les autres etaient ecrases par
 * `classifyThrown` en `IPC_HANDLER_ERROR: "Unexpected handler error: ..."`. Un
 * probleme reessayable (le moteur a renvoye une sortie illisible) s affichait
 * donc en erreur interne generique, exactement ce que `skill-run-error.ts`
 * existe pour eviter. Cette liste doit suivre les codes du runner : tout code
 * qu il produit et qui manque ici perd son message en chemin.
 */
registerKnownErrorCode("ENGINE_INVALID_JSON", "ENGINE_INVALID_JSON");
registerKnownErrorCode("ENGINE_INVALID_CONTRACT", "ENGINE_INVALID_CONTRACT");
registerKnownErrorCode("ENGINE_EXECUTION_ERROR", "ENGINE_EXECUTION_ERROR");
registerKnownErrorCode("SKILL_PROMPT_NOT_FOUND", "SKILL_PROMPT_NOT_FOUND");
registerKnownErrorCode("FRAMEWORK_PROMPT_NOT_FOUND", "FRAMEWORK_PROMPT_NOT_FOUND");
registerKnownErrorCode("SKILL_RUN_FAILED", "SKILL_RUN_FAILED");

export class ExecutionRuntimeService {
  private readonly service: ExecutionService;

  constructor(
    db: Database.Database,
    skillRegistryService: SkillRegistryService,
    skillRunnerService?: SkillRunnerService,
    executionLogsDirectory?: string,
    engineRegistry?: EngineRegistry
  ) {
    this.service = new ExecutionService(
      db,
      skillRegistryService,
      skillRunnerService,
      executionLogsDirectory,
      engineRegistry
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

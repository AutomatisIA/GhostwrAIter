import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import { IdeasRepository } from "../domains/ideas/ideas.repository";
import type { StrategyBundle } from "../../shared/types/strategy";
import {
  createWorkshopTables,
  WorkshopService
} from "../domains/workshop/workshop.service";
import type { HookOption, PostObjective, PostTypology } from "../../shared/types/workshop";

type IpcRegistrar = {
  handle: (
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
};

export class WorkshopRuntimeService {
  private readonly service: WorkshopService;

  constructor(
    db: Database.Database,
    ideasRepository: IdeasRepository,
    getActiveStrategy?: () => StrategyBundle | null,
    executionLogsDirectory?: string,
    skillRunnerService?: SkillRunnerService
  ) {
    createWorkshopTables(db);
    this.service = new WorkshopService(
      db,
      ideasRepository,
      getActiveStrategy,
      executionLogsDirectory,
      skillRunnerService
    );
  }

  getSessionByIdeaId(ideaId: string) {
    return this.service.getSessionByIdeaId(ideaId);
  }

  generateFromIdea(ideaId: string) {
    return this.service.generateDraftFromIdea(ideaId);
  }

  getSuggestedStructures(ideaId: string, typology: PostTypology, objective: PostObjective) {
    return this.service.getSuggestedStructures(ideaId, typology, objective);
  }

  generateHooks(ideaId: string, typology: PostTypology, structureKey: string) {
    return this.service.generateHooks(ideaId, typology, structureKey);
  }

  generateFinalDraft(
    ideaId: string,
    typology: PostTypology,
    objective: PostObjective,
    structureKey: string,
    structureLabel: string,
    selectedHookId: string,
    selectedHookText: string,
    hooks: HookOption[]
  ) {
    return this.service.generateFinalDraft(
      ideaId,
      typology,
      objective,
      structureKey,
      structureLabel,
      selectedHookId,
      selectedHookText,
      hooks
    );
  }

  correctDraft(draftId: string) {
    return this.service.correctDraft(draftId);
  }

  createVariant(draftId: string, variantType: string) {
    return this.service.createVariant(draftId, variantType);
  }
}

export function registerWorkshopIpcHandlers(
  ipcRegistrar: IpcRegistrar,
  workshopService: WorkshopRuntimeService
) {
  ipcRegistrar.handle("workshop:get-session-by-idea-id", async (_event, ideaId) =>
    workshopService.getSessionByIdeaId(String(ideaId))
  );
  ipcRegistrar.handle("workshop:generate-from-idea", async (_event, ideaId) =>
    workshopService.generateFromIdea(String(ideaId))
  );
  ipcRegistrar.handle(
    "workshop:get-suggested-structures",
    async (_event, ideaId, typology, objective) =>
      workshopService.getSuggestedStructures(
        String(ideaId),
        typology as PostTypology,
        objective as PostObjective
      )
  );
  ipcRegistrar.handle("workshop:generate-hooks", async (_event, ideaId, typology, structureKey) =>
    workshopService.generateHooks(String(ideaId), typology as PostTypology, String(structureKey))
  );
  ipcRegistrar.handle(
    "workshop:generate-final-draft",
    async (
      _event,
      ideaId,
      typology,
      objective,
      structureKey,
      structureLabel,
      selectedHookId,
      selectedHookText,
      hooks
    ) =>
      workshopService.generateFinalDraft(
        String(ideaId),
        typology as PostTypology,
        objective as PostObjective,
        String(structureKey),
        String(structureLabel),
        String(selectedHookId),
        String(selectedHookText),
        (hooks ?? []) as HookOption[]
      )
  );
  ipcRegistrar.handle("workshop:correct-draft", async (_event, draftId) =>
    workshopService.correctDraft(String(draftId))
  );
  ipcRegistrar.handle("workshop:create-variant", async (_event, draftId, variantType) =>
    workshopService.createVariant(String(draftId), String(variantType))
  );
}

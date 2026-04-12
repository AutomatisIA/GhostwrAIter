import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import { IdeasRepository } from "../domains/ideas/ideas.repository";
import type { StrategyBundle } from "../../shared/types/strategy";
import {
  createWorkshopTables,
  WorkshopService
} from "../domains/workshop/workshop.service";
import type { HookOption, PostObjective, PostTypology } from "../../shared/types/workshop";
import {
  correctDraftTupleSchema,
  createVariantTupleSchema,
  draftIdSchema,
  generateFinalDraftTupleSchema,
  generateHooksTupleSchema,
  ideaIdSchema,
  suggestedStructuresTupleSchema,
  updateDraftTextTupleSchema
} from "../../shared/schemas/workshop";
import {
  registerValidatedHandler,
  registerValidatedTupleHandler,
  type IpcRegistrar
} from "./register-validated-handler";

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

  updateDraftText(draftId: string, headline: string, bodyMarkdown: string) {
    return this.service.updateDraftText(draftId, headline, bodyMarkdown);
  }
}

export function registerWorkshopIpcHandlers(
  ipcRegistrar: IpcRegistrar,
  workshopService: WorkshopRuntimeService
) {
  registerValidatedHandler(
    ipcRegistrar,
    "workshop:get-session-by-idea-id",
    ideaIdSchema,
    (ideaId) => workshopService.getSessionByIdeaId(ideaId)
  );
  registerValidatedHandler(
    ipcRegistrar,
    "workshop:generate-from-idea",
    ideaIdSchema,
    (ideaId) => workshopService.generateFromIdea(ideaId)
  );
  registerValidatedTupleHandler<[string, PostTypology, PostObjective], unknown>(
    ipcRegistrar,
    "workshop:get-suggested-structures",
    suggestedStructuresTupleSchema,
    (ideaId, typology, objective) =>
      workshopService.getSuggestedStructures(ideaId, typology, objective)
  );
  registerValidatedTupleHandler<[string, PostTypology, string], unknown>(
    ipcRegistrar,
    "workshop:generate-hooks",
    generateHooksTupleSchema,
    (ideaId, typology, structureKey) =>
      workshopService.generateHooks(ideaId, typology, structureKey)
  );
  registerValidatedTupleHandler<
    [
      string,
      PostTypology,
      PostObjective,
      string,
      string,
      string,
      string,
      HookOption[]
    ],
    unknown
  >(
    ipcRegistrar,
    "workshop:generate-final-draft",
    generateFinalDraftTupleSchema,
    (
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
        ideaId,
        typology,
        objective,
        structureKey,
        structureLabel,
        selectedHookId,
        selectedHookText,
        hooks
      )
  );
  registerValidatedHandler(
    ipcRegistrar,
    "workshop:correct-draft",
    draftIdSchema,
    (draftId) => workshopService.correctDraft(draftId)
  );
  registerValidatedTupleHandler<[string, string], unknown>(
    ipcRegistrar,
    "workshop:create-variant",
    createVariantTupleSchema,
    (draftId, variantType) => workshopService.createVariant(draftId, variantType)
  );
  // `correctDraftTupleSchema` is intentionally exported for symmetry and
  // potential future use; `correct-draft` uses the single-input variant
  // because it has only one scalar argument.
  registerValidatedTupleHandler<[string, string, string], unknown>(
    ipcRegistrar,
    "workshop:update-draft-text",
    updateDraftTextTupleSchema,
    (draftId, headline, bodyMarkdown) =>
      workshopService.updateDraftText(draftId, headline, bodyMarkdown)
  );
  void correctDraftTupleSchema;
}

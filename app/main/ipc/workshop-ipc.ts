import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import { IdeasRepository } from "../domains/ideas/ideas.repository";
import type { StrategyBundle } from "../../shared/types/strategy";
import {
  createWorkshopTables,
  WorkshopService
} from "../domains/workshop/workshop.service";

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

  correctDraft(draftId: string) {
    return this.service.correctDraft(draftId);
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
  ipcRegistrar.handle("workshop:correct-draft", async (_event, draftId) =>
    workshopService.correctDraft(String(draftId))
  );
}

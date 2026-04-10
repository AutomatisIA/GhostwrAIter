import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import { LibraryService } from "../domains/library/library.service";

type IpcRegistrar = {
  handle: (
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
};

export class LibraryRuntimeService {
  private readonly service: LibraryService;

  constructor(db: Database.Database, skillRunnerService?: SkillRunnerService) {
    this.service = new LibraryService(db, skillRunnerService);
  }

  listEntries() {
    return this.service.listEntries();
  }

  searchEntries(input: Parameters<LibraryService["searchEntries"]>[0]) {
    return this.service.searchEntries(input);
  }

  createVariantFromDraft(draftId: string) {
    return this.service.createVariantFromDraft(draftId);
  }
}

export function registerLibraryIpcHandlers(
  ipcRegistrar: IpcRegistrar,
  libraryService: LibraryRuntimeService
) {
  ipcRegistrar.handle("library:list-entries", async () => libraryService.listEntries());
  ipcRegistrar.handle("library:search-entries", async (_event, input) =>
    libraryService.searchEntries((input ?? {}) as Parameters<LibraryService["searchEntries"]>[0])
  );
  ipcRegistrar.handle("library:create-variant-from-draft", async (_event, draftId) =>
    libraryService.createVariantFromDraft(String(draftId))
  );
}

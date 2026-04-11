import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import { LibraryService } from "../domains/library/library.service";
import type { StrategyBundle } from "../../shared/types/strategy";
import {
  draftIdSchema,
  emptyInputSchema,
  searchLibraryInputSchema,
  type SearchLibraryInput
} from "../../shared/schemas/library";
import {
  registerValidatedHandler,
  type IpcRegistrar
} from "./register-validated-handler";

export class LibraryRuntimeService {
  private readonly service: LibraryService;

  constructor(
    db: Database.Database,
    skillRunnerService?: SkillRunnerService,
    getActiveStrategy?: () => StrategyBundle | null
  ) {
    this.service = new LibraryService(db, skillRunnerService, getActiveStrategy);
  }

  listEntries() {
    return this.service.listEntries();
  }

  searchEntries(input: SearchLibraryInput) {
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
  registerValidatedHandler(
    ipcRegistrar,
    "library:list-entries",
    emptyInputSchema,
    () => libraryService.listEntries()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "library:search-entries",
    searchLibraryInputSchema,
    (input) => libraryService.searchEntries(input)
  );
  registerValidatedHandler(
    ipcRegistrar,
    "library:create-variant-from-draft",
    draftIdSchema,
    (draftId) => libraryService.createVariantFromDraft(draftId)
  );
}

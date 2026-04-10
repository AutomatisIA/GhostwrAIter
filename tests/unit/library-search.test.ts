import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createIdeasTables,
  IdeasRepository
} from "../../app/main/domains/ideas/ideas.repository";
import {
  createWorkshopTables,
  WorkshopService
} from "../../app/main/domains/workshop/workshop.service";
import { LibraryService } from "../../app/main/domains/library/library.service";

describe("library search", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let workshopService: WorkshopService;
  let libraryService: LibraryService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    ideasRepository = new IdeasRepository(db);
    workshopService = new WorkshopService(db, ideasRepository);
    libraryService = new LibraryService(db);
  });

  afterEach(() => {
    db.close();
  });

  it("filters library entries by keyword and deterministic metadata", () => {
    const first = ideasRepository.createIdea({
      title: "Comment prioriser 3 cas d'usage IA",
      angle: "Aller vers le utile avant le spectaculaire",
      pillarLabel: "ROI"
    });
    const second = ideasRepository.createIdea({
      title: "Pourquoi les prompts ne suffisent pas",
      angle: "Le probleme est organisationnel",
      pillarLabel: "Adoption IA"
    });

    workshopService.generateDraftFromIdea(first.id);
    workshopService.generateDraftFromIdea(second.id);

    const entries = libraryService.searchEntries({
      query: "prompts",
      pillarLabel: "Adoption IA",
      status: "draft",
      tag: "prompts"
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.headline).toContain("prompts");
    expect(entries[0]?.pillarLabel).toBe("Adoption IA");
    expect(entries[0]?.status).toBe("draft");
    expect(entries[0]?.tags).toContain("prompts");
  });
});

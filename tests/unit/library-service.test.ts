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

describe("library service", () => {
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

  it("lists generated drafts for the library", () => {
    const idea = ideasRepository.createIdea({
      title: "Pourquoi cadrer avant de prompter",
      angle: "Le process prime sur l'outil",
      pillarLabel: "Methodes"
    });

    workshopService.generateDraftFromIdea(idea.id);

    const entries = libraryService.listEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0]?.headline).toContain("Pourquoi cadrer");
    expect(entries[0]?.status).toBe("draft");
    expect(entries[0]?.pillarLabel).toBe("Methodes");
    expect(entries[0]?.tags.length).toBeGreaterThan(0);
  });

  it("creates a variant linked to the source draft without overwriting it", () => {
    const idea = ideasRepository.createIdea({
      title: "Pourquoi cadrer avant de prompter",
      angle: "Le process prime sur l'outil",
      pillarLabel: "Methodes"
    });

    const generated = workshopService.generateDraftFromIdea(idea.id);
    const variant = libraryService.createVariantFromDraft(generated.draft.id);
    const entries = libraryService.listEntries();

    expect(variant.sourceDraftId).toBe(generated.draft.id);
    expect(variant.status).toBe("variant");
    expect(variant.tags).toContain("variante");
    expect(entries).toHaveLength(2);
  });
});

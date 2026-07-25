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
import { CalendarService } from "../../app/main/domains/calendar/calendar.service";
import { LibraryService } from "../../app/main/domains/library/library.service";
import {
  createStrategyBundleFixture,
  createStrictSkillRunnerService
} from "./helpers/fake-codex";

describe("library service", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let workshopService: WorkshopService;
  let libraryService: LibraryService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    // La bibliotheque lit `calendar_items` pour deriver le triage. Ce
    // constructeur cree la table, comme au demarrage de l application.
    new CalendarService(db);
    ideasRepository = new IdeasRepository(db);
    const strategyBundle = createStrategyBundleFixture();
    const skillRunnerService = createStrictSkillRunnerService();
    workshopService = new WorkshopService(
      db,
      ideasRepository,
      () => strategyBundle,
      undefined,
      skillRunnerService
    );
    libraryService = new LibraryService(db, skillRunnerService, () => strategyBundle);
  });

  afterEach(() => {
    db.close();
  });

  it("lists generated drafts for the library", async () => {
    const idea = ideasRepository.createIdea({
      title: "Pourquoi cadrer avant de prompter",
      angle: "Le process prime sur l'outil",
      pillarLabel: "Methodes"
    });

    await workshopService.generateDraftFromIdea(idea.id);

    const entries = libraryService.listEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0]?.headline).toContain("Pourquoi cadrer");
    expect(entries[0]?.status).toBe("draft");
    expect(entries[0]?.pillarLabel).toBe("Methodes");
    expect(entries[0]?.tags.length).toBeGreaterThan(0);
  });

  it("creates a variant linked to the source draft without overwriting it", async () => {
    const idea = ideasRepository.createIdea({
      title: "Pourquoi cadrer avant de prompter",
      angle: "Le process prime sur l'outil",
      pillarLabel: "Methodes"
    });

    const generated = await workshopService.generateDraftFromIdea(idea.id);
    const variant = await libraryService.createVariantFromDraft(generated.draft.id);
    const entries = libraryService.listEntries();

    expect(variant.sourceDraftId).toBe(generated.draft.id);
    expect(variant.status).toBe("variant");
    expect(variant.tags).toContain("variante");
    expect(entries).toHaveLength(2);
  });

  it("persists canonical repurpose execution output for a created variant", async () => {
    const idea = ideasRepository.createIdea({
      title: "Pourquoi cadrer avant de prompter",
      angle: "Le process prime sur l'outil",
      pillarLabel: "Methodes"
    });

    const generated = await workshopService.generateDraftFromIdea(idea.id);
    const variant = await libraryService.createVariantFromDraft(generated.draft.id);
    const runRow = db
      .prepare(`
        SELECT
          skill_name AS skillName,
          input_json AS inputJson,
          output_json AS outputJson
        FROM execution_runs
        WHERE draft_id = ?
      `)
      .get(variant.draftId) as
        | {
            skillName: string;
            inputJson: string;
            outputJson: string;
          }
        | undefined;

    expect(runRow?.skillName).toBe("linkedin-repurpose");
    expect(JSON.parse(runRow?.inputJson ?? "{}").skillName).toBe("linkedin-repurpose");
    expect(JSON.parse(runRow?.outputJson ?? "{}").status).toBe("succeeded");
  });
});

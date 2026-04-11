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
import {
  createStrategyBundleFixture,
  createStrictSkillRunnerService
} from "./helpers/fake-codex";

describe("calendar service", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let workshopService: WorkshopService;
  let calendarService: CalendarService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    ideasRepository = new IdeasRepository(db);
    workshopService = new WorkshopService(
      db,
      ideasRepository,
      () => createStrategyBundleFixture(),
      undefined,
      createStrictSkillRunnerService()
    );
    calendarService = new CalendarService(db);
  });

  afterEach(() => {
    db.close();
  });

  it("schedules a generated draft in the editorial calendar", () => {
    const idea = ideasRepository.createIdea({
      title: "Le vrai cout de l'IA mal cadree",
      angle: "On perd du temps, pas juste des tokens",
      pillarLabel: "ROI"
    });
    const session = workshopService.generateDraftFromIdea(idea.id);

    calendarService.scheduleDraft({
      draftId: session.draft.id,
      plannedDate: "2026-04-15",
      status: "planned"
    });

    const items = calendarService.listItems();

    expect(items).toHaveLength(1);
    expect(items[0]?.draftId).toBe(session.draft.id);
    expect(items[0]?.draftHeadline).toBe("Le vrai cout de l'IA mal cadree");
    expect(items[0]?.pillarLabel).toBe("ROI");
    expect(items[0]?.plannedDate).toBe("2026-04-15");
  });
});

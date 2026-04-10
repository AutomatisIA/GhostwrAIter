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

describe("workshop service", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let workshopService: WorkshopService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    ideasRepository = new IdeasRepository(db);
    workshopService = new WorkshopService(db, ideasRepository);
  });

  afterEach(() => {
    db.close();
  });

  it("generates a draft, hooks and an execution run from an idea", () => {
    const idea = ideasRepository.createIdea({
      title: "Le vrai frein a l'IA en PME",
      angle: "Le probleme n'est presque jamais le prompt",
      pillarLabel: "Adoption IA"
    });

    const session = workshopService.generateDraftFromIdea(idea.id);

    expect(session.idea.id).toBe(idea.id);
    expect(session.draft.headline).toContain("Le vrai frein");
    expect(session.hooks.length).toBeGreaterThan(0);
    expect(session.run.skillName).toBe("linkedin-post-writer");
    expect(session.run.status).toBe("succeeded");
    expect(session.versions).toHaveLength(1);
    expect(session.versions[0]?.reason).toBe("generation");
    expect(session.contextUsed.pillarLabel).toBe("Adoption IA");
    expect(session.contextUsed.activeSkills).toContain("linkedin-post-writer");
  });

  it("improves the latest draft with a correction run", () => {
    const idea = ideasRepository.createIdea({
      title: "Comment cadrer un projet IA PME",
      angle: "Commencer par un process, pas par l'outil",
      pillarLabel: "Methodes"
    });

    const generated = workshopService.generateDraftFromIdea(idea.id);
    const corrected = workshopService.correctDraft(generated.draft.id);

    expect(corrected.draft.qualityScore).toBeGreaterThan(0.7);
    expect(corrected.run.skillName).toBe("linkedin-post-editor");
    expect(corrected.draft.bodyMarkdown).toContain("Version revue");
    expect(corrected.versions).toHaveLength(2);
    expect(corrected.versions[0]?.reason).toBe("generation");
    expect(corrected.versions[1]?.reason).toBe("correction");
    expect(corrected.versions[0]?.bodyMarkdown).toContain("Comment cadrer un projet IA PME");
  });
});

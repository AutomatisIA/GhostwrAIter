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

  it("suggests structures for an idea", () => {
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l'outil",
      pillarLabel: "Methodes"
    });

    const structures = workshopService.getSuggestedStructures(idea.id, "expertise", "awareness");

    expect(structures.length).toBeGreaterThan(0);
    expect(structures[0].key).toBe("belief-terrain-reality");
  });

  it("generates hooks for an idea and structure", () => {
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l'outil",
      pillarLabel: "Methodes"
    });

    const hooks = workshopService.generateHooks(idea.id, "expertise", "belief-terrain-reality");

    expect(hooks.length).toBeGreaterThan(0);
    expect(hooks[0].text).toContain("Le vrai probleme");
  });

  it("generates a final draft from all selections", () => {
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l'outil",
      pillarLabel: "Methodes"
    });

    const structures = workshopService.getSuggestedStructures(idea.id, "expertise", "awareness");
    const hooks = workshopService.generateHooks(idea.id, "expertise", structures[0].key);

    const session = workshopService.generateFinalDraft(
      idea.id,
      "expertise",
      "awareness",
      structures[0].key,
      hooks[0].id
    );

    expect(session.idea.id).toBe(idea.id);
    expect(session.draft.headline).toBe("IA en PME");
    expect(session.draft.bodyMarkdown).toContain("Structure retenue : Croyance -> terrain -> realite");
    expect(session.run.skillName).toBe("linkedin-post-writer");
  });

  it("generates a draft, hooks and an execution run from an idea (legacy mode)", () => {
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
  });
});

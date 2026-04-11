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
import { SkillRunnerService } from "../../app/main/domains/execution/skill-runner.service";
import {
  createStrategyBundleFixture,
  createStrictSkillRunnerService
} from "./helpers/fake-codex";

describe("workshop service", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let workshopService: WorkshopService;

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
      structures[0].label,
      hooks[0].id,
      hooks[0].text,
      hooks
    );

    expect(session.idea.id).toBe(idea.id);
    expect(session.draft.headline).toBe("IA en PME");
    expect(session.draft.bodyMarkdown).not.toContain("Structure retenue");
    expect(session.draft.bodyMarkdown).toContain("Le vrai probleme");
    expect(session.draft.qualityScore).toBeLessThan(0.8);
    expect(session.draft.typology).toBe("expertise");
    expect(session.draft.objective).toBe("awareness");
    expect(session.draft.structureKey).toBe("belief-terrain-reality");
    expect(session.draft.structureLabel).toBe("Croyance -> terrain -> realite");
    expect(session.draft.selectedHookText).toContain("Le vrai probleme");
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

    expect(corrected.draft.qualityScore).toBeGreaterThan(generated.draft.qualityScore);
    expect(corrected.draft.qualityScore).not.toBe(0.89);
    expect(corrected.run.skillName).toBe("linkedin-post-editor");
    expect(corrected.draft.bodyMarkdown).not.toContain("Version revue");
  });

  it("creates a short variant from an existing draft", () => {
    const idea = ideasRepository.createIdea({
      title: "IA PME",
      angle: "Cas concret",
      pillarLabel: "Expertise"
    });

    const session = workshopService.generateDraftFromIdea(idea.id);
    const variantSession = workshopService.createVariant(session.draft.id, "short");

    expect(variantSession.draft.id).not.toBe(session.draft.id);
    expect(variantSession.draft.bodyMarkdown).toContain("Variante orientee angle complementaire");
    expect(variantSession.run.skillName).toBe("linkedin-repurpose");
  });

  it("passes rich strategy context to Codex invocations", () => {
    const invocations: Array<{ skillName: string; context: Record<string, unknown> }> = [];
    const skillRunner = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: (invocation) => {
          invocations.push({ skillName: invocation.skillName, context: invocation.context });
          return createStrictSkillRunnerService().execute(invocation);
        }
      }
    });
    const service = new WorkshopService(
      db,
      ideasRepository,
      () => createStrategyBundleFixture(),
      undefined,
      skillRunner
    );
    const idea = ideasRepository.createIdea({
      title: "Automatisation VS Agent IA autonome",
      angle: "L automatisation reste souvent plus fiable et plus simple a piloter.",
      pillarLabel: "ROI"
    });

    const structures = service.getSuggestedStructures(idea.id, "expertise", "awareness");
    const hooks = service.generateHooks(idea.id, "expertise", structures[0].key);
    service.generateFinalDraft(
      idea.id,
      "expertise",
      "awareness",
      structures[0].key,
      structures[0].label,
      hooks[0].id,
      hooks[0].text,
      hooks
    );

    const writerContext = invocations.find(({ skillName }) => skillName === "linkedin-post-writer")
      ?.context;

    expect(writerContext).toMatchObject({
      strategyProfileName: "Philippe",
      strategyPositioning: "Consultant IA generative pour PME",
      strategyBio: "J aide les PME a deployer l IA sans theatre ni promesse vide.",
      strategyExpertiseSummary: "Adoption IA, cadrage, ROI, gouvernance et execution terrain.",
      pillarLabel: "ROI",
      pillarDescription: "Comment arbitrer entre promesse, cout, risque et impact operationnel.",
      voiceGuardrail: "Pas de hype, pas de jargon, pas de formule creuse."
    });
    expect(writerContext?.strategyOffersSummary).toContain("Audit IA PME");
    expect(writerContext?.strategyIcpSummary).toContain("Dirigeants de PME");
  });
});

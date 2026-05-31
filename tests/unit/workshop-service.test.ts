import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createIdeasTables,
  IdeasRepository
} from "../../app/main/domains/ideas/ideas.repository";
import {
  createWorkshopTables,
  ensureColumn,
  WORKSHOP_COLUMN_ALLOWLIST,
  WorkshopService
} from "../../app/main/domains/workshop/workshop.service";
import { SkillRunnerService } from "../../app/main/domains/execution/skill-runner.service";
import {
  EXECUTION_PROGRESS_CHANNEL,
  type ExecutionProgressEvent
} from "../../app/shared/types/execution-progress";
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
    expect(structures[0]!.key).toBe("belief-terrain-reality");
  });

  it("generates hooks for an idea and structure", () => {
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l'outil",
      pillarLabel: "Methodes"
    });

    const hooks = workshopService.generateHooks(idea.id, "expertise", "belief-terrain-reality");

    expect(hooks.length).toBeGreaterThan(0);
    expect(hooks[0]!.text).toContain("Le vrai probleme");
  });

  it("generates a final draft from all selections", () => {
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l'outil",
      pillarLabel: "Methodes"
    });

    const structures = workshopService.getSuggestedStructures(idea.id, "expertise", "awareness");
    const hooks = workshopService.generateHooks(idea.id, "expertise", structures[0]!.key);

    const session = workshopService.generateFinalDraft(
      idea.id,
      "expertise",
      "awareness",
      structures[0]!.key,
      structures[0]!.label,
      hooks[0]!.id,
      hooks[0]!.text,
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
    const hooks = service.generateHooks(idea.id, "expertise", structures[0]!.key);
    service.generateFinalDraft(
      idea.id,
      "expertise",
      "awareness",
      structures[0]!.key,
      structures[0]!.label,
      hooks[0]!.id,
      hooks[0]!.text,
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
      pillarDescription: "Comment arbitrer entre promesse, cout, risque et impact operationnel."
    });
    expect(writerContext?.strategyOffersSummary).toContain("Audit IA PME");
    expect(writerContext?.strategyIcpSummary).toContain("Dirigeants de PME");
    expect(writerContext?.voiceRules).toEqual([
      {
        category: "Anti-style",
        ruleType: "anti_style",
        ruleText: "Pas de hype, pas de jargon, pas de formule creuse."
      }
    ]);
  });
});

describe("ensureColumn (workshop schema helper)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.prepare(
      `CREATE TABLE drafts (
        id TEXT PRIMARY KEY,
        idea_id TEXT NOT NULL,
        headline TEXT NOT NULL,
        body_markdown TEXT NOT NULL,
        quality_score REAL NOT NULL,
        created_at TEXT NOT NULL
      )`
    ).run();
    db.prepare(
      `CREATE TABLE execution_runs (
        id TEXT PRIMARY KEY,
        idea_id TEXT NOT NULL,
        draft_id TEXT NOT NULL,
        skill_name TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    ).run();
  });

  afterEach(() => {
    db.close();
  });

  it("accepts a whitelisted column key and adds the column idempotently", () => {
    expect(() => ensureColumn(db, "drafts.status")).not.toThrow();

    const columns = db
      .prepare("PRAGMA table_info(drafts)")
      .all() as Array<{ name: string }>;
    expect(columns.some((c) => c.name === "status")).toBe(true);
  });

  it("is idempotent: calling it twice with the same whitelisted key does not throw", () => {
    ensureColumn(db, "drafts.status");
    expect(() => ensureColumn(db, "drafts.status")).not.toThrow();
  });

  it("rejects an unknown column key with a clear error", () => {
    expect(() => ensureColumn(db, "drafts.not_in_allowlist" as never)).toThrow(
      /not in the workshop column allowlist/i
    );
  });

  it("rejects a key whose table name is not a known workshop table", () => {
    expect(() => ensureColumn(db, "random_table.some_column" as never)).toThrow(
      /not in the workshop column allowlist/i
    );
  });

  it("exposes an allowlist that covers both drafts and execution_runs columns", () => {
    const keys = Object.keys(WORKSHOP_COLUMN_ALLOWLIST);
    expect(keys).toContain("drafts.status");
    expect(keys).toContain("drafts.source_draft_id");
    expect(keys).toContain("drafts.typology");
    expect(keys).toContain("drafts.objective");
    expect(keys).toContain("drafts.structure_key");
    expect(keys).toContain("drafts.structure_label");
    expect(keys).toContain("drafts.selected_hook_text");
    expect(keys).toContain("execution_runs.skill_version");
    expect(keys).toContain("execution_runs.input_json");
    expect(keys).toContain("execution_runs.output_json");
    expect(keys).toContain("execution_runs.output_markdown");
    expect(keys).toContain("execution_runs.error_message");
    expect(keys).toContain("execution_runs.log_path");
    expect(keys).toContain("execution_runs.started_at");
    expect(keys).toContain("execution_runs.finished_at");
  });
});

describe("runPhase progress emission (finding revue Codex)", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    ideasRepository = new IdeasRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  /**
   * Faux `WebContents` qui capture les evenements `execution:progress` emis,
   * sans dependre d'Electron. Suffisant pour observer la borne terminale.
   */
  function makeFakeSender() {
    const events: ExecutionProgressEvent[] = [];
    const sender = {
      isDestroyed: () => false,
      send: (channel: string, event: ExecutionProgressEvent) => {
        if (channel === EXECUTION_PROGRESS_CHANNEL) {
          events.push(event);
        }
      }
    };
    return { sender, events };
  }

  /**
   * Construit un service dont le runner renvoie le `status` fourni pour la
   * skill structure-selector (le reste delegue au fake strict).
   */
  function makeServiceWithStatus(status: "succeeded" | "partial" | "failed") {
    const strict = createStrictSkillRunnerService();
    const skillRunner = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: (invocation) => {
          if (invocation.skillName === "linkedin-structure-selector") {
            if (status === "succeeded") {
              return strict.execute(invocation);
            }
            return {
              status,
              summary: `structure-selector ${status}`,
              error:
                status === "failed"
                  ? { code: "CODEX_CLI_FAILED", message: "echec moteur" }
                  : undefined
            };
          }
          return strict.execute(invocation);
        }
      }
    });
    return new WorkshopService(
      db,
      ideasRepository,
      () => createStrategyBundleFixture(),
      undefined,
      skillRunner
    );
  }

  it("emet `completed` quand le statut est succeeded", () => {
    const service = makeServiceWithStatus("succeeded");
    const { sender, events } = makeFakeSender();
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l'outil",
      pillarLabel: "Methodes"
    });

    service.getSuggestedStructures(
      idea.id,
      "expertise",
      "awareness",
      sender as never
    );

    const terminal = events.find((e) => e.status === "completed" || e.status === "failed");
    expect(terminal?.status).toBe("completed");
    expect(terminal?.phase).toBe("structure");
  });

  it("emet `failed` (pas `completed`) quand le statut est partial", () => {
    const service = makeServiceWithStatus("partial");
    const { sender, events } = makeFakeSender();
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l'outil",
      pillarLabel: "Methodes"
    });

    // L'appelant throw sur tout statut != succeeded : on capture pour ne pas
    // masquer l'assertion sur l'evenement emis AVANT le throw.
    expect(() =>
      service.getSuggestedStructures(idea.id, "expertise", "awareness", sender as never)
    ).toThrow();

    // Aucun faux signal de succes : la borne terminale doit etre `failed`.
    const completed = events.filter((e) => e.status === "completed");
    expect(completed).toHaveLength(0);
    const terminal = events.find((e) => e.status === "failed");
    expect(terminal?.status).toBe("failed");
    expect(terminal?.phase).toBe("structure");
  });

  it("emet `failed` avec l'errorCode quand le statut est failed", () => {
    const service = makeServiceWithStatus("failed");
    const { sender, events } = makeFakeSender();
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l'outil",
      pillarLabel: "Methodes"
    });

    expect(() =>
      service.getSuggestedStructures(idea.id, "expertise", "awareness", sender as never)
    ).toThrow();

    const terminal = events.find((e) => e.status === "failed");
    expect(terminal?.status).toBe("failed");
    expect(terminal?.errorCode).toBe("CODEX_CLI_FAILED");
  });
});

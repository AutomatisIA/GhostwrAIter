import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
import { ExecutionService } from "../../app/main/domains/execution/execution.service";
import { SkillRegistryService } from "../../app/main/domains/execution/skill-registry.service";
import {
  createStrategyBundleFixture,
  createStrictSkillRunnerService
} from "./helpers/fake-codex";

describe("execution service", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let workshopService: WorkshopService;
  let executionService: ExecutionService;
  let executionLogsDirectory: string;
  let skillsDirectory: string;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    ideasRepository = new IdeasRepository(db);
    executionLogsDirectory = mkdtempSync(join(tmpdir(), "linkedin-poster-execution-"));
    skillsDirectory = join(process.cwd(), "skills");
    const skillRunnerService = createStrictSkillRunnerService();
    workshopService = new WorkshopService(
      db,
      ideasRepository,
      () => createStrategyBundleFixture(),
      executionLogsDirectory,
      skillRunnerService
    );
    executionService = new ExecutionService(
      db,
      () => true,
      new SkillRegistryService(skillsDirectory),
      skillRunnerService
    );
  });

  afterEach(() => {
    db.close();
    rmSync(executionLogsDirectory, { recursive: true, force: true });
  });

  it("lists execution runs from the workshop in reverse chronological order", () => {
    const idea = ideasRepository.createIdea({
      title: "Pourquoi il faut cadrer l'IA",
      angle: "Le process avant le prompt",
      pillarLabel: "Methodes"
    });

    const generated = workshopService.generateDraftFromIdea(idea.id);
    workshopService.correctDraft(generated.draft.id);

    const runs = executionService.listRuns();

    expect(runs).toHaveLength(4);
    expect(runs[0]?.skillName).toBe("linkedin-post-editor");
    expect(runs[1]?.skillName).toBe("linkedin-post-writer");
    expect(runs.some((run) => run.skillName === "linkedin-hook-engine")).toBe(true);
    expect(runs.some((run) => run.skillName === "linkedin-structure-selector")).toBe(true);
  });

  it("returns runner diagnostics", async () => {
    const diagnostics = await executionService.getDiagnostics();

    expect(diagnostics.activeEngine).toBeDefined();
    expect(diagnostics.engines).toBeDefined();
    expect(diagnostics.message).toBeTruthy();
    expect(diagnostics.availableSkills).toContain("linkedin-post-writer");
  });

  it("writes readable execution logs on disk for each skill run", () => {
    const idea = ideasRepository.createIdea({
      title: "Pourquoi il faut cadrer l'IA",
      angle: "Le process avant le prompt",
      pillarLabel: "Methodes"
    });

    const generated = workshopService.generateDraftFromIdea(idea.id);
    workshopService.correctDraft(generated.draft.id);

    const files = readdirSync(executionLogsDirectory);

    expect(files.length).toBe(4);

    const firstLog = JSON.parse(
      readFileSync(join(executionLogsDirectory, files[0] ?? ""), "utf8")
    ) as {
      invocation: { skillName: string };
      result: { status: string };
    };

    expect(firstLog.invocation.skillName).toBeTruthy();
    expect(firstLog.result.status).toBe("succeeded");
  });
});

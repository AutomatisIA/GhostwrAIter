import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createIdeasTables,
  IdeasRepository
} from "../../app/main/domains/ideas/ideas.repository";
import {
  createWorkshopTables
} from "../../app/main/domains/workshop/workshop.service";
import { NewsToPostService } from "../../app/main/domains/news/news-to-post.service";
import {
  createStrategyBundleFixture,
  createStrictSkillRunnerService
} from "./helpers/fake-codex";

describe("news to post service", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let newsToPostService: NewsToPostService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    ideasRepository = new IdeasRepository(db);
    newsToPostService = new NewsToPostService(
      db,
      ideasRepository,
      createStrictSkillRunnerService(),
      () => createStrategyBundleFixture()
    );
  });

  afterEach(() => {
    db.close();
  });

  it("creates an idea and draft from a pasted news source", () => {
    const result = newsToPostService.createDraftFromSource({
      sourceTitle: "Une PME industrialise ses copilotes IA",
      sourceSummary:
        "Le sujet central est l'adoption terrain et la priorisation des cas d'usage."
    });

    expect(result.idea.title).toContain("copilotes IA");
    expect(result.draft.headline).toContain("copilotes IA");
    expect(result.run.skillName).toBe("linkedin-news-to-post");
  });

  it("réussit quand le skill ne renvoie pas de hooks (contrat reel news-to-post)", () => {
    // Regression (bug revele par l eval, fixtures B) : le skill news-to-post
    // renvoie {data:{draft, qualitySignals}} SANS hooks. Le service ne doit pas
    // planter sur l iteration d un `hooks` absent.
    const hooklessRunner = {
      execute: () => ({
        status: "succeeded",
        summary: "ok",
        data: {
          draft: { headline: "Titre veille", bodyMarkdown: "Corps de veille." },
          qualitySignals: { clarity: 0.82, specificity: 0.8, antiHypeAlignment: 0.85 }
          // pas de cle `hooks` : exactement la forme reelle du skill
        }
      })
    } as unknown as ReturnType<typeof createStrictSkillRunnerService>;

    const service = new NewsToPostService(
      db,
      ideasRepository,
      hooklessRunner,
      () => createStrategyBundleFixture()
    );

    const result = service.createDraftFromSource({
      sourceTitle: "Source sans hooks",
      sourceSummary: "Resume suffisant pour une generation."
    });

    expect(result.draft.headline).toBe("Titre veille");
    expect(result.hooks).toEqual([]);
    expect(result.run.skillName).toBe("linkedin-news-to-post");
  });
});

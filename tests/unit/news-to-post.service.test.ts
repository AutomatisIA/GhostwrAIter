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

describe("news to post service", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let newsToPostService: NewsToPostService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    ideasRepository = new IdeasRepository(db);
    newsToPostService = new NewsToPostService(db, ideasRepository);
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
});

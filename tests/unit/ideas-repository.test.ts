import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createIdeasTables,
  IdeasRepository
} from "../../app/main/domains/ideas/ideas.repository";

describe("ideas repository", () => {
  let db: Database.Database;
  let repository: IdeasRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    repository = new IdeasRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates and lists ideas in reverse chronological order", () => {
    repository.createIdea({
      title: "Pourquoi les PME ratent l'adoption IA",
      angle: "Le probleme est organisationnel avant d'etre technique",
      pillarLabel: "Adoption IA"
    });
    repository.createIdea({
      title: "Les 3 cas d'usage IA a prioriser",
      angle: "Mieux vaut 3 vrais usages que 20 idees vagues",
      pillarLabel: "ROI"
    });

    const ideas = repository.listIdeas();

    expect(ideas).toHaveLength(2);
    expect(ideas[0]?.title).toContain("3 cas d'usage");
    expect(ideas[1]?.pillarLabel).toBe("Adoption IA");
  });
});

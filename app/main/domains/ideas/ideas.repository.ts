import Database from "better-sqlite3";
import type { IdeaInput, IdeaRecord } from "../../../shared/types/ideas";
import { createId } from "../../shared/create-id";

export function createIdeasTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      angle TEXT NOT NULL,
      pillar_label TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export class IdeasRepository {
  constructor(private readonly db: Database.Database) {}

  createIdea(input: IdeaInput): IdeaRecord {
    const record: IdeaRecord = {
      id: createId("idea"),
      title: input.title,
      angle: input.angle,
      pillarLabel: input.pillarLabel,
      createdAt: new Date().toISOString()
    };

    this.db
      .prepare(`
        INSERT INTO ideas (id, title, angle, pillar_label, created_at)
        VALUES (@id, @title, @angle, @pillarLabel, @createdAt)
      `)
      .run(record);

    return record;
  }

  listIdeas(): IdeaRecord[] {
    return this.db
      .prepare(`
        SELECT
          id,
          title,
          angle,
          pillar_label AS pillarLabel,
          created_at AS createdAt
        FROM ideas
        ORDER BY rowid DESC
      `)
      .all() as IdeaRecord[];
  }

  getIdeaById(id: string): IdeaRecord {
    const idea = this.db
      .prepare(`
        SELECT
          id,
          title,
          angle,
          pillar_label AS pillarLabel,
          created_at AS createdAt
        FROM ideas
        WHERE id = ?
      `)
      .get(id) as IdeaRecord | undefined;

    if (!idea) {
      throw new Error(`Idea not found: ${id}`);
    }

    return idea;
  }
}

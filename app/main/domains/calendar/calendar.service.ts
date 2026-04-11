import Database from "better-sqlite3";
import type { CalendarItem, ScheduleDraftInput } from "../../../shared/types/calendar";

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export class CalendarService {
  constructor(private readonly db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calendar_items (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL,
        planned_date TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);
  }

  scheduleDraft(input: ScheduleDraftInput): CalendarItem {
    const id = createId("cal");
    this.db
      .prepare(`
        INSERT INTO calendar_items (id, draft_id, planned_date, status)
        VALUES (@id, @draftId, @plannedDate, @status)
      `)
      .run({
        id,
        draftId: input.draftId,
        plannedDate: input.plannedDate,
        status: input.status
      });

    const item = this.listItems().find((i) => i.id === id);
    if (!item) {
      throw new Error("Failed to reload scheduled item");
    }
    return item;
  }

  listItems(): CalendarItem[] {
    return this.db
      .prepare(`
        SELECT
          c.id,
          c.draft_id AS draftId,
          d.headline AS draftHeadline,
          i.pillar_label AS pillarLabel,
          c.planned_date AS plannedDate,
          c.status
        FROM calendar_items c
        INNER JOIN drafts d ON d.id = c.draft_id
        INNER JOIN ideas i ON i.id = d.idea_id
        ORDER BY c.planned_date ASC, c.rowid DESC
      `)
      .all() as CalendarItem[];
  }
}

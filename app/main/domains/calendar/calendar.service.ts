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
    const item: CalendarItem = {
      id: createId("cal"),
      draftId: input.draftId,
      plannedDate: input.plannedDate,
      status: input.status
    };

    this.db
      .prepare(`
        INSERT INTO calendar_items (id, draft_id, planned_date, status)
        VALUES (@id, @draftId, @plannedDate, @status)
      `)
      .run(item);

    return item;
  }

  listItems(): CalendarItem[] {
    return this.db
      .prepare(`
        SELECT
          id,
          draft_id AS draftId,
          planned_date AS plannedDate,
          status
        FROM calendar_items
        ORDER BY planned_date ASC, rowid DESC
      `)
      .all() as CalendarItem[];
  }
}

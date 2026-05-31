export type CalendarItem = {
  id: string;
  draftId: string;
  draftHeadline: string;
  pillarLabel: string;
  plannedDate: string;
  status: "planned" | "ready" | "published" | "missed";
};

// Re-exported from the zod schema in app/shared/schemas/calendar.ts which
// is now the single source of truth for the schedule-draft input shape
// (feature 003).
import type { ScheduleDraftInput } from "../schemas/calendar";
export type { ScheduleDraftInput };

export type CalendarApi = {
  listItems: () => Promise<CalendarItem[]>;
  scheduleDraft: (input: ScheduleDraftInput) => Promise<CalendarItem>;
};

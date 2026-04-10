export type CalendarItem = {
  id: string;
  draftId: string;
  plannedDate: string;
  status: "planned" | "ready" | "published" | "missed";
};

export type ScheduleDraftInput = {
  draftId: string;
  plannedDate: string;
  status: CalendarItem["status"];
};

export type CalendarApi = {
  listItems: () => Promise<CalendarItem[]>;
  scheduleDraft: (input: ScheduleDraftInput) => Promise<CalendarItem>;
};

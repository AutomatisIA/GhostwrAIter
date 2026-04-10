import Database from "better-sqlite3";
import { CalendarService } from "../domains/calendar/calendar.service";
import type { ScheduleDraftInput } from "../../shared/types/calendar";

type IpcRegistrar = {
  handle: (
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
};

export class CalendarRuntimeService {
  private readonly service: CalendarService;

  constructor(db: Database.Database) {
    this.service = new CalendarService(db);
  }

  listItems() {
    return this.service.listItems();
  }

  scheduleDraft(input: ScheduleDraftInput) {
    return this.service.scheduleDraft(input);
  }
}

export function registerCalendarIpcHandlers(
  ipcRegistrar: IpcRegistrar,
  calendarService: CalendarRuntimeService
) {
  ipcRegistrar.handle("calendar:list-items", async () => calendarService.listItems());
  ipcRegistrar.handle("calendar:schedule-draft", async (_event, payload) =>
    calendarService.scheduleDraft(payload as ScheduleDraftInput)
  );
}

import Database from "better-sqlite3";
import { CalendarService } from "../domains/calendar/calendar.service";
import {
  emptyInputSchema,
  scheduleDraftInputSchema,
  type ScheduleDraftInput
} from "../../shared/schemas/calendar";
import {
  registerValidatedHandler,
  type IpcRegistrar
} from "./register-validated-handler";

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
  registerValidatedHandler(ipcRegistrar, "calendar:list-items", emptyInputSchema, () =>
    calendarService.listItems()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "calendar:schedule-draft",
    scheduleDraftInputSchema,
    (input) => calendarService.scheduleDraft(input)
  );
}

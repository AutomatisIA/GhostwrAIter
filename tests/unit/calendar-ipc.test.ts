import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CalendarRuntimeService,
  registerCalendarIpcHandlers
} from "../../app/main/ipc/calendar-ipc";
import type { IpcResult } from "../../app/main/ipc/register-validated-handler";
import type { CalendarItem } from "../../app/shared/types/calendar";
import { createIdeasTables } from "../../app/main/domains/ideas/ideas.repository";
import { createWorkshopTables } from "../../app/main/domains/workshop/workshop.service";

type CapturedHandler = (
  event: unknown,
  ...args: unknown[]
) => unknown | Promise<unknown>;

function createHarness() {
  const handlers = new Map<string, CapturedHandler>();
  const registrar = {
    handle(channel: string, handler: CapturedHandler) {
      handlers.set(channel, handler);
    }
  };
  return { handlers, registrar };
}

describe("calendar IPC", () => {
  let db: Database.Database;
  let service: CalendarRuntimeService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    service = new CalendarRuntimeService(db);
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  describe("calendar:list-items", () => {
    it("returns the list in an ok envelope", async () => {
      const { handlers, registrar } = createHarness();
      registerCalendarIpcHandlers(registrar, service);

      const result = (await handlers.get("calendar:list-items")?.(undefined)) as IpcResult<
        CalendarItem[]
      >;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.data)).toBe(true);
      }
    });

    it("rejects a non-undefined payload with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerCalendarIpcHandlers(registrar, service);

      const result = (await handlers.get("calendar:list-items")?.(undefined, {
        intruder: true
      })) as IpcResult<CalendarItem[]>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });
  });

  describe("calendar:schedule-draft", () => {
    const validPayload = {
      draftId: "draft_abc",
      plannedDate: "2026-04-20",
      status: "planned" as const
    };

    it("rejects a missing required field with IPC_INPUT_INVALID naming the field", async () => {
      const { handlers, registrar } = createHarness();
      registerCalendarIpcHandlers(registrar, service);

      const result = (await handlers.get("calendar:schedule-draft")?.(undefined, {
        plannedDate: validPayload.plannedDate,
        status: validPayload.status
      })) as IpcResult<CalendarItem>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("draftId");
      }
    });

    it("rejects a wrong-type plannedDate (number) with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerCalendarIpcHandlers(registrar, service);

      const result = (await handlers.get("calendar:schedule-draft")?.(undefined, {
        draftId: "draft_abc",
        plannedDate: 20260420,
        status: "planned"
      })) as IpcResult<CalendarItem>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("plannedDate");
      }
    });

    it("rejects an invalid plannedDate string with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerCalendarIpcHandlers(registrar, service);

      const result = (await handlers.get("calendar:schedule-draft")?.(undefined, {
        draftId: "draft_abc",
        plannedDate: "not a date",
        status: "planned"
      })) as IpcResult<CalendarItem>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("plannedDate");
      }
    });

    it("rejects an unknown status with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerCalendarIpcHandlers(registrar, service);

      const result = (await handlers.get("calendar:schedule-draft")?.(undefined, {
        draftId: "draft_abc",
        plannedDate: "2026-04-20",
        status: "archived"
      })) as IpcResult<CalendarItem>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("status");
      }
    });

    it("returns IPC_HANDLER_ERROR when the service throws", async () => {
      const { handlers, registrar } = createHarness();
      registerCalendarIpcHandlers(registrar, service);

      vi.spyOn(service, "scheduleDraft").mockImplementation(() => {
        throw new Error("simulated service failure");
      });

      const result = (await handlers.get("calendar:schedule-draft")?.(
        undefined,
        validPayload
      )) as IpcResult<CalendarItem>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_HANDLER_ERROR");
        expect(result.error.message).toContain("simulated service failure");
      }
    });
  });
});

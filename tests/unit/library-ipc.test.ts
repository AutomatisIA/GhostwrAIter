import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LibraryRuntimeService,
  registerLibraryIpcHandlers
} from "../../app/main/ipc/library-ipc";
import type { IpcResult } from "../../app/main/ipc/register-validated-handler";
import type { LibraryEntry } from "../../app/shared/types/library";
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

describe("library IPC", () => {
  let db: Database.Database;
  let service: LibraryRuntimeService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    service = new LibraryRuntimeService(db);
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  describe("library:list-entries", () => {
    it("returns the list in an ok envelope", async () => {
      const { handlers, registrar } = createHarness();
      registerLibraryIpcHandlers(registrar, service);

      const result = (await handlers.get("library:list-entries")?.(undefined)) as IpcResult<
        LibraryEntry[]
      >;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.data)).toBe(true);
      }
    });

    it("rejects a non-undefined payload with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerLibraryIpcHandlers(registrar, service);

      const result = (await handlers.get("library:list-entries")?.(undefined, {
        extra: true
      })) as IpcResult<LibraryEntry[]>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });
  });

  describe("library:search-entries", () => {
    it("accepts an empty filter object and returns an ok envelope", async () => {
      const { handlers, registrar } = createHarness();
      registerLibraryIpcHandlers(registrar, service);

      const result = (await handlers.get("library:search-entries")?.(
        undefined,
        {}
      )) as IpcResult<LibraryEntry[]>;

      expect(result.ok).toBe(true);
    });

    it("accepts a partial filter (query only)", async () => {
      const { handlers, registrar } = createHarness();
      registerLibraryIpcHandlers(registrar, service);

      const result = (await handlers.get("library:search-entries")?.(undefined, {
        query: "IA"
      })) as IpcResult<LibraryEntry[]>;

      expect(result.ok).toBe(true);
    });

    it("rejects a filter with a wrong-type field (query as number)", async () => {
      const { handlers, registrar } = createHarness();
      registerLibraryIpcHandlers(registrar, service);

      const result = (await handlers.get("library:search-entries")?.(undefined, {
        query: 42
      })) as IpcResult<LibraryEntry[]>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("query");
      }
    });

    it("rejects an unknown status with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerLibraryIpcHandlers(registrar, service);

      const result = (await handlers.get("library:search-entries")?.(undefined, {
        status: "archived"
      })) as IpcResult<LibraryEntry[]>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("status");
      }
    });
  });

  describe("library:create-variant-from-draft", () => {
    it("rejects an empty string draftId with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerLibraryIpcHandlers(registrar, service);

      const result = (await handlers.get("library:create-variant-from-draft")?.(
        undefined,
        ""
      )) as IpcResult<LibraryEntry>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });

    it("rejects a non-string draftId with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerLibraryIpcHandlers(registrar, service);

      const result = (await handlers.get("library:create-variant-from-draft")?.(
        undefined,
        42
      )) as IpcResult<LibraryEntry>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });

    it("returns IPC_HANDLER_ERROR when the service throws (e.g., draft not found)", async () => {
      const { handlers, registrar } = createHarness();
      registerLibraryIpcHandlers(registrar, service);

      const result = (await handlers.get("library:create-variant-from-draft")?.(
        undefined,
        "draft_does_not_exist"
      )) as IpcResult<LibraryEntry>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_HANDLER_ERROR");
      }
    });
  });
});

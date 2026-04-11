import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SettingsRuntimeService,
  registerSettingsIpcHandlers
} from "../../app/main/ipc/settings-ipc";
import type { IpcResult } from "../../app/main/ipc/register-validated-handler";

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

function createFakeSettingsService(): SettingsRuntimeService {
  return {
    exportWorkspace: vi.fn().mockResolvedValue({ path: "/tmp/export.json" }),
    purgeExecutionLogs: vi.fn().mockResolvedValue({ removedCount: 3 })
  } as unknown as SettingsRuntimeService;
}

describe("settings IPC", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("settings:export-workspace", () => {
    it("returns the export result wrapped in an ok envelope", async () => {
      const { handlers, registrar } = createHarness();
      const service = createFakeSettingsService();
      registerSettingsIpcHandlers(registrar, service);

      const result = (await handlers.get("settings:export-workspace")?.(
        undefined
      )) as IpcResult<{ path: string }>;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.path).toBe("/tmp/export.json");
      }
      expect(service.exportWorkspace).toHaveBeenCalledTimes(1);
    });

    it("rejects a non-undefined payload with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      const service = createFakeSettingsService();
      registerSettingsIpcHandlers(registrar, service);

      const result = (await handlers.get("settings:export-workspace")?.(undefined, {
        shouldNot: "be here"
      })) as IpcResult<{ path: string }>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
      expect(service.exportWorkspace).not.toHaveBeenCalled();
    });

    it("returns IPC_HANDLER_ERROR when the service throws", async () => {
      const { handlers, registrar } = createHarness();
      const service = createFakeSettingsService();
      vi.mocked(service.exportWorkspace).mockRejectedValue(
        new Error("disk full")
      );
      registerSettingsIpcHandlers(registrar, service);

      const result = (await handlers.get("settings:export-workspace")?.(
        undefined
      )) as IpcResult<{ path: string }>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_HANDLER_ERROR");
        expect(result.error.message).toContain("disk full");
      }
    });
  });

  describe("settings:purge-execution-logs", () => {
    it("returns the purge result wrapped in an ok envelope", async () => {
      const { handlers, registrar } = createHarness();
      const service = createFakeSettingsService();
      registerSettingsIpcHandlers(registrar, service);

      const result = (await handlers.get("settings:purge-execution-logs")?.(
        undefined
      )) as IpcResult<{ removedCount: number }>;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.removedCount).toBe(3);
      }
    });

    it("rejects a non-undefined payload with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      const service = createFakeSettingsService();
      registerSettingsIpcHandlers(registrar, service);

      const result = (await handlers.get("settings:purge-execution-logs")?.(
        undefined,
        "not-undefined"
      )) as IpcResult<{ removedCount: number }>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });
  });
});

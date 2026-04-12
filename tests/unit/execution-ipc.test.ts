import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExecutionRuntimeService,
  registerExecutionIpcHandlers
} from "../../app/main/ipc/execution-ipc";
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

function createFakeExecutionService(): ExecutionRuntimeService {
  return {
    listRuns: vi.fn().mockReturnValue([
      { id: "run_1", skillName: "linkedin-hook-engine", status: "succeeded" }
    ]),
    getDiagnostics: vi.fn().mockReturnValue({
      activeEngine: "codex",
      engines: [],
      availableSkills: ["linkedin-post-writer"],
      message: "ok"
    })
  } as unknown as ExecutionRuntimeService;
}

describe("execution IPC", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("execution:list-runs", () => {
    it("returns the list of runs in an ok envelope", async () => {
      const { handlers, registrar } = createHarness();
      const service = createFakeExecutionService();
      registerExecutionIpcHandlers(registrar, service);

      const result = (await handlers.get("execution:list-runs")?.(
        undefined
      )) as IpcResult<Array<{ id: string }>>;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.id).toBe("run_1");
      }
    });

    it("rejects a non-undefined payload with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      const service = createFakeExecutionService();
      registerExecutionIpcHandlers(registrar, service);

      const result = (await handlers.get("execution:list-runs")?.(undefined, {
        extra: true
      })) as IpcResult<Array<{ id: string }>>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
      expect(service.listRuns).not.toHaveBeenCalled();
    });

    it("returns IPC_HANDLER_ERROR when the service throws", async () => {
      const { handlers, registrar } = createHarness();
      const service = createFakeExecutionService();
      vi.mocked(service.listRuns).mockImplementation(() => {
        throw new Error("database offline");
      });
      registerExecutionIpcHandlers(registrar, service);

      const result = (await handlers.get("execution:list-runs")?.(
        undefined
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_HANDLER_ERROR");
        expect(result.error.message).toContain("database offline");
      }
    });
  });

  describe("execution:get-diagnostics", () => {
    it("returns diagnostics in an ok envelope", async () => {
      const { handlers, registrar } = createHarness();
      const service = createFakeExecutionService();
      registerExecutionIpcHandlers(registrar, service);

      const result = (await handlers.get("execution:get-diagnostics")?.(
        undefined
      )) as IpcResult<{ activeEngine: string; engines: unknown[] }>;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.activeEngine).toBe("codex");
        expect(result.data.engines).toBeDefined();
      }
    });

    it("rejects a non-undefined payload with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      const service = createFakeExecutionService();
      registerExecutionIpcHandlers(registrar, service);

      const result = (await handlers.get("execution:get-diagnostics")?.(
        undefined,
        "junk"
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });
  });
});

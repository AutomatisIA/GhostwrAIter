import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExecutionRuntimeService,
  registerExecutionIpcHandlers
} from "../../app/main/ipc/execution-ipc";
import type { IpcResult } from "../../app/main/ipc/register-validated-handler";
import { SkillRunError } from "../../app/main/domains/execution/skill-run-error";

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

  /**
   * Codes d erreur moteur preserves jusqu au renderer.
   *
   * `classifyThrown` n a qu une source de verite : la table alimentee par
   * `registerKnownErrorCode`. Un code absent de cette table est ecrase en
   * `IPC_HANDLER_ERROR: "Unexpected handler error: ..."`, et un probleme
   * reessayable s affiche en erreur interne generique. Le test passe par le
   * vrai chemin (handler qui throw -> enveloppe), pas par une lecture de table.
   */
  describe("codes d'erreur du runner de skills", () => {
    const RUNNER_ERROR_CODES = [
      "ENGINE_NOT_AUTHENTICATED",
      "ENGINE_NOT_REGISTERED",
      "ENGINE_RESOLUTION_FAILED",
      "ENGINE_UNAVAILABLE",
      "ENGINE_INVALID_JSON",
      "ENGINE_INVALID_CONTRACT",
      "ENGINE_EXECUTION_ERROR",
      "SKILL_PROMPT_NOT_FOUND",
      "FRAMEWORK_PROMPT_NOT_FOUND",
      "SKILL_RUN_FAILED"
    ] as const;

    it.each(RUNNER_ERROR_CODES)(
      "preserve %s au lieu de l'ecraser en IPC_HANDLER_ERROR",
      async (code) => {
        const { handlers, registrar } = createHarness();
        const service = createFakeExecutionService();
        vi.mocked(service.listRuns).mockImplementation(() => {
          throw new SkillRunError(code, "le moteur a renvoye une sortie illisible");
        });
        registerExecutionIpcHandlers(registrar, service);

        const result = (await handlers.get("execution:list-runs")?.(
          undefined
        )) as IpcResult<unknown>;

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe(code);
          // Le message d origine survit : c est lui qui rend l erreur
          // actionnable cote utilisateur.
          expect(result.error.message).toBe("le moteur a renvoye une sortie illisible");
          expect(result.error.message).not.toContain("Unexpected handler error");
        }
      }
    );
  });
});

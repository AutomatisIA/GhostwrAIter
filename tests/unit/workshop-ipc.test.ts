import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WorkshopRuntimeService,
  registerWorkshopIpcHandlers
} from "../../app/main/ipc/workshop-ipc";
import type { IpcResult } from "../../app/main/ipc/register-validated-handler";
import {
  createIdeasTables,
  IdeasRepository
} from "../../app/main/domains/ideas/ideas.repository";
import {
  createStrategyBundleFixture,
  createStrictSkillRunnerService
} from "./helpers/fake-codex";

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

describe("workshop IPC", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let service: WorkshopRuntimeService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    ideasRepository = new IdeasRepository(db);
    service = new WorkshopRuntimeService(
      db,
      ideasRepository,
      () => createStrategyBundleFixture(),
      undefined,
      createStrictSkillRunnerService()
    );
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  describe("workshop:get-session-by-idea-id (single input)", () => {
    it("returns null in an ok envelope for an unknown idea", async () => {
      const { handlers, registrar } = createHarness();
      registerWorkshopIpcHandlers(registrar, service);

      const result = (await handlers.get("workshop:get-session-by-idea-id")?.(
        undefined,
        "idea_nonexistent"
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeNull();
      }
    });

    it("rejects an empty-string ideaId with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerWorkshopIpcHandlers(registrar, service);

      const result = (await handlers.get("workshop:get-session-by-idea-id")?.(
        undefined,
        ""
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });

    it("rejects a non-string ideaId with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerWorkshopIpcHandlers(registrar, service);

      const result = (await handlers.get("workshop:get-session-by-idea-id")?.(
        undefined,
        42
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });
  });

  describe("workshop:get-suggested-structures (tuple of 3)", () => {
    it("accepts a valid (ideaId, typology, objective) tuple", async () => {
      const idea = ideasRepository.createIdea({
        title: "IA en PME",
        angle: "Le process avant l'outil",
        pillarLabel: "Methodes"
      });
      const { handlers, registrar } = createHarness();
      registerWorkshopIpcHandlers(registrar, service);

      const result = (await handlers.get("workshop:get-suggested-structures")?.(
        undefined,
        idea.id,
        "expertise",
        "awareness"
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(true);
    });

    it("rejects a tuple with too few arguments with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerWorkshopIpcHandlers(registrar, service);

      const result = (await handlers.get("workshop:get-suggested-structures")?.(
        undefined,
        "idea_abc",
        "expertise"
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });

    it("rejects an unknown typology with IPC_INPUT_INVALID at position [1]", async () => {
      const { handlers, registrar } = createHarness();
      registerWorkshopIpcHandlers(registrar, service);

      const result = (await handlers.get("workshop:get-suggested-structures")?.(
        undefined,
        "idea_abc",
        "unknown-typology",
        "awareness"
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toContain("1");
      }
    });
  });

  describe("workshop:generate-final-draft (tuple of 8)", () => {
    it("rejects a tuple with a wrong-type score inside the hooks array", async () => {
      const { handlers, registrar } = createHarness();
      registerWorkshopIpcHandlers(registrar, service);

      const result = (await handlers.get("workshop:generate-final-draft")?.(
        undefined,
        "idea_abc",
        "expertise",
        "awareness",
        "belief-terrain-reality",
        "Croyance -> terrain -> realite",
        "hook_option_0",
        "Le vrai probleme",
        [
          {
            id: "hook_option_0",
            family: "contrastive",
            text: "Le vrai probleme",
            score: 2.5
          }
        ]
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toContain("score");
      }
    });

    it("rejects a missing structureLabel (position 4) with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerWorkshopIpcHandlers(registrar, service);

      const result = (await handlers.get("workshop:generate-final-draft")?.(
        undefined,
        "idea_abc",
        "expertise",
        "awareness",
        "belief-terrain-reality",
        "",
        "hook_option_0",
        "Le vrai probleme",
        []
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });
  });

  describe("workshop:create-variant (tuple of 2)", () => {
    it("rejects a missing variantType with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerWorkshopIpcHandlers(registrar, service);

      const result = (await handlers.get("workshop:create-variant")?.(
        undefined,
        "draft_abc"
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });
  });

  describe("workshop:correct-draft handler error", () => {
    it("returns IPC_HANDLER_ERROR when the draft does not exist", async () => {
      const { handlers, registrar } = createHarness();
      registerWorkshopIpcHandlers(registrar, service);

      const result = (await handlers.get("workshop:correct-draft")?.(
        undefined,
        "draft_does_not_exist"
      )) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_HANDLER_ERROR");
      }
    });
  });
});

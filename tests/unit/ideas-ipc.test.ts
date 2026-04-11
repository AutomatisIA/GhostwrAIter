import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IdeasService,
  registerIdeasIpcHandlers
} from "../../app/main/ipc/ideas-ipc";
import type { IpcResult } from "../../app/main/ipc/register-validated-handler";
import type { IdeaRecord } from "../../app/shared/types/ideas";
import { createStrictSkillRunnerService } from "./helpers/fake-codex";

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

describe("ideas IPC", () => {
  let db: Database.Database;
  let service: IdeasService;

  beforeEach(() => {
    db = new Database(":memory:");
    service = new IdeasService(db, createStrictSkillRunnerService());
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  describe("ideas:list", () => {
    it("returns the list in an ok envelope", async () => {
      const { handlers, registrar } = createHarness();
      registerIdeasIpcHandlers(registrar, service);

      const result = (await handlers.get("ideas:list")?.(undefined)) as IpcResult<
        IdeaRecord[]
      >;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.data)).toBe(true);
      }
    });

    it("rejects a non-undefined payload with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerIdeasIpcHandlers(registrar, service);

      const result = (await handlers.get("ideas:list")?.(undefined, {
        extra: "data"
      })) as IpcResult<IdeaRecord[]>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });
  });

  describe("ideas:create", () => {
    const validIdea = {
      title: "Cadrer l'IA en PME",
      angle: "Le process d'abord, l'outil ensuite",
      pillarLabel: "Methodes"
    };

    it("creates an idea with a valid payload in an ok envelope", async () => {
      const { handlers, registrar } = createHarness();
      registerIdeasIpcHandlers(registrar, service);

      const result = (await handlers.get("ideas:create")?.(
        undefined,
        validIdea
      )) as IpcResult<IdeaRecord>;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.title).toBe(validIdea.title);
        expect(result.data.pillarLabel).toBe(validIdea.pillarLabel);
      }
    });

    it("rejects a missing title with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerIdeasIpcHandlers(registrar, service);

      const result = (await handlers.get("ideas:create")?.(undefined, {
        angle: validIdea.angle,
        pillarLabel: validIdea.pillarLabel
      })) as IpcResult<IdeaRecord>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("title");
      }
    });

    it("rejects a wrong-type pillarLabel (number) with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerIdeasIpcHandlers(registrar, service);

      const result = (await handlers.get("ideas:create")?.(undefined, {
        title: validIdea.title,
        angle: validIdea.angle,
        pillarLabel: 42
      })) as IpcResult<IdeaRecord>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("pillarLabel");
      }
    });

    it("rejects an empty-string title with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerIdeasIpcHandlers(registrar, service);

      const result = (await handlers.get("ideas:create")?.(undefined, {
        title: "",
        angle: validIdea.angle,
        pillarLabel: validIdea.pillarLabel
      })) as IpcResult<IdeaRecord>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("title");
      }
    });
  });

  describe("ideas:create-from-news-source", () => {
    const validSource = {
      sourceTitle: "OpenAI lance une capacite agentique",
      sourceSummary:
        "Une nouvelle API introduit des agents autonomes capables de naviguer le web et d'appeler des outils."
    };

    it("rejects a missing sourceTitle with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerIdeasIpcHandlers(registrar, service);

      const result = (await handlers.get("ideas:create-from-news-source")?.(undefined, {
        sourceSummary: validSource.sourceSummary
      })) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("sourceTitle");
      }
    });

    it("rejects a wrong-type sourceSummary with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerIdeasIpcHandlers(registrar, service);

      const result = (await handlers.get("ideas:create-from-news-source")?.(undefined, {
        sourceTitle: validSource.sourceTitle,
        sourceSummary: 42
      })) as IpcResult<unknown>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
        expect(result.error.field).toBe("sourceSummary");
      }
    });
  });

  describe("ideas:generate-from-strategy", () => {
    it("rejects a non-undefined payload with IPC_INPUT_INVALID", async () => {
      const { handlers, registrar } = createHarness();
      registerIdeasIpcHandlers(registrar, service);

      const result = (await handlers.get("ideas:generate-from-strategy")?.(undefined, {
        extra: true
      })) as IpcResult<IdeaRecord[]>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_INPUT_INVALID");
      }
    });

    it("returns IPC_HANDLER_ERROR when the service throws", async () => {
      const { handlers, registrar } = createHarness();
      registerIdeasIpcHandlers(registrar, service);

      vi.spyOn(service, "generateFromStrategy").mockImplementation(() => {
        throw new Error("simulated ideas generation failure");
      });

      const result = (await handlers.get("ideas:generate-from-strategy")?.(
        undefined
      )) as IpcResult<IdeaRecord[]>;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("IPC_HANDLER_ERROR");
        expect(result.error.message).toContain("simulated ideas generation failure");
      }
    });
  });
});

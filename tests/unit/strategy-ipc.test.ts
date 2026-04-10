import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  StrategyService,
  registerStrategyIpcHandlers
} from "../../app/main/ipc/strategy-ipc";

describe("strategy IPC", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("registers save and load handlers", () => {
    const handle = vi.fn();
    const service = new StrategyService(db);

    registerStrategyIpcHandlers({ handle }, service);

    expect(handle).toHaveBeenCalledTimes(2);
    expect(handle).toHaveBeenCalledWith(
      "strategy:get-active-bundle",
      expect.any(Function)
    );
    expect(handle).toHaveBeenCalledWith(
      "strategy:save-bundle",
      expect.any(Function)
    );
  });

  it("persists a strategy bundle through the handler and reloads it", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const service = new StrategyService(db);

    registerStrategyIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        }
      },
      service
    );

    const saveHandler = handlers.get("strategy:save-bundle");
    const getHandler = handlers.get("strategy:get-active-bundle");

    expect(saveHandler).toBeDefined();
    expect(getHandler).toBeDefined();

    await saveHandler?.(undefined, {
      profile: {
        name: "Philippe",
        positioning: "Consultant IA PME",
        bio: "Approche terrain",
        expertiseSummary: "ROI et adoption"
      },
      offers: [
        {
          name: "Offre coeur",
          promise: "Faire atterrir l'IA dans les process",
          problems: "Pas de cadre de decision"
        }
      ],
      icps: [],
      pillars: [{ label: "Adoption", position: 1 }],
      voiceRules: []
    });

    const result = await getHandler?.(undefined);

    expect(result).toMatchObject({
      profile: { name: "Philippe" },
      offers: [{ name: "Offre coeur" }],
      pillars: [{ label: "Adoption" }]
    });
  });
});

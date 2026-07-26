import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  StrategyService,
  registerStrategyIpcHandlers
} from "../../app/main/ipc/strategy-ipc";
import { createStrictSkillRunnerService } from "./helpers/fake-codex";
import { SkillRunnerService } from "../../app/main/domains/execution/skill-runner.service";
import type { IpcResult } from "../../app/main/ipc/register-validated-handler";

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

    expect(handle).toHaveBeenCalledTimes(3);
    expect(handle).toHaveBeenCalledWith(
      "strategy:get-active-bundle",
      expect.any(Function)
    );
    expect(handle).toHaveBeenCalledWith(
      "strategy:save-bundle",
      expect.any(Function)
    );
    expect(handle).toHaveBeenCalledWith(
      "strategy:generate-foundation",
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

    const result = (await getHandler?.(undefined)) as IpcResult<{
      profile: { name: string };
      offers: Array<{ name: string }>;
      pillars: Array<{ label: string }>;
    }>;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        profile: { name: "Philippe" },
        offers: [{ name: "Offre coeur" }],
        pillars: [{ label: "Adoption" }]
      });
    }
  });

  it("generates an editorial foundation summary from the active strategy", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const service = new StrategyService(db, createStrictSkillRunnerService());

    registerStrategyIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        }
      },
      service
    );

    await handlers.get("strategy:save-bundle")?.(undefined, {
      profile: {
        name: "Philippe",
        positioning: "Consultant IA PME",
        bio: "Approche terrain",
        expertiseSummary: "ROI et adoption"
      },
      offers: [{ name: "Offre coeur", promise: "Faire atterrir l'IA", problems: "Pas de cadre" }],
      icps: [{ segment: "Dirigeants PME", pains: "Temps, priorisation" }],
      pillars: [{ label: "Adoption", position: 1 }],
      voiceRules: [{ category: "anti-style", ruleText: "Pas de hype", ruleType: "anti_style" }]
    });

    const result = (await handlers.get("strategy:generate-foundation")?.(
      undefined
    )) as IpcResult<{ summaryMarkdown: string }>;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.summaryMarkdown).toContain("Consultant IA PME");
    }
  });

  it("rejects a save-bundle payload with a missing required field (IPC_INPUT_INVALID)", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const service = new StrategyService(db, createStrictSkillRunnerService());

    registerStrategyIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        }
      },
      service
    );

    const result = (await handlers.get("strategy:save-bundle")?.(undefined, {
      // profile is missing entirely
      offers: [],
      icps: [],
      pillars: [],
      voiceRules: []
    })) as IpcResult<unknown>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_INPUT_INVALID");
      expect(result.error.field).toBe("profile");
    }
  });

  it("rejects a save-bundle payload with a wrong-type positioning (IPC_INPUT_INVALID)", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const service = new StrategyService(db, createStrictSkillRunnerService());

    registerStrategyIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        }
      },
      service
    );

    const result = (await handlers.get("strategy:save-bundle")?.(undefined, {
      profile: {
        name: "Philippe",
        positioning: 42,
        bio: "",
        expertiseSummary: ""
      },
      offers: [],
      icps: [],
      pillars: [],
      voiceRules: []
    })) as IpcResult<unknown>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_INPUT_INVALID");
      expect(result.error.field).toContain("positioning");
    }
  });

  it("returns IPC_HANDLER_ERROR when the foundation skill runner throws", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const throwingRunner = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: () => {
          throw new Error("simulated skill runner failure");
        }
      }
    });
    const service = new StrategyService(db, throwingRunner);

    registerStrategyIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        }
      },
      service
    );

    await handlers.get("strategy:save-bundle")?.(undefined, {
      profile: {
        name: "Philippe",
        positioning: "Consultant IA PME",
        bio: "",
        expertiseSummary: ""
      },
      offers: [{ name: "Offre coeur", promise: "Promise", problems: "Problems" }],
      icps: [],
      pillars: [{ label: "Adoption", position: 1 }],
      voiceRules: []
    });

    const result = (await handlers.get("strategy:generate-foundation")?.(
      undefined
    )) as IpcResult<unknown>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_HANDLER_ERROR");
      expect(result.error.message).toContain("simulated skill runner failure");
    }
  });
});

/**
 * Ce que recoit l interface au tout premier lancement.
 *
 * Le handler renvoyait l erreur « No active strategy profile found » sur une
 * base neuve, et l ecran Creer l affichait telle quelle : « La strategie n a
 * pas pu etre lue ». Rien n avait echoue, il n y avait simplement rien encore.
 *
 * La porte est ici, au niveau du canal, parce que c est la que la distinction
 * se joue : le test du repository seul restait vert quand le handler appelait
 * la variante stricte.
 */
describe("strategy IPC, espace de travail vierge", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("repond une strategie vide plutot qu une erreur", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    registerStrategyIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        }
      },
      new StrategyService(db)
    );

    const resultat = (await handlers.get("strategy:get-active-bundle")?.(
      undefined
    )) as IpcResult<{
      profile: { name: string };
      offers: unknown[];
      icps: unknown[];
      pillars: unknown[];
      voiceRules: unknown[];
    }>;

    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    expect(resultat.data.profile.name).toBe("");
    expect(resultat.data.offers).toEqual([]);
    expect(resultat.data.icps).toEqual([]);
    expect(resultat.data.pillars).toEqual([]);
    expect(resultat.data.voiceRules).toEqual([]);
  });
});

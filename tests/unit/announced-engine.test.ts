import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetAnnouncedEngineMemo,
  resolveAnnouncedEngine
} from "../../app/main/domains/execution/announced-engine";
import type { EngineRegistry } from "../../app/main/domains/execution/engine-registry";
import type { SkillRunnerService } from "../../app/main/domains/execution/skill-runner.service";
import {
  createIdeasTables,
  IdeasRepository
} from "../../app/main/domains/ideas/ideas.repository";
import {
  createWorkshopTables,
  WorkshopService
} from "../../app/main/domains/workshop/workshop.service";
import {
  EXECUTION_PROGRESS_CHANNEL,
  type ExecutionProgressEvent
} from "../../app/shared/types/execution-progress";
import {
  createStrategyBundleFixture,
  createStrictSkillRunnerService
} from "./helpers/fake-codex";

/**
 * Le moteur ANNONCE par la borne `started` doit etre celui qui va reellement
 * travailler.
 *
 * Au premier lancement, aucun choix n est enregistre : la lecture de la seule
 * preference rendait `null`, le repli annoncait « Codex », et la resolution
 * active pouvait pourtant retenir Claude ou Antigravity. L utilisateur lisait
 * donc un moteur faux pendant toute la generation.
 *
 * Le second enjeu est le COUT : resoudre le moteur actif lance un controle
 * d authentification synchrone par moteur candidat. Le refaire avant chacune
 * des quatre etapes d une generation rendrait au processus principal les gels
 * que cette branche corrige par ailleurs. La derniere assertion de la premiere
 * section est donc une porte de cout, pas un detail.
 */
describe("moteur annonce", () => {
  beforeEach(() => {
    resetAnnouncedEngineMemo();
  });

  /** Registre dont la resolution active rend `claude`, comme au premier lancement. */
  function makeRegistry(engine = "claude") {
    const getActiveEngine = vi.fn(async () => ({
      engine,
      status: { installState: "authenticated" }
    }));
    return {
      registry: { getActiveEngine } as unknown as EngineRegistry,
      getActiveEngine
    };
  }

  it("annonce le moteur actif quand aucun choix n a ete enregistre", async () => {
    const { registry } = makeRegistry("claude");
    const runner = {
      getSelectedEngineName: () => null,
      getEngineRegistry: () => registry
    } as unknown as SkillRunnerService;

    // Le repli litteral rendait « codex » ici, alors que c est Claude qui
    // allait travailler.
    await expect(resolveAnnouncedEngine(runner)).resolves.toBe("claude");
  });

  it("respecte le choix explicite sans interroger le systeme", async () => {
    const { registry, getActiveEngine } = makeRegistry("claude");
    const runner = {
      getSelectedEngineName: () => "antigravity",
      getEngineRegistry: () => registry
    } as unknown as SkillRunnerService;

    await expect(resolveAnnouncedEngine(runner)).resolves.toBe("antigravity");
    // Cas courant des qu un utilisateur a ouvert les Parametres : le cout doit
    // rester celui d avant le correctif, c est-a-dire nul.
    expect(getActiveEngine).not.toHaveBeenCalled();
  });

  it("ne resout qu une seule fois pour les quatre etapes d une generation", async () => {
    const { registry, getActiveEngine } = makeRegistry("antigravity");
    const runner = {
      getSelectedEngineName: () => null,
      getEngineRegistry: () => registry
    } as unknown as SkillRunnerService;

    const annonces = [
      await resolveAnnouncedEngine(runner),
      await resolveAnnouncedEngine(runner),
      await resolveAnnouncedEngine(runner),
      await resolveAnnouncedEngine(runner)
    ];

    expect(annonces).toEqual([
      "antigravity",
      "antigravity",
      "antigravity",
      "antigravity"
    ]);
    // PORTE DE COUT. Chaque resolution vaut jusqu a un controle
    // d authentification synchrone par moteur. Quatre resolutions par
    // generation rendraient au processus principal les gels que cette branche
    // corrige.
    expect(getActiveEngine).toHaveBeenCalledTimes(1);
  });

  it("annonce codex quand le runner n a aucun registre", async () => {
    const runner = {
      getSelectedEngineName: () => null
    } as unknown as SkillRunnerService;

    // Sans registre, le runner execute sur Codex et estampille « codex » : le
    // defaut est alors le fait, pas un pis-aller.
    await expect(resolveAnnouncedEngine(runner)).resolves.toBe("codex");
  });

  it("ne fait pas echouer la generation quand la resolution leve", async () => {
    const registry = {
      getActiveEngine: vi.fn(async () => {
        throw new Error("base illisible");
      })
    } as unknown as EngineRegistry;
    const runner = {
      getSelectedEngineName: () => null,
      getEngineRegistry: () => registry
    } as unknown as SkillRunnerService;

    // Une annonce est un affichage : elle ne doit jamais propager son echec au
    // flux metier, exactement comme l emetteur de progression.
    await expect(resolveAnnouncedEngine(runner)).resolves.toBe("codex");
  });
});

describe("moteur annonce : borne started de l atelier", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;

  beforeEach(() => {
    resetAnnouncedEngineMemo();
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    ideasRepository = new IdeasRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  function makeFakeSender() {
    const events: ExecutionProgressEvent[] = [];
    const sender = {
      isDestroyed: () => false,
      send: (channel: string, event: ExecutionProgressEvent) => {
        if (channel === EXECUTION_PROGRESS_CHANNEL) {
          events.push(event);
        }
      }
    };
    return { sender, events };
  }

  it("emet started avec le moteur resolu, pas avec le repli litteral", async () => {
    const strict = createStrictSkillRunnerService();
    const getActiveEngine = vi.fn(async () => ({
      engine: "claude",
      status: { installState: "authenticated" }
    }));
    // Double au contrat complet du runner : `executeAsync` pour produire le
    // resultat, et les deux lectures de moteur que la borne `started` consulte.
    const runner = {
      executeAsync: async (invocation: Parameters<typeof strict.execute>[0]) => ({
        ...strict.execute(invocation),
        engine: "claude" as const
      }),
      getSelectedEngineName: () => null,
      getEngineRegistry: () => ({ getActiveEngine }) as unknown as EngineRegistry
    } as unknown as SkillRunnerService;

    const service = new WorkshopService(
      db,
      ideasRepository,
      () => createStrategyBundleFixture(),
      undefined,
      runner
    );
    const { sender, events } = makeFakeSender();
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l'outil",
      pillarLabel: "Methodes"
    });

    await service.getSuggestedStructures(
      idea.id,
      "expertise",
      "awareness",
      sender as never
    );

    const started = events.find((event) => event.status === "started");
    expect(started?.engine).toBe("claude");
    // La borne terminale portait deja le bon moteur : le defaut etait que
    // `started` mentait jusque-la.
    const terminal = events.find((event) => event.status === "completed");
    expect(terminal?.engine).toBe("claude");
  });
});

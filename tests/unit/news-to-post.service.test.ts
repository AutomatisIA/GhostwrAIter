import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createIdeasTables,
  IdeasRepository
} from "../../app/main/domains/ideas/ideas.repository";
import {
  createWorkshopTables,
  WorkshopService
} from "../../app/main/domains/workshop/workshop.service";
import { NewsToPostService } from "../../app/main/domains/news/news-to-post.service";
import type {
  SkillRunnerInvocation,
  SkillRunnerService
} from "../../app/main/domains/execution/skill-runner.service";
import { SkillRunError } from "../../app/main/domains/execution/skill-run-error";
import type { StrategyBundle } from "../../app/shared/types/strategy";
import {
  EXECUTION_PROGRESS_CHANNEL,
  type ExecutionProgressEvent
} from "../../app/shared/types/execution-progress";
import {
  createStrategyBundleFixture,
  createStrictSkillRunnerService
} from "./helpers/fake-codex";

describe("news to post service", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let newsToPostService: NewsToPostService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    ideasRepository = new IdeasRepository(db);
    newsToPostService = new NewsToPostService(
      db,
      ideasRepository,
      createStrictSkillRunnerService(),
      () => createStrategyBundleFixture()
    );
  });

  afterEach(() => {
    db.close();
  });

  it("creates an idea and draft from a pasted news source", async () => {
    const result = await newsToPostService.createDraftFromSource({
      sourceTitle: "Une PME industrialise ses copilotes IA",
      sourceSummary:
        "Le sujet central est l'adoption terrain et la priorisation des cas d'usage."
    });

    expect(result.idea.title).toContain("copilotes IA");
    expect(result.draft.headline).toContain("copilotes IA");
    expect(result.run.skillName).toBe("linkedin-news-to-post");
  });

  it("réussit quand le skill ne renvoie pas de hooks (contrat reel news-to-post)", async () => {
    // Regression (bug revele par l eval, fixtures B) : le skill news-to-post
    // renvoie {data:{draft, qualitySignals}} SANS hooks. Le service ne doit pas
    // planter sur l iteration d un `hooks` absent.
    const hooklessRunner = {
      // Le service appelle `executeAsync` : le double doit exposer le meme
      // contrat que le vrai runner, sinon il testerait un chemin qui n existe
      // plus (cf. feedback_test_doubles_mirror_contracts).
      executeAsync: async () => ({
        status: "succeeded",
        summary: "ok",
        engine: "codex",
        data: {
          draft: { headline: "Titre veille", bodyMarkdown: "Corps de veille." },
          qualitySignals: { clarity: 0.82, specificity: 0.8, antiHypeAlignment: 0.85 }
          // pas de cle `hooks` : exactement la forme reelle du skill
        }
      }),
      getSelectedEngineName: () => "codex"
    } as unknown as ReturnType<typeof createStrictSkillRunnerService>;

    const service = new NewsToPostService(
      db,
      ideasRepository,
      hooklessRunner,
      () => createStrategyBundleFixture()
    );

    const result = await service.createDraftFromSource({
      sourceTitle: "Source sans hooks",
      sourceSummary: "Resume suffisant pour une generation."
    });

    expect(result.draft.headline).toBe("Titre veille");
    expect(result.hooks).toEqual([]);
    expect(result.run.skillName).toBe("linkedin-news-to-post");
  });

  /**
   * Runner qui capture l invocation avant de rendre un contrat valide. Sert a
   * comparer le pilier envoye au moteur avec celui sous lequel l idee est
   * enregistree : c est le seul endroit ou la divergence est observable.
   */
  function createCapturingRunner() {
    const invocations: SkillRunnerInvocation[] = [];
    const runner = {
      executeAsync: async (invocation: SkillRunnerInvocation) => {
        invocations.push(invocation);
        return {
          status: "succeeded",
          summary: "ok",
          engine: "codex",
          data: {
            draft: { headline: "Titre veille", bodyMarkdown: "Corps de veille." },
            qualitySignals: { clarity: 0.82, specificity: 0.8, antiHypeAlignment: 0.85 }
          }
        };
      },
      getSelectedEngineName: () => "codex"
    } as unknown as SkillRunnerService;
    return { runner, invocations };
  }

  /** Strategie dont le pilier de veille porte le libelle reel de l utilisateur. */
  function createStrategyWithNewsPillar(label: string): StrategyBundle {
    const strategy = createStrategyBundleFixture();
    return {
      ...strategy,
      pillars: [
        ...strategy.pillars,
        {
          id: "pillar_news",
          label,
          description: "Ce qui bouge dans le secteur, et ce qu il faut en retenir.",
          position: strategy.pillars.length,
          isDefault: false
        }
      ]
    };
  }

  it("range l'idée sous le pilier réellement déclaré, pas sous « Veille »", async () => {
    const { runner, invocations } = createCapturingRunner();
    const service = new NewsToPostService(db, ideasRepository, runner, () =>
      createStrategyWithNewsPillar("Actualités du secteur")
    );

    const result = await service.createDraftFromSource({
      sourceTitle: "Une PME industrialise ses copilotes IA",
      sourceSummary: "Le sujet central est l'adoption terrain."
    });

    // Le defaut : l idee etait creee avec "Veille" code en dur, un pilier qui
    // n existe pas dans la strategie de l utilisateur.
    expect(result.idea.pillarLabel).toBe("Actualités du secteur");
    // Un seul fait, une seule valeur : le contexte envoye au moteur et l idee
    // enregistree portent le meme pilier.
    expect(invocations[0]?.context.pillarLabel).toBe(result.idea.pillarLabel);
    // Le pilier existe bien dans la strategie, donc sa description est trouvee.
    // C est ce que la passe de correction ulterieure perdait : elle repartait de
    // "Veille", introuvable, et corrigeait avec un contexte appauvri.
    expect(invocations[0]?.context.pillarDescription).not.toBe("");
  });

  it("la passe de correction garde la description du pilier", async () => {
    // Consequence n°1 du defaut : la correction repart de `idea.pillarLabel`.
    // Sous "Veille", introuvable dans la strategie, `pillarDescription` tombait
    // a "" et le post etait corrige avec MOINS de contexte qu il n avait ete
    // ecrit. Les deux services partagent la meme base et la meme strategie,
    // exactement comme dans l application.
    const { runner } = createCapturingRunner();
    const strategie = () => createStrategyWithNewsPillar("Actualités du secteur");
    const service = new NewsToPostService(db, ideasRepository, runner, strategie);
    const workshopService = new WorkshopService(
      db,
      ideasRepository,
      strategie,
      undefined,
      createStrictSkillRunnerService()
    );

    const session = await service.createDraftFromSource({
      sourceTitle: "Une PME industrialise ses copilotes IA",
      sourceSummary: "Le sujet central est l'adoption terrain."
    });

    const corrected = await workshopService.correctDraft(session.draft.id);

    // La description d'abord : c'est elle que la correction perdait.
    expect(corrected.contextUsed.pillarDescription).not.toBe("");
    expect(corrected.contextUsed.pillarLabel).toBe("Actualités du secteur");
  });

  it("l'idée est persistée sous ce même pilier (filtre Bibliothèque)", async () => {
    const { runner } = createCapturingRunner();
    const service = new NewsToPostService(db, ideasRepository, runner, () =>
      createStrategyWithNewsPillar("Actualités du secteur")
    );

    const result = await service.createDraftFromSource({
      sourceTitle: "Une PME industrialise ses copilotes IA",
      sourceSummary: "Le sujet central est l'adoption terrain."
    });

    // La Bibliotheque filtre sur `ideas.pillar_label` : c est la valeur en base
    // qui decide de l apparition du post sous un pilier, pas l objet en memoire.
    const stored = db
      .prepare("SELECT pillar_label FROM ideas WHERE id = ?")
      .get(result.idea.id) as { pillar_label: string } | undefined;
    expect(stored?.pillar_label).toBe("Actualités du secteur");
  });

  it("retombe sur « Veille » quand aucun pilier déclaré ne correspond", async () => {
    const { runner, invocations } = createCapturingRunner();
    // La fixture de base ne declare que Methodes, ROI et Adoption IA : aucun
    // pilier ne peut accueillir la veille, le repli est alors correct.
    const service = new NewsToPostService(db, ideasRepository, runner, () =>
      createStrategyBundleFixture()
    );

    const result = await service.createDraftFromSource({
      sourceTitle: "Une PME industrialise ses copilotes IA",
      sourceSummary: "Le sujet central est l'adoption terrain."
    });

    expect(result.idea.pillarLabel).toBe("Veille");
    expect(invocations[0]?.context.pillarLabel).toBe("Veille");
  });

  /**
   * Faux `WebContents` qui capture les evenements `execution:progress`, sans
   * dependre d Electron. Meme montage que dans workshop-service.test.ts.
   */
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

  function makeServiceWithThrowingRunner(error: Error) {
    // Le double expose le contrat reel du runner (`executeAsync` +
    // `getSelectedEngineName`), et son appel moteur LEVE : c est le scenario
    // d une panne de quota ou de limite de debit, pas un resultat en echec.
    const throwingRunner = {
      executeAsync: async () => {
        throw error;
      },
      getSelectedEngineName: () => "codex"
    } as unknown as SkillRunnerService;

    return new NewsToPostService(db, ideasRepository, throwingRunner, () =>
      createStrategyBundleFixture()
    );
  }

  it("emet une borne `failed` avec le code de l'erreur quand le moteur LEVE", async () => {
    const service = makeServiceWithThrowingRunner(
      new SkillRunError("ENGINE_EXECUTION_ERROR", "rate limit reached")
    );
    const { sender, events } = makeFakeSender();

    await expect(
      service.createDraftFromSource(
        {
          sourceTitle: "Source qui declenche une panne moteur",
          sourceSummary: "Resume suffisant pour une generation."
        },
        sender as never
      )
    ).rejects.toThrow("rate limit reached");

    const terminal = events.filter((e) => e.status === "failed" || e.status === "completed");
    expect(terminal).toHaveLength(1);
    expect(terminal[0]?.status).toBe("failed");
    expect(terminal[0]?.phase).toBe("news");
    expect(terminal[0]?.errorCode).toBe("ENGINE_EXECUTION_ERROR");
  });

  it("emet `failed` avec SKILL_RUN_FAILED quand l'erreur ne porte aucun code", async () => {
    const service = makeServiceWithThrowingRunner(new Error("boom"));
    const { sender, events } = makeFakeSender();

    await expect(
      service.createDraftFromSource(
        {
          sourceTitle: "Source qui declenche une panne moteur",
          sourceSummary: "Resume suffisant pour une generation."
        },
        sender as never
      )
    ).rejects.toThrow("boom");

    const terminal = events.filter((e) => e.status === "failed" || e.status === "completed");
    expect(terminal).toHaveLength(1);
    expect(terminal[0]?.errorCode).toBe("SKILL_RUN_FAILED");
  });

  it("n'emet qu'une seule borne terminale sur un echec rendu par le runner", async () => {
    const failingRunner = {
      executeAsync: async () => ({
        status: "failed",
        summary: "moteur en echec",
        engine: "codex",
        error: { code: "CODEX_CLI_FAILED", message: "echec moteur" }
      }),
      getSelectedEngineName: () => "codex"
    } as unknown as SkillRunnerService;
    const service = new NewsToPostService(db, ideasRepository, failingRunner, () =>
      createStrategyBundleFixture()
    );
    const { sender, events } = makeFakeSender();

    await expect(
      service.createDraftFromSource(
        {
          sourceTitle: "Source dont la generation echoue",
          sourceSummary: "Resume suffisant pour une generation."
        },
        sender as never
      )
    ).rejects.toThrow();

    // Une seule paire started/terminale par sous-etape reelle : une garde trop
    // large autour de l'appel moteur en emettrait deux pour la meme etape.
    const terminal = events.filter((e) => e.status === "failed" || e.status === "completed");
    expect(terminal).toHaveLength(1);
    expect(terminal[0]?.errorCode).toBe("CODEX_CLI_FAILED");
  });
});

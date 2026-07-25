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
import type { SkillRunnerInvocation } from "../../app/main/domains/execution/skill-runner.service";
import { createStrictSkillRunnerService } from "./helpers/fake-codex";
import { CalendarService } from "../../app/main/domains/calendar/calendar.service";
import { LibraryService } from "../../app/main/domains/library/library.service";
import { NewsToPostService } from "../../app/main/domains/news/news-to-post.service";
import { summarizeIcps } from "../../app/main/domains/strategy/strategy-context";
import { ideaInputSchema } from "../../app/shared/schemas/ideas";
import type { StrategyBundle } from "../../app/shared/types/strategy";

/**
 * La cible visee, de la saisie jusqu au prompt.
 *
 * Le defaut corrige ici : `summarizeIcps` concatenait TOUTES les cibles de la
 * strategie dans chaque prompt, alors que la doctrine editoriale exige une
 * cible unique par post. Un texte ecrit pour tout le monde n est ecrit pour
 * personne.
 *
 * La porte qui mord n est pas le test unitaire de `summarizeIcps` : il peut
 * rester vert pendant que le champ n atteint jamais le prompt. C est
 * « le contexte reellement transmis au moteur ne contient que la cible
 * choisie », mesure sur l invocation captee.
 */

const AUTRE_SEGMENT = "Responsable des operations";
const CIBLE_SEGMENT = "Dirigeants de PME";

function createBundleADeuxCibles(): StrategyBundle {
  return {
    profile: {
      id: "profile_active",
      name: "Philippe",
      positioning: "Consultant IA generative pour PME",
      bio: "",
      expertiseSummary: ""
    },
    offers: [],
    icps: [
      {
        id: "icp_1",
        segment: CIBLE_SEGMENT,
        pains: "Trop d idees IA, pas assez de priorisation.",
        languageCues: "Deployable, ROI, concret."
      },
      {
        id: "icp_2",
        segment: AUTRE_SEGMENT,
        pains: "Des outils imposes sans mode operatoire.",
        languageCues: "Charge, cadence, incidents."
      }
    ],
    pillars: [
      {
        id: "pillar_1",
        label: "Methodes",
        description: "Comment cadrer un projet IA.",
        position: 0,
        isDefault: true
      }
    ],
    voiceRules: [
      {
        id: "rule_1",
        category: "Anti-style",
        ruleText: "Pas de hype.",
        ruleType: "anti_style"
      }
    ]
  };
}

/**
 * Le moteur factice PARTAGE, enveloppe pour conserver chaque invocation.
 *
 * C est la seule facon de verifier ce qui part reellement vers le moteur : un
 * test de `summarizeIcps` seul resterait vert alors que le champ n atteindrait
 * jamais le prompt.
 *
 * On enveloppe le double partage plutot que d en ecrire un ici. Une premiere
 * version reimplementait a la main les reponses de chaque competence : elle a
 * echoue sur deux contrats qu elle ne connaissait pas, et surtout un double
 * ecrit a cote du vrai finit par ne plus refleter le contrat qu il imite.
 */
function createRunnerCapteur() {
  const invocations: SkillRunnerInvocation[] = [];
  const service = createStrictSkillRunnerService();
  const original = service.executeAsync.bind(service);
  service.executeAsync = (invocation: SkillRunnerInvocation) => {
    invocations.push(invocation);
    return original(invocation);
  };

  return { invocations, service };
}

describe("cible visee, resume des cibles", () => {
  it("ne retient que la cible demandee", () => {
    const resume = summarizeIcps(createBundleADeuxCibles(), CIBLE_SEGMENT);

    expect(resume).toContain(CIBLE_SEGMENT);
    expect(resume).not.toContain(AUTRE_SEGMENT);
  });

  it("retombe sur toutes les cibles quand aucune n est demandee", () => {
    const resume = summarizeIcps(createBundleADeuxCibles(), null);

    expect(resume).toContain(CIBLE_SEGMENT);
    expect(resume).toContain(AUTRE_SEGMENT);
  });

  it("retombe sur toutes les cibles quand le segment stocke n existe plus", () => {
    // Segment renomme ou supprime dans la strategie depuis la creation de
    // l idee. Le meme chemin que l absence de cible, volontairement : choisir
    // a la place de l utilisateur serait pire que l ancien comportement.
    const resume = summarizeIcps(createBundleADeuxCibles(), "Segment supprime");

    expect(resume).toContain(CIBLE_SEGMENT);
    expect(resume).toContain(AUTRE_SEGMENT);
  });

  it("n envoie qu une seule cible meme quand deux portent le meme segment", () => {
    // Rien n impose l unicite des segments : `icpInputSchema` ne la contraint
    // pas et `saveBundle` reinsere tel quel. Avec un `filter`, deux cibles
    // homonymes aux douleurs differentes partaient toutes les deux au modele
    // pendant que l ecran affirme « une seule, jamais toutes ».
    const bundle = createBundleADeuxCibles();
    bundle.icps.push({
      id: "icp_3",
      segment: CIBLE_SEGMENT,
      pains: "Une douleur homonyme et differente.",
      languageCues: "Vocabulaire homonyme."
    });

    const resume = summarizeIcps(bundle, CIBLE_SEGMENT);

    expect(resume).toContain("Trop d idees IA, pas assez de priorisation.");
    expect(resume).not.toContain("Une douleur homonyme et differente.");
    expect(resume.split("Cible: ")).toHaveLength(2);
  });

  it("transmet les champs de la cible retenue, pas seulement son segment", () => {
    const resume = summarizeIcps(createBundleADeuxCibles(), CIBLE_SEGMENT);

    expect(resume).toContain("Deployable, ROI, concret.");
    expect(resume).not.toContain("Charge, cadence, incidents.");
  });
});

describe("cible visee, persistance", () => {
  let db: Database.Database;
  let repository: IdeasRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    repository = new IdeasRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it("conserve la cible choisie a la creation", () => {
    const cree = repository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l outil",
      pillarLabel: "Methodes",
      targetIcpSegment: CIBLE_SEGMENT
    });

    expect(cree.targetIcpSegment).toBe(CIBLE_SEGMENT);
    expect(repository.getIdeaById(cree.id).targetIcpSegment).toBe(CIBLE_SEGMENT);
    expect(repository.listIdeas()[0]?.targetIcpSegment).toBe(CIBLE_SEGMENT);
  });

  it("normalise l absence de cible en null plutot qu en undefined", () => {
    const cree = repository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l outil",
      pillarLabel: "Methodes"
    });

    expect(cree.targetIcpSegment).toBeNull();
    expect(repository.getIdeaById(cree.id).targetIcpSegment).toBeNull();
  });

  it("ajoute la colonne a une base creee avant le champ", () => {
    // `CREATE TABLE IF NOT EXISTS` ne touche pas une table existante : sans
    // l ALTER idempotent, la colonne n existerait que sur les espaces de
    // travail neufs et toute lecture echouerait sur les bases installees.
    const ancienne = new Database(":memory:");
    ancienne.exec(`
      CREATE TABLE ideas (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        angle TEXT NOT NULL,
        pillar_label TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    ancienne
      .prepare(`
        INSERT INTO ideas (id, title, angle, pillar_label, created_at)
        VALUES ('idea_ancienne', 'Sujet', 'Angle', 'Methodes', '2026-01-01T00:00:00.000Z')
      `)
      .run();

    createIdeasTables(ancienne);
    createIdeasTables(ancienne);

    const ancien = new IdeasRepository(ancienne).getIdeaById("idea_ancienne");
    expect(ancien.targetIcpSegment).toBeNull();

    ancienne.close();
  });

  it("refuse une cible vide plutot que de la stocker", () => {
    const resultat = ideaInputSchema.safeParse({
      title: "Sujet",
      angle: "Angle",
      pillarLabel: "Methodes",
      targetIcpSegment: "   "
    });

    expect(resultat.success).toBe(false);
  });
});

describe("cible visee, contexte transmis au moteur", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    ideasRepository = new IdeasRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  function createService(runner: ReturnType<typeof createRunnerCapteur>["service"]) {
    return new WorkshopService(
      db,
      ideasRepository,
      () => createBundleADeuxCibles(),
      undefined,
      runner
    );
  }

  it("n envoie que la cible de l idee, pas les autres", async () => {
    const { invocations, service } = createRunnerCapteur();
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l outil",
      pillarLabel: "Methodes",
      targetIcpSegment: AUTRE_SEGMENT
    });

    await createService(service).getSuggestedStructures(idea.id, "expertise", "awareness");

    const resume = invocations[0]?.context.strategyIcpSummary ?? "";
    expect(resume).toContain(AUTRE_SEGMENT);
    expect(resume).not.toContain(CIBLE_SEGMENT);
  });

  it("envoie toutes les cibles pour une idee sans cible", async () => {
    const { invocations, service } = createRunnerCapteur();
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l outil",
      pillarLabel: "Methodes"
    });

    await createService(service).getSuggestedStructures(idea.id, "expertise", "awareness");

    const resume = invocations[0]?.context.strategyIcpSummary ?? "";
    expect(resume).toContain(CIBLE_SEGMENT);
    expect(resume).toContain(AUTRE_SEGMENT);
  });

  /*
   * Les CINQ etapes du pipeline, pas seulement la premiere.
   *
   * La version precedente ne captait que `getSuggestedStructures`. Une mutation
   * la laissait verte : reconstruire le contexte en dur dans `correctDraft`
   * sans `targetIcpSegment` faisait repartir la passe de correction sur toutes
   * les cibles, alors que la documentation de `buildStrategyContext` affirme
   * couvrir la correction. Un texte ecrit pour une personne aurait ete reecrit
   * pour une autre, sans qu aucune porte ne tombe.
   */
  const ETAPES: Array<{
    nom: string;
    joue: (service: WorkshopService, ideaId: string, draftId: string) => Promise<unknown>;
  }> = [
    {
      nom: "selection de structure",
      joue: (service, ideaId) =>
        service.getSuggestedStructures(ideaId, "expertise", "awareness")
    },
    {
      nom: "generation d accroches",
      joue: (service, ideaId) =>
        service.generateHooks(ideaId, "expertise", "belief-terrain-reality")
    },
    {
      nom: "variante",
      joue: (service, _ideaId, draftId) => service.createVariant(draftId, "repurpose")
    },
    {
      nom: "correction",
      joue: (service, _ideaId, draftId) => service.correctDraft(draftId)
    }
  ];

  for (const etape of ETAPES) {
    it(`n envoie que la cible de l idee a l etape « ${etape.nom} »`, async () => {
      const { invocations, service } = createRunnerCapteur();
      const idea = ideasRepository.createIdea({
        title: "IA en PME",
        angle: "Le process avant l outil",
        pillarLabel: "Methodes",
        targetIcpSegment: AUTRE_SEGMENT
      });
      const createdAt = new Date().toISOString();
      db.prepare(`
        INSERT INTO drafts (id, idea_id, headline, body_markdown, quality_score, created_at)
        VALUES ('draft_1', ?, 'Titre', 'Corps du post', 0.8, ?)
      `).run(idea.id, createdAt);

      await etape.joue(createService(service), idea.id, "draft_1");

      // La porte refuse de conclure sur zero invocation : sans cette assertion,
      // une etape qui n appellerait plus le moteur du tout resterait verte.
      expect(invocations.length).toBeGreaterThan(0);
      const resume = invocations[0]?.context.strategyIcpSummary ?? "";
      expect(resume).toContain(AUTRE_SEGMENT);
      expect(resume).not.toContain(CIBLE_SEGMENT);
    });
  }

  it("expose la cible retenue dans le contexte relu de la session", async () => {
    // `contextUsed` est ce que l interface affiche : il doit dire la meme chose
    // que ce qui a ete envoye, sinon l ecran ment sur la generation.
    const { service } = createRunnerCapteur();
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l outil",
      pillarLabel: "Methodes",
      targetIcpSegment: AUTRE_SEGMENT
    });
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO drafts (id, idea_id, headline, body_markdown, quality_score, created_at)
      VALUES ('draft_1', ?, 'Titre', 'Corps', 0.8, ?)
    `).run(idea.id, createdAt);

    const session = await createService(service).getSessionByIdeaId(idea.id);

    expect(session?.contextUsed.strategyIcpSummary).toContain(AUTRE_SEGMENT);
    expect(session?.contextUsed.strategyIcpSummary).not.toContain(CIBLE_SEGMENT);
  });
});

describe("cible visee, parcours veille", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
  });

  afterEach(() => {
    db.close();
  });

  it("transmet la cible choisie et la conserve sur l idee creee", async () => {
    // La doctrine ne distingue pas selon la porte d entree. Sans ce chemin, un
    // post issu d une veille recevrait encore toutes les cibles et la promesse
    // ne tiendrait que sur la saisie manuelle.
    const { invocations, service } = createRunnerCapteur();
    const ideasRepository = new IdeasRepository(db);
    const newsService = new NewsToPostService(db, ideasRepository, service, () =>
      createBundleADeuxCibles()
    );

    const resultat = await newsService.createDraftFromSource({
      sourceTitle: "Une PME industrialise ses copilotes",
      sourceSummary: "Le sujet est la priorisation des cas d usage.",
      targetIcpSegment: AUTRE_SEGMENT
    });

    const resume = invocations[0]?.context.strategyIcpSummary ?? "";
    expect(resume).toContain(AUTRE_SEGMENT);
    expect(resume).not.toContain(CIBLE_SEGMENT);
    expect(resultat.idea.targetIcpSegment).toBe(AUTRE_SEGMENT);
  });

  it("ne descend pas la cible dans la charge utile du skill", async () => {
    // La cible appartient au contexte de strategie, ou le resume la porte deja.
    // L y remettre la ferait arriver deux fois au modele, sous deux formes.
    const { invocations, service } = createRunnerCapteur();
    const newsService = new NewsToPostService(db, new IdeasRepository(db), service, () =>
      createBundleADeuxCibles()
    );

    await newsService.createDraftFromSource({
      sourceTitle: "Une PME industrialise ses copilotes",
      sourceSummary: "Le sujet est la priorisation des cas d usage.",
      targetIcpSegment: AUTRE_SEGMENT
    });

    expect(Object.keys(invocations[0]?.payload ?? {}).sort()).toEqual([
      "sourceSummary",
      "sourceTitle"
    ]);
  });

  it("envoie toutes les cibles quand la veille n en designe aucune", async () => {
    const { invocations, service } = createRunnerCapteur();
    const newsService = new NewsToPostService(db, new IdeasRepository(db), service, () =>
      createBundleADeuxCibles()
    );

    await newsService.createDraftFromSource({
      sourceTitle: "Une PME industrialise ses copilotes",
      sourceSummary: "Le sujet est la priorisation des cas d usage."
    });

    const resume = invocations[0]?.context.strategyIcpSummary ?? "";
    expect(resume).toContain(CIBLE_SEGMENT);
    expect(resume).toContain(AUTRE_SEGMENT);
  });
});

describe("cible visee, variantes de la bibliotheque", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    new CalendarService(db);
  });

  afterEach(() => {
    db.close();
  });

  it("reecrit la variante pour la meme cible que l original", async () => {
    // Une variante qui viserait une autre personne que le post d origine n en
    // serait plus une variante. La cible doit suivre le post sur toute sa
    // chaine, generation ET reecriture.
    const { invocations, service } = createRunnerCapteur();
    const ideasRepository = new IdeasRepository(db);
    const idea = ideasRepository.createIdea({
      title: "IA en PME",
      angle: "Le process avant l outil",
      pillarLabel: "Methodes",
      targetIcpSegment: AUTRE_SEGMENT
    });
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO drafts (id, idea_id, headline, body_markdown, quality_score, created_at)
      VALUES ('draft_1', ?, 'Titre', 'Corps du post', 0.8, ?)
    `).run(idea.id, createdAt);

    const libraryService = new LibraryService(db, service, () => createBundleADeuxCibles());
    await libraryService.createVariantFromDraft("draft_1");

    const resume = invocations[0]?.context.strategyIcpSummary ?? "";
    expect(resume).toContain(AUTRE_SEGMENT);
    expect(resume).not.toContain(CIBLE_SEGMENT);
  });
});

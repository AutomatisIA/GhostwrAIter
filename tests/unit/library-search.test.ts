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
import { CalendarService } from "../../app/main/domains/calendar/calendar.service";
import { LibraryService } from "../../app/main/domains/library/library.service";
import {
  createStrategyBundleFixture,
  createStrictSkillRunnerService
} from "./helpers/fake-codex";

describe("library search", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let workshopService: WorkshopService;
  let libraryService: LibraryService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    // La bibliotheque lit `calendar_items` pour deriver le triage. Ce
    // constructeur cree la table, comme au demarrage de l application.
    new CalendarService(db);
    ideasRepository = new IdeasRepository(db);
    const strategyBundle = createStrategyBundleFixture();
    const skillRunnerService = createStrictSkillRunnerService();
    workshopService = new WorkshopService(
      db,
      ideasRepository,
      () => strategyBundle,
      undefined,
      skillRunnerService
    );
    libraryService = new LibraryService(db, skillRunnerService, () => strategyBundle);
  });

  afterEach(() => {
    db.close();
  });

  it("filters library entries by keyword and deterministic metadata", async () => {
    const first = ideasRepository.createIdea({
      title: "Comment prioriser 3 cas d'usage IA",
      angle: "Aller vers le utile avant le spectaculaire",
      pillarLabel: "ROI"
    });
    const second = ideasRepository.createIdea({
      title: "Pourquoi les prompts ne suffisent pas",
      angle: "Le probleme est organisationnel",
      pillarLabel: "Adoption IA"
    });

    await workshopService.generateDraftFromIdea(first.id);
    await workshopService.generateDraftFromIdea(second.id);

    const entries = libraryService.searchEntries({
      query: "prompts",
      pillarLabel: "Adoption IA",
      status: "draft",
      tag: "prompts"
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.headline).toContain("prompts");
    expect(entries[0]?.pillarLabel).toBe("Adoption IA");
    expect(entries[0]?.status).toBe("draft");
    expect(entries[0]?.tags).toContain("prompts");
  });

  /*
   * Les accents, sur une application francaise.
   *
   * `lower()` de SQLite ne traite que l ASCII. Un post contenant « Ecole »
   * accentue n etait jamais trouve, ni sous sa forme accentuee ni sans, parce
   * que `LIKE` ne replie pas les accents non plus et que la requete comparait
   * un `lower()` ASCII a un `toLowerCase()` JavaScript Unicode.
   */
  async function creerBrouillon(titre: string, angle: string) {
    const idea = ideasRepository.createIdea({
      title: titre,
      angle,
      pillarLabel: "Adoption IA"
    });
    return workshopService.generateDraftFromIdea(idea.id);
  }

  it("trouve un post accentue, que la recherche soit accentuee ou non", async () => {
    await creerBrouillon(
      "École et entreprise, le meme angle mort",
      "Ce que la formation revele du deploiement"
    );

    expect(libraryService.searchEntries({ query: "école" })).toHaveLength(1);
    expect(libraryService.searchEntries({ query: "ecole" })).toHaveLength(1);
    expect(libraryService.searchEntries({ query: "ÉCOLE" })).toHaveLength(1);
    expect(libraryService.searchEntries({ query: "École" })).toHaveLength(1);
  });

  it("trouve un post non accentue quand la recherche porte un accent", async () => {
    await creerBrouillon(
      "Ecole et entreprise, sans accent cette fois",
      "Le meme sujet, ecrit sans diacritique"
    );

    expect(libraryService.searchEntries({ query: "école" })).toHaveLength(1);
  });

  it("ne rend pas un post qui ne contient pas le terme cherche", async () => {
    // Contre-epreuve : sans elle, une fonction de pliage qui renverrait la
    // chaine vide ferait tout correspondre et les trois portes ci-dessus
    // resteraient vertes.
    await creerBrouillon(
      "École et entreprise, le meme angle mort",
      "Ce que la formation revele du deploiement"
    );

    expect(libraryService.searchEntries({ query: "cathedrale" })).toHaveLength(0);
  });

  it("cree une variante d un brouillon a l accroche accentuee", async () => {
    // Ce qui echouait vraiment ici : la variante etait relue par une recherche
    // sur son accroche, et `lower()` de SQLite ne repliant pas les accents, la
    // recherche ne la retrouvait pas. La methode levait « Variant could not be
    // reloaded » alors que le brouillon, sa version, son execution et ses
    // etiquettes venaient d etre ecrits : une erreur affichee sur un travail
    // reussi. C est le pliage des accents qui le corrige ; la relecture par
    // identifiant retire simplement la dependance qui l avait rendu possible.
    const session = await creerBrouillon(
      "École et entreprise, le meme angle mort",
      "Ce que la formation revele du deploiement"
    );

    const variante = await libraryService.createVariantFromDraft(session.draft.id);

    expect(variante.sourceDraftId).toBe(session.draft.id);
    expect(variante.status).toBe("variant");
  });
});

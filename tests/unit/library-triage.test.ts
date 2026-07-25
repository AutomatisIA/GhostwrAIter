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
import {
  deriveTriage,
  LibraryService
} from "../../app/main/domains/library/library.service";
import {
  createStrategyBundleFixture,
  createStrictSkillRunnerService
} from "./helpers/fake-codex";

/**
 * Le triage n est pas saisi, il est derive de `draft_versions` et de
 * `calendar_items`. Ces tests verrouillent la derivation ET la forme de la
 * requete : la bibliotheque doit rendre une ligne par brouillon quoi qu il
 * arrive au nombre de versions, de tags ou d entrees de calendrier.
 */
describe("library triage", () => {
  let db: Database.Database;
  let ideasRepository: IdeasRepository;
  let workshopService: WorkshopService;
  let calendarService: CalendarService;
  let libraryService: LibraryService;

  beforeEach(() => {
    db = new Database(":memory:");
    createIdeasTables(db);
    createWorkshopTables(db);
    // Le constructeur cree `calendar_items`, exactement comme au demarrage de
    // l application (app/main/index.ts). La bibliotheque lit cette table.
    calendarService = new CalendarService(db);
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

  async function createDraft(title: string) {
    const idea = ideasRepository.createIdea({
      title,
      angle: "Le process prime sur l'outil",
      pillarLabel: "Methodes"
    });
    const generated = await workshopService.generateDraftFromIdea(idea.id);
    return { ideaId: idea.id, draftId: generated.draft.id };
  }

  function entryFor(draftId: string) {
    const entry = libraryService.listEntries().find((item) => item.draftId === draftId);
    if (!entry) {
      throw new Error(`Entry not found: ${draftId}`);
    }
    return entry;
  }

  /**
   * Horodate la version RELATIVEMENT a maintenant. Une date absolue dans le
   * futur passerait aujourd hui et casserait le jour ou l horloge la depasse :
   * la version de generation est posee a l instant du test, donc toute fixture
   * censee etre « la plus recente » doit rester devant cet instant-la.
   */
  function addVersion(draftId: string, reason: string, offsetMs: number) {
    const createdAt = new Date(Date.now() + offsetMs).toISOString();
    db.prepare(`
      INSERT INTO draft_versions (id, draft_id, body_markdown, quality_score, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`version_${reason}_${createdAt}`, draftId, "corps revu", 0.9, reason, createdAt);
    return createdAt;
  }

  const MINUTE = 60_000;
  const DAY = 24 * 60 * MINUTE;

  /*
   * La regle demandee etait `versionCount === 1`. Elle est implementee en
   * `<= 1`, ce qui donne le meme resultat sur toutes les donnees existantes
   * (aucun brouillon sans version). L ecart ne se voit que sur la branche
   * zero-version, testee ici : `=== 1` y repondrait `pret`, soit l inverse du
   * fait, un brouillon sans aucune version n ayant par definition pas ete relu.
   */
  it("classe en a-relire un brouillon sans aucune version", () => {
    expect(deriveTriage(false, 0)).toBe("a-relire");
    expect(deriveTriage(false, 1)).toBe("a-relire");
    expect(deriveTriage(false, 2)).toBe("pret");
    expect(deriveTriage(true, 0)).toBe("planifie");
  });

  it("classe en a-relire un brouillon qui n a que sa version de generation", async () => {
    const { draftId } = await createDraft("Pourquoi cadrer avant de prompter");

    const entry = entryFor(draftId);

    expect(entry.versionCount).toBe(1);
    expect(entry.triage).toBe("a-relire");
  });

  it("classe en pret un brouillon corrige", async () => {
    const { draftId } = await createDraft("Pourquoi cadrer avant de prompter");
    addVersion(draftId, "correction", MINUTE);

    const entry = entryFor(draftId);

    expect(entry.versionCount).toBe(2);
    expect(entry.triage).toBe("pret");
  });

  it("classe en pret un brouillon repris a la main via updateEntryText", async () => {
    const { draftId } = await createDraft("Pourquoi cadrer avant de prompter");

    libraryService.updateEntryText(draftId, "Titre repris", "Corps repris a la main");

    const entry = entryFor(draftId);

    expect(entry.versionCount).toBe(2);
    expect(entry.triage).toBe("pret");
  });

  it("classe en planifie un brouillon date meme s il n a qu une version", async () => {
    const { draftId } = await createDraft("Pourquoi cadrer avant de prompter");

    calendarService.scheduleDraft({
      draftId,
      plannedDate: "2026-08-01",
      status: "planned"
    });

    const entry = entryFor(draftId);

    // L ordre des regles est significatif : sans la priorite au calendrier, ce
    // brouillon a une seule version ressortirait en a-relire.
    expect(entry.versionCount).toBe(1);
    expect(entry.triage).toBe("planifie");
  });

  it("rend une seule ligne pour un brouillon planifie deux fois", async () => {
    const { draftId } = await createDraft("Pourquoi cadrer avant de prompter");

    calendarService.scheduleDraft({
      draftId,
      plannedDate: "2026-08-01",
      status: "planned"
    });
    calendarService.scheduleDraft({
      draftId,
      plannedDate: "2026-08-15",
      status: "planned"
    });

    const entries = libraryService.listEntries().filter((item) => item.draftId === draftId);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.triage).toBe("planifie");
    expect(entries[0]?.versionCount).toBe(1);
    // Les tags ne doivent pas etre dupliques par la jointure calendrier.
    expect(entries[0]?.tags).toEqual([...new Set(entries[0]?.tags ?? [])]);
    expect(entries[0]?.tags.length).toBeGreaterThan(0);
  });

  it("compte les versions et retient la plus recente sans dupliquer les tags", async () => {
    const { draftId } = await createDraft("Pourquoi cadrer avant de prompter");
    addVersion(draftId, "correction", 1 * DAY);
    const mostRecent = addVersion(draftId, "manual_edit", 5 * DAY);
    // Volontairement anterieure, et inseree en dernier : `lastVersionAt` doit
    // rester le maximum, pas la derniere ligne ecrite.
    addVersion(draftId, "correction", -30 * DAY);

    const entry = entryFor(draftId);

    expect(entry.versionCount).toBe(4);
    expect(entry.lastVersionAt).toBe(mostRecent);
    expect(entry.triage).toBe("pret");
    expect(entry.tags).toEqual([...new Set(entry.tags)]);
    expect(entry.tags.length).toBeGreaterThan(0);
  });

  it("expose le titre de l idee d origine comme cle de regroupement", async () => {
    const { ideaId, draftId } = await createDraft("Pourquoi cadrer avant de prompter");
    const variant = await libraryService.createVariantFromDraft(draftId);

    const entry = entryFor(draftId);

    expect(entry.ideaTitle).toBe("Pourquoi cadrer avant de prompter");
    expect(entry.ideaId).toBe(ideaId);
    // La variante herite de l idee : le regroupement par sujet les reunit.
    expect(variant.ideaTitle).toBe("Pourquoi cadrer avant de prompter");
    expect(variant.ideaId).toBe(ideaId);
    // Une variante fraiche n a que sa propre ligne `variant` dans
    // `draft_versions` : elle n a donc pas encore ete relue.
    expect(variant.versionCount).toBe(1);
    expect(variant.triage).toBe("a-relire");
  });

  it("rend la meme forme depuis searchEntries et depuis listEntries", async () => {
    const { draftId } = await createDraft("Pourquoi cadrer avant de prompter");
    addVersion(draftId, "correction", MINUTE);
    calendarService.scheduleDraft({
      draftId,
      plannedDate: "2026-08-01",
      status: "planned"
    });

    const listed = entryFor(draftId);
    const searched = libraryService
      .searchEntries({ query: "cadrer" })
      .find((item) => item.draftId === draftId);

    expect(searched).toEqual(listed);
    expect(searched?.triage).toBe("planifie");
  });

  it("n expose aucune colonne technique au dela du contrat LibraryEntry", async () => {
    const { draftId } = await createDraft("Pourquoi cadrer avant de prompter");

    const entry = entryFor(draftId);

    expect(Object.keys(entry).sort()).toEqual(
      [
        "bodyMarkdown",
        "bodyPreview",
        "createdAt",
        "draftId",
        "headline",
        "ideaId",
        "ideaTitle",
        "lastVersionAt",
        "pillarLabel",
        "qualityScore",
        "sourceDraftId",
        "status",
        "tags",
        "triage",
        "versionCount"
      ].sort()
    );
  });
});

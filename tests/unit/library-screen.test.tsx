// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LibraryScreen } from "../../app/renderer/src/features/library/LibraryScreen";
import { ToastProvider } from "../../app/renderer/src/feedback/ToastProvider";

const DAY = 86_400_000;

function mockEntry(overrides: Record<string, unknown> = {}) {
  return {
    draftId: "draft_1",
    ideaId: "idea_1",
    headline: "Le premier draft",
    bodyPreview: "Preview 1",
    bodyMarkdown: "Full body 1",
    qualityScore: 0.75,
    createdAt: new Date(Date.now() - 6 * DAY).toISOString(),
    tags: ["ia"],
    status: "draft",
    pillarLabel: "Technical",
    sourceDraftId: null,
    // Les quatre champs de l'ecran de triage. Une fixture qui ne les porte pas
    // exerce une forme de donnee qui ne peut pas exister en production.
    ideaTitle: "Sujet de reference",
    versionCount: 3,
    lastVersionAt: new Date(Date.now() - DAY).toISOString(),
    triage: "a-relire",
    ...overrides
  };
}

function mockLibrary(overrides: Record<string, unknown> = {}) {
  return {
    listEntries: vi.fn().mockResolvedValue([mockEntry()]),
    searchEntries: vi.fn().mockResolvedValue([]),
    createVariantFromDraft: vi.fn(),
    updateEntryText: vi.fn().mockResolvedValue(undefined),
    createDivergentVariant: vi.fn().mockResolvedValue(mockEntry({ draftId: "draft_variant" })),
    deleteEntry: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function installIpc(library: ReturnType<typeof mockLibrary>) {
  window.linkedinPoster = {
    platform: "darwin",
    appName: "GhostwrAIter",
    strategy: { getActiveBundle: vi.fn(), saveBundle: vi.fn() },
    ideas: { listIdeas: vi.fn(), createIdea: vi.fn() },
    workshop: {
      generateFromIdea: vi.fn(),
      correctDraft: vi.fn(),
      getSessionByIdeaId: vi.fn()
    },
    library,
    calendar: { listItems: vi.fn().mockResolvedValue([]), scheduleDraft: vi.fn() },
    execution: {
      listRuns: vi.fn().mockResolvedValue([]),
      getDiagnostics: vi.fn().mockResolvedValue({
        activeEngine: "codex",
        engines: [],
        availableSkills: [],
        message: ""
      }),
      openRunLog: vi.fn()
    },
    settings: {
      exportWorkspace: vi.fn(),
      countExecutionLogs: vi.fn(),
      purgeExecutionLogs: vi.fn(),
      getPreference: vi.fn().mockResolvedValue({ key: "theme", value: null }),
      setPreference: vi.fn(),
      getAllPreferences: vi.fn(),
      detectEngines: vi.fn(),
      getActiveEngine: vi.fn(),
      setActiveEngine: vi.fn()
    }
  } as unknown as typeof window.linkedinPoster;
}

function renderScreen() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <LibraryScreen />
      </MemoryRouter>
    </ToastProvider>
  );
}

async function loaded(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector(".library-triage")).toBeTruthy();
  });
}

const rowTitles = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll(".library-triage-row__title")].map((node) => node.textContent);

/*
 * Les assertions passent par les classes de l'ecran plutot que par le texte : un
 * titre de brouillon paraît deux fois, dans sa ligne de triage et en tete du
 * volet de lecture. C'est le principe de l'ecran, pas un defaut.
 */
describe("LibraryScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("rend les brouillons persistes et delegue la recherche au processus principal", async () => {
    const user = userEvent.setup();
    const searchEntries = vi
      .fn()
      .mockResolvedValue([
        mockEntry({ draftId: "draft_2", headline: "Le second draft", pillarLabel: "Strategy" })
      ]);

    installIpc(mockLibrary({ searchEntries }));

    const { container } = renderScreen();
    await loaded(container);

    expect(rowTitles(container)).toEqual(["Le premier draft"]);

    await user.type(screen.getByLabelText("Recherche"), "second");

    await waitFor(() => {
      expect(rowTitles(container)).toEqual(["Le second draft"]);
    });
    expect(searchEntries).toHaveBeenCalledWith({ query: "second" });

    // Une recherche active REMPLACE le jeu d'entrees : l'effectif dit alors ce
    // qu'il decrit, faute de quoi « 30 au total » mentirait sur trois resultats.
    expect(screen.getByText("1 résultat")).toBeTruthy();
  });

  it("filtre par entree de triage et enchaine la variante divergente sur confirmation", async () => {
    const user = userEvent.setup();
    let resolveVariant: (() => void) | undefined;

    installIpc(
      mockLibrary({
        listEntries: vi.fn().mockResolvedValue([
          mockEntry({
            draftId: "draft_1",
            headline: "Draft planifie",
            status: "scheduled",
            triage: "planifie"
          }),
          mockEntry({
            draftId: "draft_2",
            headline: "Draft en cours",
            status: "draft",
            triage: "a-relire",
            versionCount: 1
          })
        ]),
        createDivergentVariant: vi.fn().mockReturnValue(
          new Promise<void>((resolve) => {
            resolveVariant = resolve;
          })
        )
      })
    );

    const { container } = renderScreen();
    await loaded(container);

    // L'entree « À relire » est la premiere non vide : elle s'ouvre d'office.
    expect(rowTitles(container)).toEqual(["Draft en cours"]);

    await user.click(screen.getByRole("button", { name: /Planifiés/ }));
    expect(rowTitles(container)).toEqual(["Draft planifie"]);

    // Le contrat teste reste « Variante -> Confirmer ? ». Seul le chemin d'acces
    // change : les actions secondaires ne vivent plus sur chaque ligne mais sur
    // le post lu, derriere un revelateur unique.
    await user.click(screen.getByRole("button", { name: /Autres actions/ }));

    await user.click(screen.getByRole("button", { name: "Variante" }));
    expect(await screen.findByRole("button", { name: "Confirmer ?" })).toBeTruthy();

    resolveVariant?.();
  });

  /**
   * Le contrat de donnees, exerce a travers la surface de preload COMPLETE.
   *
   * Ce fichier est la seule suite de l'ecran qui monte `window.linkedinPoster`
   * entier plutot qu'un double reduit aux deux methodes appelees. C'est donc ici
   * que les quatre champs ajoutes le 25 juillet doivent etre exerces sur des
   * valeurs qui se ressemblent a la production : plusieurs brouillons sous le
   * meme `ideaTitle`, un jamais relu, un planifie. Une fixture qui les porte
   * sans les faire travailler prouve seulement que le type compile.
   */
  it("regroupe les variantes d'un meme sujet et marque celles qui n'ont jamais ete relues", async () => {
    const user = userEvent.setup();

    installIpc(
      mockLibrary({
        listEntries: vi.fn().mockResolvedValue([
          mockEntry({
            draftId: "d1",
            headline: "Devis : le client reconstruit la valeur",
            ideaTitle: "Devis et valeur perçue",
            versionCount: 4,
            triage: "a-relire"
          }),
          mockEntry({
            draftId: "d2",
            headline: "Devis : pourquoi il devrait signer",
            ideaTitle: "Devis et valeur perçue",
            versionCount: 1,
            triage: "a-relire"
          }),
          mockEntry({
            draftId: "d3",
            headline: "Devis : des lignes de prix",
            ideaTitle: "Devis et valeur perçue",
            versionCount: 1,
            triage: "a-relire"
          }),
          mockEntry({
            draftId: "d4",
            headline: "Un sujet sans variante",
            ideaTitle: "Agents IA et processus",
            versionCount: 2,
            triage: "a-relire"
          }),
          mockEntry({
            draftId: "d5",
            headline: "Celui qui a une date",
            ideaTitle: "Devis et valeur perçue",
            versionCount: 3,
            triage: "planifie"
          })
        ])
      })
    );

    const { container } = renderScreen();
    await loaded(container);

    // Deux sujets, le plus prolifique en tete, et sa mention de variantes.
    const sujets = [...container.querySelectorAll(".library-group__title")].map(
      (n) => n.textContent
    );
    expect(sujets).toEqual(["Devis et valeur perçue", "Agents IA et processus"]);
    expect(container.querySelector(".library-group__variants")?.textContent).toBe(
      "3 variantes du même sujet"
    );

    // Le plus abouti du sujet ouvre la liste et se lit a droite.
    expect(rowTitles(container)[0]).toBe("Devis : le client reconstruit la valeur");

    // Deux des trois variantes n'ont que leur generation.
    const marqueurs = [
      ...container.querySelectorAll(".library-triage-row .library-row__attention")
    ].map((n) => n.textContent);
    expect(marqueurs).toEqual(["jamais relu", "jamais relu"]);

    // Le planifie n'est pas dans cette entree : il a sa propre pile.
    expect(rowTitles(container)).not.toContain("Celui qui a une date");
    await user.click(screen.getByRole("button", { name: /Planifiés/ }));
    expect(rowTitles(container)).toEqual(["Celui qui a une date"]);
  });

  /**
   * Rien d'invisible et cliquable, mesure a la feuille appliquee.
   *
   * CE QUI A REMPLACE QUOI. Le modele precedent posait cinq actions sur chaque
   * ligne, quatre d'entre elles transparentes et neutralisees par
   * `pointer-events: none` jusqu'au survol. Le test mesurait cette
   * neutralisation. La refonte a supprime le procede : les actions portent le
   * seul post affiche et sont visibles en permanence. Le contrat qui reste est
   * l'autre moitie du meme raisonnement, et c'est celle qui compte : aucune
   * action de l'ecran n'est rendue transparente ou inerte par la feuille.
   *
   * La feuille est injectee a la main : vitest n'applique aucun CSS par defaut
   * (`document.styleSheets.length` vaut 0, mesure), et sans elle
   * `getComputedStyle` renverrait les valeurs initiales du navigateur, soit une
   * conclusion etrangere au sujet. Le fichier est lu par `node:fs` et non par un
   * import `?raw` : vitest stube les modules CSS, `?raw` y renvoie une chaine
   * vide (mesure).
   */
  it("ne rend aucune action du volet de lecture transparente ni inerte", async () => {
    installIpc(mockLibrary());

    const style = document.createElement("style");
    style.textContent = readFileSync(
      path.join(process.cwd(), "app/renderer/src/features/library/library.css"),
      "utf8"
    );
    document.head.appendChild(style);

    try {
      const { container } = renderScreen();
      await loaded(container);

      // Garde-fou de la mesure : sans feuille appliquee, les assertions qui
      // suivent liraient les valeurs initiales du navigateur.
      expect(document.styleSheets.length).toBeGreaterThan(0);

      const actions = [
        ...container.querySelectorAll<HTMLButtonElement>(".library-reader__buttons button")
      ];
      expect(actions.length).toBeGreaterThanOrEqual(5);

      for (const action of actions) {
        expect(getComputedStyle(action).pointerEvents).not.toBe("none");
        expect(getComputedStyle(action).opacity).toBe("1");
      }

      // Les lignes de triage non plus : elles ne portent aucune action, donc
      // rien ne s'y revele et rien n'y est masque.
      const row = container.querySelector<HTMLButtonElement>(".library-triage-row");
      expect(row).toBeTruthy();
      expect(getComputedStyle(row!).pointerEvents).not.toBe("none");
      expect(row!.querySelector("button")).toBeNull();
    } finally {
      style.remove();
    }
  });
});

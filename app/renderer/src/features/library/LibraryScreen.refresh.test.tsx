// @vitest-environment jsdom
/*
 * Coherence de la liste apres une mutation, et pendant une recherche.
 *
 * 1. RECHARGEMENT NON FILTRE. Apres un enregistrement, une suppression, une
 *    planification ou une variante, l ecran rappelait `listEntries()`, qui rend
 *    le jeu COMPLET. Chercher « devis » (3 resultats), modifier un brouillon
 *    puis enregistrer ramenait donc les 30 brouillons a l ecran pendant que le
 *    champ affichait toujours « devis » et que le compteur annoncait
 *    « 30 résultats ». Le libelle du compteur se decide sur le contenu du champ,
 *    il devenait donc faux en meme temps que la liste.
 *
 * 2. COURSE ENTRE DEUX FRAPPES. `handleSearch` partait a chaque touche sans
 *    jeton ni annulation : la reponse d une requete ancienne pouvait arriver
 *    apres une plus recente et repeindre la liste avec un resultat perime, sous
 *    un champ qui affiche autre chose.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { LibraryEntry } from "@shared/types/library";
import { ToastProvider } from "../../feedback/ToastProvider";
import { LibraryScreen } from "./LibraryScreen";

const DAY = 86_400_000;

// Instant FIGE : une fixture qui lit l horloge mesure la machine autant que le
// code. Un decalage d une milliseconde entre deux entrees a suffi a inverser un
// ordre en integration continue Windows, sur un test vert en local depuis des
// semaines.
const MAINTENANT = Date.parse("2026-07-26T12:00:00.000Z");
const daysAgo = (d: number) => new Date(MAINTENANT - d * DAY).toISOString();

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    draftId: "draft_1",
    ideaId: "idea_1",
    headline: "Un brouillon",
    bodyPreview: "Apercu",
    bodyMarkdown: "Corps du brouillon",
    qualityScore: 0.8,
    createdAt: daysAgo(6),
    status: "draft",
    pillarLabel: "Adoption IA",
    tags: [],
    sourceDraftId: null,
    ideaTitle: "Un sujet",
    targetIcpSegment: null,
    versionCount: 3,
    lastVersionAt: daysAgo(1),
    triage: "a-relire",
    ...overrides
  };
}

const TOUS = [
  entry({ draftId: "a", headline: "Devis et valeur perçue", ideaTitle: "Devis" }),
  entry({ draftId: "b", headline: "Recruter sans jargon", ideaTitle: "Recrutement" }),
  entry({ draftId: "c", headline: "Adoption terrain", ideaTitle: "Adoption" })
];
const FILTRES = [TOUS[0]!];

function installApi(over: Record<string, unknown> = {}) {
  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
    library: {
      listEntries: vi.fn().mockResolvedValue(TOUS),
      searchEntries: vi.fn().mockResolvedValue(FILTRES),
      updateEntryText: vi.fn().mockResolvedValue(undefined),
      createDivergentVariant: vi.fn(),
      deleteEntry: vi.fn().mockResolvedValue(undefined),
      ...over
    },
    calendar: { listItems: vi.fn().mockResolvedValue([]), scheduleDraft: vi.fn() }
  };
}

function renderLibrary() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <LibraryScreen />
      </ToastProvider>
    </MemoryRouter>
  );
}

const lignes = (c: HTMLElement) => c.querySelectorAll(".library-triage-row").length;

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("Bibliotheque, coherence apres mutation", () => {
  it("garde la recherche active apres un enregistrement", async () => {
    const user = userEvent.setup();
    installApi();
    const { container } = renderLibrary();
    await waitFor(() => expect(lignes(container)).toBe(3));

    await user.type(screen.getByLabelText("Recherche"), "devis");
    await waitFor(() => expect(lignes(container)).toBe(1));

    await user.click(screen.getByRole("button", { name: "Modifier" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    // La liste reste celle de la recherche : le champ dit « devis », le compteur
    // aussi, et les trois doivent s accorder.
    await waitFor(() =>
      expect(screen.getByText(/1 résultat/)).toBeTruthy()
    );
    expect(lignes(container)).toBe(1);
  });

  it("recharge le jeu complet quand aucune recherche n est active", async () => {
    // Garde : le correctif ne doit pas filtrer une liste qui ne l etait pas.
    const user = userEvent.setup();
    installApi();
    const { container } = renderLibrary();
    await waitFor(() => expect(lignes(container)).toBe(3));

    await user.click(screen.getByRole("button", { name: "Modifier" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(screen.getByText(/3 au total/)).toBeTruthy());
    expect(lignes(container)).toBe(3);
  });
});

describe("Bibliotheque, course entre deux frappes", () => {
  it("ignore la reponse d une recherche depassee", async () => {
    const user = userEvent.setup();
    // La requete « d » traine, « de » repond tout de suite : sans jeton, la
    // reponse de « d » arrive en dernier et repeint la liste.
    let resoudreLente!: (v: LibraryEntry[]) => void;
    const lente = new Promise<LibraryEntry[]>((r) => {
      resoudreLente = r;
    });
    const searchEntries = vi
      .fn()
      .mockReturnValueOnce(lente)
      .mockResolvedValue(FILTRES);
    installApi({ searchEntries });

    const { container } = renderLibrary();
    await waitFor(() => expect(lignes(container)).toBe(3));

    await user.type(screen.getByLabelText("Recherche"), "de");
    await waitFor(() => expect(searchEntries).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(lignes(container)).toBe(1));

    // La reponse perimee arrive maintenant, avec les trois entrees.
    resoudreLente(TOUS);
    await new Promise((r) => setTimeout(r, 20));

    expect(lignes(container)).toBe(1);
  });
});

describe("Bibliotheque, retour du planning vers les brouillons", () => {
  it("selectionne le brouillon vise, et pas seulement l onglet", async () => {
    const user = userEvent.setup();
    // Le brouillon vise est « prêt », donc dans une AUTRE entree de triage que
    // celle ouverte par defaut : c est le cas ou l onglet seul ne montre rien.
    const brouillons = [
      entry({ draftId: "a", headline: "À relire d abord", triage: "a-relire" }),
      entry({ draftId: "z", headline: "Le post planifié", triage: "pret" })
    ];
    (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
      library: {
        listEntries: vi.fn().mockResolvedValue(brouillons),
        searchEntries: vi.fn().mockResolvedValue(brouillons),
        updateEntryText: vi.fn(),
        createDivergentVariant: vi.fn(),
        deleteEntry: vi.fn()
      },
      calendar: {
        listItems: vi.fn().mockResolvedValue([
          {
            id: "cal_1",
            draftId: "z",
            draftHeadline: "Le post planifié",
            plannedDate: "2026-08-01",
            status: "planned",
            pillarLabel: "Adoption IA"
          }
        ]),
        scheduleDraft: vi.fn()
      }
    };

    const { container } = renderLibrary();
    await user.click(await screen.findByRole("tab", { name: "Planning" }));
    await user.click(await screen.findByRole("button", { name: "Voir dans les brouillons" }));

    // Le volet de lecture montre bien le post vise, et non celui de l entree
    // ouverte par defaut.
    await waitFor(() => {
      expect(container.querySelector(".library-reader__title")?.textContent).toBe(
        "Le post planifié"
      );
    });
  });
});

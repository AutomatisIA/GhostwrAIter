// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../feedback/ToastProvider";
import { LibraryScreen } from "./LibraryScreen";

/**
 * Test d'integration a11y leger (T050).
 *
 * Verifie qu'un ecran cle (la Bibliotheque) expose les roles attendus de la
 * primitive Tabs (tablist/tab + aria-selected) et que l'ordre de focus clavier
 * est coherent (roving tabindex : seul l'onglet actif est dans l'ordre de
 * tabulation). L'ecran est enveloppe dans ToastProvider (consomme via useToast)
 * et MemoryRouter (consomme via useSearchParams/useNavigate).
 */

function renderLibrary() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <LibraryScreen />
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  // Surface IPC minimale appelee au montage de l'ecran.
  (globalThis as unknown as { window: Window }).window.linkedinPoster = {
    library: {
      listEntries: vi.fn().mockResolvedValue([]),
      searchEntries: vi.fn().mockResolvedValue([])
    },
    calendar: {
      listItems: vi.fn().mockResolvedValue([])
    }
  } as unknown as typeof window.linkedinPoster;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LibraryScreen a11y", () => {
  it("expose un tablist avec ses onglets et aria-selected", async () => {
    renderLibrary();

    const tablist = await screen.findByRole("tablist", {
      name: "Vues de la bibliothèque"
    });
    expect(tablist).toBeTruthy();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.textContent).toContain("Brouillons");
    expect(tabs[1]!.textContent).toContain("Planning");

    // L'onglet « Brouillons » est selectionne par defaut.
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("false");
  });

  it("respecte le roving tabindex (ordre de focus coherent)", async () => {
    renderLibrary();

    await screen.findByRole("tablist");
    const tabs = screen.getAllByRole("tab");

    // Seul l'onglet selectionne est atteignable via Tab ; les autres sont
    // navigables aux fleches (tabindex -1), ce qui garde un ordre de focus net.
    expect(tabs[0]!.getAttribute("tabindex")).toBe("0");
    expect(tabs[1]!.getAttribute("tabindex")).toBe("-1");
  });

  it("ne laisse aucune action principale hors de portee clavier (boutons natifs)", async () => {
    renderLibrary();

    // Attendre la fin du chargement (les effets de montage se resolvent).
    await waitFor(() => {
      expect(window.linkedinPoster.library.listEntries).toHaveBeenCalled();
    });

    // Tout element interactif rendu est un <button>/<a>/[role=tab] natif et
    // donc focusable au clavier : aucun handler souris-only.
    const tabs = screen.getAllByRole("tab");
    for (const tab of tabs) {
      expect(tab.tagName).toBe("BUTTON");
    }
  });
});

/**
 * Contrat des actions de ligne (correctifs de presentation, juillet 2026).
 *
 * Les tests ci-dessus rendent une bibliotheque VIDE : aucune ligne, donc aucune
 * action, donc aucune garantie sur l'acces clavier aux actions de ligne. Le bloc
 * ci-dessous rend de vraies entrees et verifie les trois contraintes qui se
 * contredisent en apparence :
 *
 *   1. les cinq actions restent atteignables au clavier ;
 *   2. aucune action destructive n'est cliquable derriere un element invisible ;
 *   3. le repli se fait au clavier (Echap) et rend le focus a son declencheur.
 *
 * REVISION DE LA PREUVE DE LA CONTRAINTE 2. Elle etait prouvee par l'ABSENCE du
 * bouton dans le DOM. Depuis que les quatre actions se decouvrent au survol et
 * au focus de la ligne, elles sont DANS le DOM au repos, rendues transparentes
 * et neutralisees par `pointer-events: none`. Le contrat n'a pas bouge, son
 * moyen de preuve si : on mesure desormais `pointer-events` sur le bouton
 * reellement rendu.
 *
 * Cette mesure impose d'injecter la feuille : vitest n'applique aucun CSS par
 * defaut (mesure : `document.styleSheets.length` vaut 0, et un
 * `getComputedStyle` y renvoie les valeurs initiales du navigateur). Un test
 * ecrit sans cette injection aurait lu `auto` et conclu a l'inverse du vrai.
 *
 * CE QUI RESTE HORS DE PORTEE. jsdom n'evalue pas `:focus-within` : apres un
 * `focus()` sur un bouton du groupe, `pointer-events` y reste `none` (mesure).
 * La revelation au focus clavier n'est donc verifiee par aucun test ici.
 */
const SECONDARY_ACTIONS = ["Variante", "Planifier", "Retravailler", "Supprimer"];

function libraryEntry(overrides: Record<string, unknown> = {}) {
  return {
    draftId: "draft_1",
    ideaId: "idea_1",
    headline: "Un brouillon a reconnaitre",
    bodyPreview: "Apercu",
    bodyMarkdown: "Corps du brouillon",
    qualityScore: 0.8,
    createdAt: new Date().toISOString(),
    tags: ["agents", "entreprises", "française", "apprentissage", "generative"],
    status: "draft",
    pillarLabel: "Adoption IA",
    sourceDraftId: null,
    ...overrides
  };
}

function renderWithEntries(entries: ReturnType<typeof libraryEntry>[]) {
  (globalThis as unknown as { window: Window }).window.linkedinPoster = {
    library: {
      listEntries: vi.fn().mockResolvedValue(entries),
      searchEntries: vi.fn().mockResolvedValue([]),
      createDivergentVariant: vi.fn(),
      updateEntryText: vi.fn(),
      deleteEntry: vi.fn()
    },
    calendar: {
      listItems: vi.fn().mockResolvedValue([]),
      scheduleDraft: vi.fn()
    }
  } as unknown as typeof window.linkedinPoster;

  return render(
    <MemoryRouter>
      <ToastProvider>
        <LibraryScreen />
      </ToastProvider>
    </MemoryRouter>
  );
}

function renderLibraryWithEntries() {
  return renderWithEntries([libraryEntry()]);
}

describe("LibraryScreen actions de ligne", () => {
  it("garde les cinq actions dans l'ordre de tabulation au repos", async () => {
    renderLibraryWithEntries();

    await screen.findByText("Un brouillon a reconnaitre");

    // « Modifier » et le revelateur restent en clair : c'est l'etat de repos que
    // la maquette demande.
    expect(screen.getByRole("button", { name: "Modifier" })).toBeTruthy();

    const disclosure = screen.getByRole("button", { name: /Autres actions/ });
    expect(disclosure.tagName).toBe("BUTTON");
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");

    // Les quatre autres sont dans le DOM, sans attribut qui les retire de la
    // tabulation. Leur neutralisation a la souris est mesuree ailleurs, dans
    // `tests/unit/library-screen.test.tsx`, qui peut charger la feuille.
    for (const label of SECONDARY_ACTIONS) {
      const action = screen.getByRole("button", { name: label });
      expect(action.tagName).toBe("BUTTON");
      expect(action.getAttribute("tabindex")).toBeNull();
      expect(action.hasAttribute("hidden")).toBe(false);
    }
  });

  it("ne montre jamais les memes actions deux fois sur une ligne", async () => {
    const user = userEvent.setup();
    renderLibraryWithEntries();

    await screen.findByText("Un brouillon a reconnaitre");

    // Au repos, les actions vivent dans le groupe revele.
    for (const label of SECONDARY_ACTIONS) {
      expect(screen.getAllByRole("button", { name: label })).toHaveLength(1);
    }

    await user.click(screen.getByRole("button", { name: /Autres actions/ }));

    // Panneau ouvert, elles vivent dans le panneau, et le groupe revele n'est
    // plus rendu : sinon la meme ligne porterait « Supprimer » a deux endroits.
    for (const label of SECONDARY_ACTIONS) {
      expect(screen.getAllByRole("button", { name: label })).toHaveLength(1);
    }
    expect(document.querySelector(".library-row__actions-extra")).toBeNull();
  });

  it("expose les quatre actions secondaires apres activation au clavier", async () => {
    const user = userEvent.setup();
    renderLibraryWithEntries();

    await screen.findByText("Un brouillon a reconnaitre");

    const disclosure = screen.getByRole("button", { name: /Autres actions/ });
    disclosure.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(disclosure.getAttribute("aria-expanded")).toBe("true");
    });

    // Le panneau annonce est bien celui qui est rendu.
    const panelId = disclosure.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toBeTruthy();

    for (const label of SECONDARY_ACTIONS) {
      const action = screen.getByRole("button", { name: label });
      expect(action.tagName).toBe("BUTTON");
    }
  });

  it("referme le panneau sur Echap et rend le focus au revelateur", async () => {
    const user = userEvent.setup();
    renderLibraryWithEntries();

    await screen.findByText("Un brouillon a reconnaitre");

    const disclosure = screen.getByRole("button", { name: /Autres actions/ });
    disclosure.focus();
    await user.keyboard("{Enter}");

    const panelId = disclosure.getAttribute("aria-controls")!;
    const deleteButton = await screen.findByRole("button", { name: "Supprimer" });
    deleteButton.focus();
    await user.keyboard("{Escape}");

    // C'est le PANNEAU qui doit disparaitre. « Supprimer » reste dans le DOM :
    // il retourne au groupe revele de la ligne, ou `pointer-events: none` le
    // neutralise (verifie par le test de l'etat de repos).
    await waitFor(() => {
      expect(document.getElementById(panelId)).toBeNull();
    });
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(disclosure);
  });
});

describe("LibraryScreen rangee de metadonnees", () => {
  it("plafonne les mots cles a trois, separes par des virgules, et replie le reste", async () => {
    const { container } = renderLibraryWithEntries();

    await screen.findByText("Un brouillon a reconnaitre");

    // Trois mots cles en clair, pas cinq, et separes par des virgules : le point
    // median est reserve aux metadonnees de nature differente.
    const tagList = container.querySelector(".library-row__tag-list");
    expect(tagList?.textContent).toBe("agents, entreprises, française");

    // Le reste tient dans un seul fragment, detail complet dans son `title`.
    const more = container.querySelector(".library-row__more");
    expect(more?.textContent).toBe("+2");
    expect(more?.getAttribute("title")).toBe("apprentissage, generative");
  });

  it("accole la pastille au nom du pilier plutot que de l'ouvrir sans referent", async () => {
    const { container } = renderLibraryWithEntries();

    await screen.findByText("Un brouillon a reconnaitre");

    // La pastille existe, mais DANS le fragment du pilier : posee en tete de
    // rangee, `MetaLine` inserait un point median derriere elle et la ligne
    // s'ouvrait sur « · Brouillon », une puce sans referent.
    const pillar = container.querySelector(".library-row__pillar");
    expect(pillar?.querySelector(".library-row__dot")).toBeTruthy();
    expect(pillar?.querySelector(".library-row__pillar-name")?.textContent).toBe("Adoption IA");

    const meta = container.querySelector(".library-row__meta");
    expect(meta?.firstElementChild).toBe(pillar);
  });

  it("tait le statut « Brouillon » et ne garde que celui qui sort de l'ordinaire", async () => {
    const { container } = renderWithEntries([
      libraryEntry({ draftId: "d1", headline: "Brouillon ordinaire", status: "draft" }),
      libraryEntry({ draftId: "d2", headline: "Une variante", status: "variant" })
    ]);

    await screen.findByText("Brouillon ordinaire");

    // Assertions portees sur les rangees de metadonnees et non sur la page :
    // le filtre de statut de la barre d'ecran contient legitimement une option
    // « Brouillon », qu'une recherche globale confondrait avec la ligne.
    const statuses = [...container.querySelectorAll(".library-row__status")].map(
      (node) => node.textContent
    );

    // L'onglet dit deja « Brouillons » : le repeter sur chaque ligne n'apprend
    // rien. « Variante », lui, distingue reellement deux lignes.
    expect(statuses).toEqual(["Variante"]);
  });

  it("resume la section en une phrase : effectif puis longueur moyenne", async () => {
    const { container } = renderWithEntries([
      libraryEntry({ draftId: "d1", headline: "Mille", bodyMarkdown: "a".repeat(1000) }),
      libraryEntry({ draftId: "d2", headline: "Mille soixante", bodyMarkdown: "b".repeat(1060) })
    ]);

    await screen.findByText("Mille soixante");

    // Compare le `textContent` brut : `toLocaleString("fr-FR")` pose une espace
    // insecante etroite comme separateur de milliers, que le normaliseur de
    // testing-library replie du seul cote du DOM. Moyenne de 1 000 et 1 060.
    expect(container.querySelector(".library-head__count")?.textContent).toBe(
      `2, longueur moyenne ${(1030).toLocaleString("fr-FR")} caractères`
    );
  });
});

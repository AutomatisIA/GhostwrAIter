// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { LibraryEntry } from "@shared/types/library";
import { ToastProvider } from "../../feedback/ToastProvider";
import { LibraryScreen } from "./LibraryScreen";

/**
 * Contrat d accessibilite de l ecran Bibliotheque.
 *
 * Deux blocs. Le premier tient sur une bibliotheque VIDE et couvre la bascule de
 * vue, qui existe dans tous les etats. Le second rend de vraies entrees et
 * couvre l ecran de triage : entrees de tri, lignes selectionnables, repli des
 * variantes, panneau d actions du post lu.
 *
 * CE QUI A CHANGE, ET POURQUOI CE FICHIER A ETE REECRIT. L ecran ne repose plus
 * sur un modele de ligne portant cinq actions revelees au survol. Les actions
 * ont quitte la ligne pour le post selectionne, ou elles sont visibles en
 * permanence : la contrainte « rien d invisible et cliquable » n a donc plus
 * d objet ici, et les tests qui la prouvaient par `pointer-events` ont ete
 * retires plutot que maquilles. Ce qu il reste a prouver, c est que tout ce qui
 * agit est un bouton natif, correctement etiquete, et que les etats ouverts et
 * selectionnes sont annonces.
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

const DAY = 86_400_000;

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    draftId: "draft_1",
    ideaId: "idea_1",
    headline: "Un brouillon a reconnaitre",
    bodyPreview: "Apercu",
    bodyMarkdown: "Corps du brouillon",
    qualityScore: 0.8,
    createdAt: new Date(Date.now() - 6 * DAY).toISOString(),
    status: "draft",
    pillarLabel: "Adoption IA",
    tags: ["agents", "entreprises", "française", "apprentissage", "generative"],
    sourceDraftId: null,
    ideaTitle: "Devis et valeur perçue",
    versionCount: 3,
    lastVersionAt: new Date(Date.now() - DAY).toISOString(),
    triage: "a-relire",
    ...overrides
  };
}

function renderWithEntries(entries: LibraryEntry[]) {
  (globalThis as unknown as { window: Window }).window.linkedinPoster = {
    library: {
      listEntries: vi.fn().mockResolvedValue(entries),
      searchEntries: vi.fn().mockResolvedValue(entries),
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

async function loaded(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector(".library-triage")).toBeTruthy();
  });
}

describe("LibraryScreen triage, contrat clavier", () => {
  it("annonce l entree de triage active par aria-pressed, une seule a la fois", async () => {
    const { container } = renderWithEntries([entry()]);
    await loaded(container);

    const buckets = [...container.querySelectorAll<HTMLButtonElement>(".library-bucket")];
    expect(buckets).toHaveLength(3);
    for (const bucket of buckets) {
      expect(bucket.tagName).toBe("BUTTON");
    }

    const pressed = buckets.filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]!.textContent).toContain("À relire");

    await userEvent.click(buckets[1]!);
    expect(buckets[1]!.getAttribute("aria-pressed")).toBe("true");
    expect(buckets[0]!.getAttribute("aria-pressed")).toBe("false");
  });

  it("fait de chaque ligne un bouton natif et annonce celle qui est lue", async () => {
    const { container } = renderWithEntries([
      entry({ draftId: "a", headline: "Premier" }),
      entry({ draftId: "b", headline: "Second", versionCount: 2 })
    ]);
    await loaded(container);

    const rows = [...container.querySelectorAll<HTMLButtonElement>(".library-triage-row")];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.tagName).toBe("BUTTON");
      expect(row.getAttribute("tabindex")).toBeNull();
    }

    // Une seule ligne porte `aria-current` : c'est celle dont le texte est
    // affiche a droite.
    const current = rows.filter((row) => row.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);

    await userEvent.click(rows[1]!);
    expect(rows[1]!.getAttribute("aria-current")).toBe("true");
    expect(rows[0]!.getAttribute("aria-current")).toBeNull();
  });

  it("nomme chaque sujet par un titre de niveau deux", async () => {
    const { container } = renderWithEntries([entry()]);
    await loaded(container);

    const heading = screen.getByRole("heading", { level: 2, name: /Devis et valeur perçue/ });
    expect(heading).toBeTruthy();
    expect(container.querySelector(".library-group__rows")?.tagName).toBe("UL");
  });

  it("annonce le repli des variantes par aria-expanded", async () => {
    const { container } = renderWithEntries([
      entry({ draftId: "a", headline: "Une", versionCount: 5 }),
      entry({ draftId: "b", headline: "Deux", versionCount: 4 }),
      entry({ draftId: "c", headline: "Trois", versionCount: 3 }),
      entry({ draftId: "d", headline: "Quatre", versionCount: 2 })
    ]);
    await loaded(container);

    const toggle = screen.getByRole("button", { name: /Une variante de plus, repliée/ });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: /Une variante de plus, affichée/ }).getAttribute(
        "aria-expanded"
      )
    ).toBe("true");
  });

  it("relie le revelateur au panneau qu il ouvre, et n en annonce aucun quand il est ferme", async () => {
    const user = userEvent.setup();
    const { container } = renderWithEntries([entry()]);
    await loaded(container);

    const disclosure = screen.getByRole("button", { name: /Autres actions/ });
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    expect(disclosure.getAttribute("aria-controls")).toBeNull();

    disclosure.focus();
    await user.keyboard("{Enter}");

    const panelId = disclosure.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toBeTruthy();
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");
  });

  /*
   * Le panneau est monte et demonte, jamais rendu transparent : aucune action
   * destructive ne reste cliquable derriere un element invisible. C est la
   * contrainte que l ancien modele de ligne prouvait par `pointer-events` ; ici
   * elle se prouve par l absence pure et simple du bouton.
   */
  it("ne laisse « Supprimer » nulle part tant que le panneau est ferme", async () => {
    const { container } = renderWithEntries([entry()]);
    await loaded(container);

    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    expect(container.querySelector(".library-actions")).toBeNull();
  });

  it("laisse l onglet Planning fonctionner apres la refonte du triage", async () => {
    const { container } = renderWithEntries([entry()]);
    await loaded(container);

    await userEvent.click(screen.getAllByRole("tab")[1]!);

    await waitFor(() => {
      expect(screen.getByText("Aucune publication planifiée")).toBeTruthy();
    });
    // La branche Planning ne vit PAS dans l enveloppe pleine largeur du triage :
    // elle ecrit dans le corps de page rembourre et defilant.
    expect(container.querySelector(".library-triage")).toBeNull();
  });
});

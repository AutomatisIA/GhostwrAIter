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
 * Contrat du revelateur d'actions de ligne (correctif de presentation, juillet
 * 2026).
 *
 * Les tests ci-dessus rendent une bibliotheque VIDE : aucune ligne, donc aucune
 * action, donc aucune garantie sur l'acces clavier aux actions de ligne. Le bloc
 * ci-dessous rend de vraies entrees et verifie les trois contraintes qui se
 * contredisent en apparence :
 *
 *   1. les cinq actions restent atteignables au clavier ;
 *   2. aucune action destructive n'est cliquable derriere un element invisible,
 *      ce qui se prouve par l'ABSENCE du bouton dans le DOM, pas par une lecture
 *      du CSS ;
 *   3. le repli se fait au clavier (Echap) et rend le focus a son declencheur.
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

function renderLibraryWithEntries() {
  (globalThis as unknown as { window: Window }).window.linkedinPoster = {
    library: {
      listEntries: vi.fn().mockResolvedValue([libraryEntry()]),
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

describe("LibraryScreen actions de ligne", () => {
  it("garde les actions secondaires hors du DOM tant que le revelateur est replie", async () => {
    renderLibraryWithEntries();

    await screen.findByText("Un brouillon a reconnaitre");

    // « Modifier » reste en clair : c'est l'action primaire de la ligne.
    expect(screen.getByRole("button", { name: "Modifier" })).toBeTruthy();

    const disclosure = screen.getByRole("button", { name: /Autres actions/ });
    expect(disclosure.tagName).toBe("BUTTON");
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");

    // Rien de destructif ne subsiste derriere un element masque.
    for (const label of SECONDARY_ACTIONS) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
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

    const deleteButton = await screen.findByRole("button", { name: "Supprimer" });
    deleteButton.focus();
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    });
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(disclosure);
  });
});

describe("LibraryScreen rangee de metadonnees", () => {
  it("plafonne les etiquettes affichees et replie le reste dans un « +N » titre", async () => {
    const { container } = renderLibraryWithEntries();

    await screen.findByText("Un brouillon a reconnaitre");

    // Trois etiquettes en clair, pas cinq.
    const tags = container.querySelectorAll(".library-row__tag");
    expect(tags).toHaveLength(3);
    expect([...tags].map((tag) => tag.textContent)).toEqual([
      "agents",
      "entreprises",
      "française"
    ]);

    // Le reste tient dans un seul fragment, detail complet dans son `title`.
    const more = container.querySelector(".library-row__more");
    expect(more?.textContent).toBe("+2");
    expect(more?.getAttribute("title")).toBe("apprentissage, generative");
  });

  it("n'ouvre plus la rangee par une pastille decorative", async () => {
    const { container } = renderLibraryWithEntries();

    await screen.findByText("Un brouillon a reconnaitre");

    expect(container.querySelector(".library-row__dot")).toBeNull();
  });
});

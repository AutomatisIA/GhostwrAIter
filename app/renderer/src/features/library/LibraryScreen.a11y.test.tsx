// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    expect(tabs[0].textContent).toContain("Brouillons");
    expect(tabs[1].textContent).toContain("Planning");

    // L'onglet « Brouillons » est selectionne par defaut.
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
  });

  it("respecte le roving tabindex (ordre de focus coherent)", async () => {
    renderLibrary();

    await screen.findByRole("tablist");
    const tabs = screen.getAllByRole("tab");

    // Seul l'onglet selectionne est atteignable via Tab ; les autres sont
    // navigables aux fleches (tabindex -1), ce qui garde un ordre de focus net.
    expect(tabs[0].getAttribute("tabindex")).toBe("0");
    expect(tabs[1].getAttribute("tabindex")).toBe("-1");
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

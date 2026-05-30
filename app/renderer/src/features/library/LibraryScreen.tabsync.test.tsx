// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { ToastProvider } from "../../feedback/ToastProvider";
import { LibraryScreen } from "./LibraryScreen";

/**
 * Tests de synchronisation onglet actif <-> query `?view=planning` (finding
 * revue Codex). `activeTab` est DERIVE de `searchParams`, pas un state local
 * initialise au montage : naviguer vers `/bibliotheque?view=planning` alors
 * qu'on est deja sur `/bibliotheque` (sans remount) doit basculer l'onglet.
 */

function installFakeIpc() {
  (globalThis as unknown as { window: Window }).window.linkedinPoster = {
    library: {
      listEntries: vi.fn().mockResolvedValue([]),
      searchEntries: vi.fn().mockResolvedValue([])
    },
    calendar: {
      listItems: vi.fn().mockResolvedValue([])
    }
  } as unknown as typeof window.linkedinPoster;
}

/**
 * Bouton qui navigue vers une URL SANS changer de pathname (`/bibliotheque`
 * reste `/bibliotheque`, seule la query change) : reproduit le lien Cockpit
 * « Planifiés » / les redirections legacy quand on est deja sur la page.
 */
function NavigateToPlanning() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/bibliotheque?view=planning")}>
      aller-planning
    </button>
  );
}

beforeEach(() => {
  installFakeIpc();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LibraryScreen synchronisation onglet/URL", () => {
  it("ouvre l'onglet Planning quand l'URL initiale porte ?view=planning", async () => {
    render(
      <MemoryRouter initialEntries={["/bibliotheque?view=planning"]}>
        <ToastProvider>
          <LibraryScreen />
        </ToastProvider>
      </MemoryRouter>
    );

    const tabs = await screen.findAllByRole("tab");
    expect(tabs[1].textContent).toContain("Planning");
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(tabs[0].getAttribute("aria-selected")).toBe("false");
  });

  it("bascule sur Planning quand on navigue vers ?view=planning sur le meme pathname (pas de remount)", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/bibliotheque"]}>
        <ToastProvider>
          <NavigateToPlanning />
          <Routes>
            <Route path="/bibliotheque" element={<LibraryScreen />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    // Au depart : onglet Brouillons actif.
    const initialTabs = await screen.findAllByRole("tab");
    expect(initialTabs[0].getAttribute("aria-selected")).toBe("true");
    expect(initialTabs[1].getAttribute("aria-selected")).toBe("false");

    // Navigation same-pathname vers ?view=planning : l'onglet doit suivre.
    await user.click(screen.getByText("aller-planning"));

    await waitFor(() => {
      const tabs = screen.getAllByRole("tab");
      expect(tabs[1].getAttribute("aria-selected")).toBe("true");
      expect(tabs[0].getAttribute("aria-selected")).toBe("false");
    });
  });

  it("bascule via un clic sur l'onglet (switchTab -> setSearchParams -> derive)", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/bibliotheque"]}>
        <ToastProvider>
          <LibraryScreen />
        </ToastProvider>
      </MemoryRouter>
    );

    const tabs = await screen.findAllByRole("tab");
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");

    // Clic direct sur l'onglet Planning : `switchTab` ne fait plus que
    // `setSearchParams`, et l'onglet actif (derive de l'URL) doit suivre.
    await user.click(tabs[1]);

    await waitFor(() => {
      const next = screen.getAllByRole("tab");
      expect(next[1].getAttribute("aria-selected")).toBe("true");
      expect(next[0].getAttribute("aria-selected")).toBe("false");
    });
  });
});

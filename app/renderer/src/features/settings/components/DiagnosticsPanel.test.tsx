// @vitest-environment jsdom
/*
 * « Aucune génération enregistrée pour l'instant. » est une affirmation sur les
 * donnees. Elle ne doit sortir que quand la lecture a abouti ET n a rien rendu.
 *
 * `loading` etait initialise a `defaultExpanded` et jamais remis a `true` au
 * depliage : cliquer « Afficher l'historique des générations » affichait donc la
 * phrase pendant tout l aller-retour IPC, et DEFINITIVEMENT si l appel echouait,
 * le `.catch(() => {})` avalant l erreur. Un utilisateur venant diagnostiquer une
 * generation ratee s entend repondre qu il n en a jamais lance.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../feedback/ToastProvider";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

function installApi(listRuns: () => Promise<unknown>) {
  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
    execution: { listRuns: vi.fn(listRuns), openRunLog: vi.fn() }
  };
}

function renderPanel() {
  render(
    <ToastProvider>
      <DiagnosticsPanel />
    </ToastProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("Diagnostics, historique des generations", () => {
  it("ne pretend pas que l historique est vide pendant qu il charge", async () => {
    const user = userEvent.setup();
    // Lecture volontairement en attente : c est la fenetre exacte pendant
    // laquelle la phrase sortait.
    installApi(() => new Promise(() => {}));

    renderPanel();
    await user.click(screen.getByRole("button", { name: /Afficher l'historique/ }));

    expect(screen.queryByText(/Aucune génération enregistrée/)).toBeNull();
    expect(screen.getByText("Chargement…")).toBeTruthy();
  });

  it("dit que la lecture a echoue au lieu d annoncer un historique vide", async () => {
    const user = userEvent.setup();
    installApi(() => Promise.reject(new Error("database is locked")));

    renderPanel();
    await user.click(screen.getByRole("button", { name: /Afficher l'historique/ }));

    expect(await screen.findByText(/historique n'a pas pu être lu/)).toBeTruthy();
    expect(screen.queryByText(/Aucune génération enregistrée/)).toBeNull();
  });

  it("annonce l historique vide quand il est reellement vide", async () => {
    // Garde : le correctif ne doit pas supprimer le seul message du cas nominal.
    const user = userEvent.setup();
    installApi(() => Promise.resolve([]));

    renderPanel();
    await user.click(screen.getByRole("button", { name: /Afficher l'historique/ }));

    await waitFor(() =>
      expect(screen.getByText(/Aucune génération enregistrée/)).toBeTruthy()
    );
  });
});

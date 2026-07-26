// @vitest-environment jsdom
/*
 * Le pied de la barre laterale suit-il le moteur reellement actif ?
 *
 * Il est monte par la coque, qui ne se remonte jamais. Une lecture unique au
 * montage le figeait donc sur le moteur du demarrage : selectionner Antigravity
 * dans les Parametres affichait le toast « Antigravity est maintenant votre
 * moteur IA actif » pendant que le pied continuait d annoncer « Codex
 * (ChatGPT), connecté » jusqu a la fermeture de l application. Deux affirmations
 * contradictoires a l ecran en meme temps, et c est la plus discrete qui est
 * fausse.
 *
 * Le second test cable les deux vrais composants ensemble : c est le seul qui
 * prouve que l annonce part bien de la ou le moteur change.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../feedback/ToastProvider";
import { EnginePanel } from "../features/settings/components/EnginePanel";
import { ActiveEngineFooter } from "./ActiveEngineFooter";

function moteur(name: string, displayName: string) {
  return {
    name,
    displayName,
    installState: "authenticated" as const,
    installCommand: "",
    loginCommand: "",
    setupHint: ""
  };
}

/**
 * `getActiveEngine` suit un moteur courant mutable, comme le fait le processus
 * principal : un double qui rendrait toujours la meme valeur ne pourrait pas
 * distinguer « le pied relit » de « le pied ne relit pas ».
 */
function installApi() {
  const etat = { actif: "codex" };
  const catalogue: Record<string, ReturnType<typeof moteur>> = {
    codex: moteur("codex", "Codex (ChatGPT)"),
    antigravity: moteur("antigravity", "Antigravity")
  };

  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
    settings: {
      getActiveEngine: vi.fn(async () => ({
        engine: etat.actif,
        status: catalogue[etat.actif]
      })),
      detectEngines: vi.fn(async () => ({ engines: Object.values(catalogue) })),
      setActiveEngine: vi.fn(async (name: string) => {
        etat.actif = name;
        return { engine: name, status: catalogue[name] };
      })
    }
  };
  return etat;
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("Pied de la barre laterale, moteur actif", () => {
  it("relit le moteur quand un changement est annonce", async () => {
    const etat = installApi();
    render(<ActiveEngineFooter />);

    expect(await screen.findByText(/Codex \(ChatGPT\)/)).toBeTruthy();

    // Le moteur change ailleurs dans l application, puis l annonce part.
    etat.actif = "antigravity";
    const { annoncerChangementDeMoteur } = await import(
      "../features/settings/active-engine-events"
    );
    annoncerChangementDeMoteur();

    expect(await screen.findByText(/Antigravity/)).toBeTruthy();
    expect(screen.queryByText(/Codex \(ChatGPT\)/)).toBeNull();
  });

  it("suit une selection faite dans le panneau des Parametres", async () => {
    const user = userEvent.setup();
    installApi();

    render(
      <ToastProvider>
        <EnginePanel />
        <ActiveEngineFooter />
      </ToastProvider>
    );

    expect(await screen.findByText(/Codex \(ChatGPT\),/)).toBeTruthy();

    await user.click(await screen.findByRole("button", { name: "Sélectionner" }));

    await waitFor(() => {
      expect(screen.getByText(/Antigravity,/)).toBeTruthy();
    });
  });

  it("n annonce rien plutot qu un moteur incertain quand la lecture echoue", async () => {
    // Garde : le repli silencieux est volontaire. Un moteur affiche a tort est
    // pire qu aucun, parce que la generation echouera en nommant l autre.
    (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
      settings: { getActiveEngine: vi.fn().mockRejectedValue(new Error("nope")) }
    };

    const { container } = render(<ActiveEngineFooter />);

    await waitFor(() => {
      expect(window.linkedinPoster.settings.getActiveEngine).toHaveBeenCalled();
    });
    expect(container.querySelector(".sidebar-engine")).toBeNull();
  });
});

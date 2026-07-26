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

type EtatInstallation = "authenticated" | "installed" | "not-installed";

function moteur(
  name: string,
  displayName: string,
  installState: EtatInstallation = "authenticated"
) {
  return {
    name,
    displayName,
    installState,
    installCommand: "",
    loginCommand: "",
    setupHint: ""
  };
}

/**
 * `getActiveEngine` suit un moteur courant mutable, comme le fait le processus
 * principal : un double qui rendrait toujours la meme valeur ne pourrait pas
 * distinguer « le pied relit » de « le pied ne relit pas ».
 *
 * Chaque appel rend une COPIE, parce que l IPC serialise : le renderer ne
 * partage aucune reference avec le processus principal. Un double qui rendait
 * l objet du catalogue laissait une mutation de cet objet apparaitre dans
 * l etat React sans la moindre relecture, et le test declarait vert un pied qui
 * n avait rien relu.
 */
function installApi(etatCodex: EtatInstallation = "authenticated") {
  const etat = { actif: "codex" };
  const catalogue: Record<string, ReturnType<typeof moteur>> = {
    codex: moteur("codex", "Codex (ChatGPT)", etatCodex),
    antigravity: moteur("antigravity", "Antigravity")
  };
  const copie = (name: string) => ({ ...catalogue[name]! });

  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
    settings: {
      getActiveEngine: vi.fn(async () => ({
        engine: etat.actif,
        status: copie(etat.actif)
      })),
      detectEngines: vi.fn(async () => ({
        engines: Object.keys(catalogue).map(copie)
      })),
      setActiveEngine: vi.fn(async (name: string) => {
        etat.actif = name;
        return { engine: name, status: copie(name) };
      })
    }
  };
  return { etat, catalogue };
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("Pied de la barre laterale, moteur actif", () => {
  it("relit le moteur quand un changement est annonce", async () => {
    const { etat } = installApi();
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

  it("suit une authentification faite dans un terminal des que le panneau redetecte", async () => {
    // L utilisateur passe `codex login` dans son terminal, hors de
    // l application, puis revient aux Parametres. La detection du panneau voit
    // le nouvel etat ; sans annonce, le pied gardait « non authentifié »
    // jusqu au redemarrage, a cote d un panneau qui affichait « Connecté ».
    const { catalogue } = installApi("installed");

    function Coque({ parametres }: { parametres: boolean }) {
      return (
        <ToastProvider>
          {parametres ? <EnginePanel /> : null}
          <ActiveEngineFooter />
        </ToastProvider>
      );
    }

    const { container, rerender } = render(<Coque parametres={false} />);

    const valeur = () => container.querySelector(".sidebar-engine__value")?.textContent;
    await waitFor(() => {
      expect(valeur()).toBe("Codex (ChatGPT), non authentifié");
    });

    // L authentification se fait ailleurs : aucun evenement ne part de la.
    catalogue.codex!.installState = "authenticated";
    expect(valeur()).toBe("Codex (ChatGPT), non authentifié");

    // Retour aux Parametres : le panneau monte et redetecte.
    rerender(<Coque parametres />);

    await waitFor(() => {
      expect(valeur()).toBe("Codex (ChatGPT), connecté");
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

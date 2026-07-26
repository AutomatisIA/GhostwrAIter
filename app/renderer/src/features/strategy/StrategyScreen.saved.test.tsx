// @vitest-environment jsdom
/*
 * « Enregistré à HH:MM » ne doit s afficher que si l enregistrement a reussi.
 *
 * `saveBundle` avale son erreur et la signale par un toast, sans la remonter :
 * l ecran posait donc l horodatage inconditionnellement. Un echec affichait en
 * meme temps le toast rouge « Échec de l'enregistrement de la stratégie » et,
 * dans la barre de page, « Enregistré à 14:32 ». Des deux affirmations
 * contradictoires, la plus rassurante est fausse, et c est elle qui reste a
 * l ecran une fois le toast parti.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../feedback/ToastProvider";
import { StrategyScreen } from "./StrategyScreen";

function installApi(saveBundle: () => Promise<unknown>) {
  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
    strategy: {
      getActiveBundle: vi.fn().mockResolvedValue({
        profile: { name: "", positioning: "", bio: "", expertiseSummary: "" },
        offers: [],
        icps: [],
        pillars: [],
        voiceRules: []
      }),
      saveBundle: vi.fn(saveBundle)
    },
    settings: {
      getPreference: vi.fn().mockResolvedValue({ value: null }),
      setPreference: vi.fn().mockResolvedValue(undefined)
    }
  };
}

function renderScreen() {
  render(
    <ToastProvider>
      <StrategyScreen />
    </ToastProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("Strategie, horodatage d enregistrement", () => {
  it("n affiche pas « Enregistré à » quand l enregistrement echoue", async () => {
    const user = userEvent.setup();
    installApi(() => Promise.reject(new Error("disk full")));

    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Enregistrer" }));

    // L echec se dit.
    expect(await screen.findByText(/Échec de l'enregistrement de la stratégie/)).toBeTruthy();
    // Et rien ne vient le contredire dans la barre de page.
    expect(screen.queryByText(/Enregistré à/)).toBeNull();
  });

  it("affiche « Enregistré à » quand l enregistrement reussit", async () => {
    // Garde : le correctif ne doit pas supprimer l horodatage du chemin nominal,
    // qui est la seule confirmation persistante de l ecran.
    const user = userEvent.setup();
    installApi(() => Promise.resolve(undefined));

    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(screen.getByText(/Enregistré à/)).toBeTruthy());
    expect(screen.queryByText(/Échec de l'enregistrement/)).toBeNull();
  });
});

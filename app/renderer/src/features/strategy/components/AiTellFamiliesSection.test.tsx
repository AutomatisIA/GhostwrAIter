// @vitest-environment jsdom
/*
 * La case cochee dit-elle ce que la generation applique ?
 *
 * La bascule etait optimiste et l echec d ecriture ignore : base en lecture
 * seule ou disque plein, la case restait dans son nouvel etat, aucun message,
 * et l atelier continuait d appliquer l ancienne preference. L interface
 * affirmait qu une famille etait interdite alors qu elle etait toujours
 * toleree, et rien a l ecran ne permettait de s en apercevoir.
 *
 * Les deux chemins sont mesures : l echec doit revenir en arriere ET le dire,
 * le succes doit conserver le nouvel etat. Sans le second, une implementation
 * qui refuserait toute bascule passerait le premier.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TELL_FAMILIES, type TellFamily } from "../../../../../shared/ai-tells";
import { AI_TELL_FAMILIES_PREFERENCE_KEY } from "../../ai-tells/tellsPreference";
import { ToastProvider } from "../../../feedback/ToastProvider";
import { AiTellFamiliesSection } from "./AiTellFamiliesSection";

/** La premiere famille du moteur partage, quelle qu elle soit : le test suit
 *  les libelles reels plutot que d en recopier un. */
function premiere(): TellFamily {
  const famille = TELL_FAMILIES[0];
  if (!famille) throw new Error("TELL_FAMILIES ne doit pas etre vide.");
  return famille;
}

const premiereFamille = premiere();

function installApi(setPreference: ReturnType<typeof vi.fn>) {
  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
    settings: {
      // Aucune preference enregistree : les neuf familles sont cochees.
      getPreference: vi.fn().mockResolvedValue({ value: null }),
      setPreference
    }
  };
}

/** Rend la section et attend la fin de la lecture initiale. */
async function monter(setPreference: ReturnType<typeof vi.fn>) {
  installApi(setPreference);
  render(
    <ToastProvider>
      <AiTellFamiliesSection />
    </ToastProvider>
  );

  const case1 = await screen.findByRole<HTMLInputElement>("checkbox", {
    name: premiereFamille.label
  });
  await waitFor(() => {
    expect(case1.disabled).toBe(false);
  });
  expect(case1.checked).toBe(true);
  return case1;
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("Marqueurs d'ecriture IA, persistance de la bascule", () => {
  it("revient a l etat enregistre et signale l echec quand l ecriture rate", async () => {
    const user = userEvent.setup();
    const setPreference = vi.fn().mockRejectedValue(new Error("SQLITE_READONLY"));
    const case1 = await monter(setPreference);

    await user.click(case1);

    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith(
        AI_TELL_FAMILIES_PREFERENCE_KEY,
        expect.not.stringContaining(premiereFamille.id)
      );
    });

    // La case ne peut pas rester decochee : la generation, elle, applique
    // toujours l ancienne preference.
    await waitFor(() => {
      expect(case1.checked).toBe(true);
    });
    expect(
      await screen.findByText(
        "Impossible d'enregistrer ce réglage. La génération garde la préférence précédente."
      )
    ).toBeTruthy();
  });

  it("conserve la bascule quand l ecriture reussit", async () => {
    const user = userEvent.setup();
    const setPreference = vi.fn().mockResolvedValue(undefined);
    const case1 = await monter(setPreference);

    await user.click(case1);

    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledTimes(1);
    });
    expect(case1.checked).toBe(false);
    expect(
      screen.queryByText(
        "Impossible d'enregistrer ce réglage. La génération garde la préférence précédente."
      )
    ).toBeNull();
  });
});

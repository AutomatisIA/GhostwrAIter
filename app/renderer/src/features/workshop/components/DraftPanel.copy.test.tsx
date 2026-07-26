// @vitest-environment jsdom
/*
 * Ce que l atelier dit quand la copie dans le presse-papier echoue.
 *
 * Sur ce produit, « Copier le post » est le geste qui TERMINE le parcours :
 * l application ne publie pas, elle prepare un texte a coller sur LinkedIn.
 * Une copie refusee et muette envoie donc l utilisateur coller le contenu
 * PRECEDENT de son presse-papier dans une publication publique, en croyant
 * poster son brouillon.
 *
 * `navigator.clipboard.writeText` etait appele sans `.catch()` : ni « Copié ! »,
 * ni message d erreur, aucun changement a l ecran. `LibraryScreen` traitait deja
 * ce cas correctement, l atelier non.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopSession } from "@shared/types/workshop";
import { ToastProvider } from "../../../feedback/ToastProvider";
import { DraftPanel } from "./DraftPanel";

function poserPressePapier(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true
  });
}

function session(): WorkshopSession {
  return {
    idea: {
      id: "i1",
      title: "Un sujet",
      angle: "Un angle",
      pillarLabel: "Pédagogie",
      createdAt: "2026-07-25T09:00:00.000Z",
      targetIcpSegment: null
    },
    draft: { id: "d1", headline: "Un titre", bodyMarkdown: "Un corps.", qualityScore: 0 },
    hooks: [],
    run: { id: "r1", skillName: "linkedin-draft", status: "succeeded", summary: "" },
    versions: [],
    contextUsed: { pillarLabel: "Pédagogie", voiceGuardrail: "Voix directe", activeSkills: [] }
  };
}

function renderPanel() {
  render(
    <ToastProvider>
      <DraftPanel
        session={session()}
        onReopenStructureSelection={() => {}}
        onReopenHookSelection={() => {}}
        onCorrect={() => {}}
        isLoadingCorrection={false}
        onSaveDraftText={() => {}}
        isSavingDraftText={false}
      />
    </ToastProvider>
  );
}

beforeEach(() => {
  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
    settings: { getPreference: () => Promise.resolve({ value: null }) }
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("Atelier, copie du post", () => {
  it("dit que la copie a echoue au lieu de ne rien dire", async () => {
    const user = userEvent.setup();
    poserPressePapier(() => Promise.reject(new Error("NotAllowedError")));

    renderPanel();
    await user.click(screen.getByRole("button", { name: "Copier le post" }));

    expect(
      await screen.findByText(/Impossible de copier dans le presse-papier/)
    ).toBeTruthy();
    // Et surtout : le libelle ne bascule pas sur « Copié ! », qui affirmerait
    // le contraire de ce qui vient de se passer.
    expect(screen.queryByRole("button", { name: "Copié !" })).toBeNull();
  });

  it("confirme la copie quand elle reussit", async () => {
    // Garde : le correctif ne doit pas transformer le chemin nominal en erreur.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    poserPressePapier(writeText);

    renderPanel();
    await user.click(screen.getByRole("button", { name: "Copier le post" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copié !" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith("Un titre\n\nUn corps.");
    expect(screen.queryByText(/Impossible de copier/)).toBeNull();
  });
});

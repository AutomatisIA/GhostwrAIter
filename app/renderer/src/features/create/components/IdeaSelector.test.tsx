// @vitest-environment jsdom
/*
 * Ce que l ecran Creer annonce quand la creation reussit mais que le
 * rafraichissement du backlog echoue.
 *
 * Le rechargement etait appele DANS le `try` qui decide du verdict. Une idee
 * pourtant enregistree en base se voyait donc annoncer « La création de l'idée
 * a échoué. Réessaie. », et `createIdea` rendait `null`, ce qui coupait aussi
 * l ouverture de l atelier. Le geste suivant de l utilisateur est de reessayer,
 * et il cree un doublon. Un rafraichissement rate n est pas une creation ratee.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../feedback/ToastProvider";
import { IdeaSelector } from "./IdeaSelector";

type Api = Record<string, unknown>;

function installApi(ideas: Api) {
  (window as unknown as { linkedinPoster: Api }).linkedinPoster = {
    ideas,
    strategy: {
      getActiveBundle: vi.fn().mockResolvedValue({ pillars: [], icps: [] })
    }
  };
}

function renderSelector(onSelect = vi.fn()) {
  render(
    <ToastProvider>
      <IdeaSelector onSelect={onSelect} />
    </ToastProvider>
  );
  return onSelect;
}

/** Remplit le minimum exige par « Ouvrir dans l'atelier ». */
async function remplirFormulaire(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Titre du sujet"), "Un sujet");
  await user.type(screen.getByLabelText("Angle"), "Un angle");
  await user.type(screen.getByLabelText("Pilier éditorial"), "Pédagogie");
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("Creer, creation reussie et rafraichissement en echec", () => {
  it("n annonce pas un echec de creation quand c est la liste qui n a pas pu etre relue", async () => {
    const user = userEvent.setup();
    const createIdea = vi.fn().mockResolvedValue({ id: "idee-1" });
    installApi({
      // Premier appel : le montage. Deuxieme : le rafraichissement, qui tombe.
      listIdeas: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockRejectedValue(new Error("database is locked")),
      createIdea
    });

    const onSelect = renderSelector();
    await screen.findByText("Aucune idée pour le moment");
    await remplirFormulaire(user);
    await user.click(screen.getByRole("button", { name: /Ouvrir dans l'atelier/ }));

    await waitFor(() => expect(createIdea).toHaveBeenCalled());

    // Le verdict porte sur la CREATION, qui a reussi.
    expect(screen.queryByText(/La création de l'idée a échoué/)).toBeNull();
    // Et l atelier s ouvre : c est ce que l utilisateur a demande.
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("idee-1"));
  });

  it("dit quand meme que la liste n a pas pu etre relue", async () => {
    // L echec ne doit pas devenir muet pour autant : le backlog affiche est
    // perime, et rien d autre a l ecran ne le signale.
    const user = userEvent.setup();
    installApi({
      listIdeas: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockRejectedValue(new Error("database is locked")),
      createIdea: vi.fn().mockResolvedValue({ id: "idee-1" })
    });

    renderSelector();
    await screen.findByText("Aucune idée pour le moment");
    await remplirFormulaire(user);
    await user.click(screen.getByRole("button", { name: /Ouvrir dans l'atelier/ }));

    expect(await screen.findByText(/liste des idées n'a pas pu être rafraîchie/)).toBeTruthy();
  });

  it("annonce bien l echec de creation quand c est la creation qui echoue", async () => {
    // Garde : le correctif ne doit pas rendre l ecran muet sur la vraie panne.
    const user = userEvent.setup();
    installApi({
      listIdeas: vi.fn().mockResolvedValue([]),
      createIdea: vi.fn().mockRejectedValue(new Error("disk full"))
    });

    const onSelect = renderSelector();
    await screen.findByText("Aucune idée pour le moment");
    await remplirFormulaire(user);
    await user.click(screen.getByRole("button", { name: /Ouvrir dans l'atelier/ }));

    expect(await screen.findByText(/La création de l'idée a échoué/)).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

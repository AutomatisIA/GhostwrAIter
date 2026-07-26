// @vitest-environment jsdom
/*
 * Clavier et focus des deux dialogues modaux.
 *
 * Le scenario qui a motive ces tests se joue entierement a la souris puis au
 * clavier : ouvrir la confirmation de suppression, cliquer sur le texte du
 * message pour le relire, puis appuyer sur Echap. Dans un navigateur, ce clic
 * pose le focus sur `<body>`, le conteneur du dialogue n etant pas focusable.
 * Les touches partaient donc de `body`, hors de l arbre React du dialogue, et
 * son `onKeyDown` ne se declenchait plus : Echap etait mort et Tab sortait vers
 * la page derriere le voile.
 *
 * jsdom ne deplace pas le focus au clic comme le fait un navigateur : le clic
 * est donc REPRODUIT par ce qu il produit reellement, un focus sur `body`. Ce
 * que ces tests mesurent est bien le mecanisme en cause, l origine de
 * l evenement clavier, et non une approximation du geste.
 */
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { GuidedTour } from "../../help/GuidedTour";

afterEach(cleanup);

/** Reproduit l effet d un clic sur une zone non focusable du dialogue. */
function cliquerSurLeTexte() {
  (document.activeElement as HTMLElement | null)?.blur();
  document.body.focus();
}

describe("ConfirmDialog, clavier", () => {
  function renderDialog(onCancel = vi.fn()) {
    render(
      <ConfirmDialog
        open
        destructive
        title="Supprimer ce brouillon ?"
        message="« Un titre » sera définitivement supprimé de votre bibliothèque."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );
    return onCancel;
  }

  it("ferme par Echap apres un clic sur le texte du message", () => {
    const onCancel = renderDialog();

    cliquerSurLeTexte();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("ramene le focus dans le dialogue quand Tab part de l exterieur", () => {
    renderDialog();

    cliquerSurLeTexte();
    fireEvent.keyDown(document, { key: "Tab" });

    // Premier focusable du dialogue : « Annuler ».
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Annuler" }));
  });

  it("rend le focus au declencheur a la fermeture", () => {
    function Harnais() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Supprimer
          </button>
          <ConfirmDialog
            open={open}
            title="Supprimer ce brouillon ?"
            message="Irréversible."
            onConfirm={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }

    render(<Harnais />);
    const declencheur = screen.getByRole("button", { name: "Supprimer" });
    declencheur.focus();
    fireEvent.click(declencheur);

    fireEvent.keyDown(document, { key: "Escape" });

    // Sans restitution, le focus retombe sur `body` et la tabulation suivante
    // repart du haut de l application.
    expect(document.activeElement).toBe(declencheur);
  });
});

describe("GuidedTour, clavier", () => {
  it("ferme par Echap apres un clic sur le corps de l etape", () => {
    const onClose = vi.fn();
    render(<GuidedTour open onClose={onClose} />);

    cliquerSurLeTexte();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("garde le focus dans la visite quand Tab part de l exterieur", () => {
    render(<GuidedTour open onClose={() => {}} />);

    cliquerSurLeTexte();
    fireEvent.keyDown(document, { key: "Tab" });

    const actif = document.activeElement as HTMLElement | null;
    expect(actif?.closest(".guided-tour")).not.toBeNull();
  });
});

describe("garde : le dialogue ferme n ecoute rien", () => {
  it("n intercepte pas Echap quand il n est pas ouvert", () => {
    // Sans cette garde, un `document.addEventListener` laisse derriere lui
    // ferait fermer un dialogue deja ferme, ou pire, avalerait Echap pour le
    // reste de l application.
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={false}
        title="Fermé"
        message="Rien"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).not.toHaveBeenCalled();
  });
});

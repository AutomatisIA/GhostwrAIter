import { useCallback, useEffect, useState } from "react";
import type { EngineSelection } from "../../../shared/types/settings";
import { surChangementDeMoteur } from "../features/settings/active-engine-events";

/**
 * Moteur actif, affiche en permanence au pied de la navigation.
 *
 * Le moteur decide de la qualite de chaque generation, et il se choisissait
 * dans un onglet des Parametres qu on ne rouvre jamais. Aucun ecran ne
 * rappelait lequel etait retenu, ni s il repondait encore. Le pied de la barre
 * laterale est le seul endroit visible depuis les cinq ecrans.
 *
 * Il RELIT a chaque changement annonce. La coque qui le monte ne se remonte
 * jamais : une lecture unique au montage le figeait sur le moteur du demarrage,
 * et changer de moteur dans les Parametres laissait le pied annoncer l ancien
 * jusqu a la fermeture de l application. Un bloc dont la raison d etre est de
 * dire quel moteur travaille ne peut pas se tromper de moteur.
 *
 * En cas d echec de lecture, le bloc ne s affiche pas : mieux vaut ne rien
 * annoncer qu annoncer un moteur qui n est peut-etre pas celui qui tournera.
 */
export function ActiveEngineFooter() {
  const [selection, setSelection] = useState<EngineSelection | null>(null);

  const relire = useCallback((estMonte: () => boolean) => {
    window.linkedinPoster.settings
      .getActiveEngine()
      .then((result) => {
        if (estMonte()) setSelection(result);
      })
      .catch(() => {
        /* Sans reponse, on n affiche rien. */
      });
  }, []);

  useEffect(() => {
    let monte = true;
    const estMonte = () => monte;

    relire(estMonte);
    const desabonner = surChangementDeMoteur(() => relire(estMonte));

    return () => {
      monte = false;
      desabonner();
    };
  }, [relire]);

  if (!selection) return null;

  const connecte = selection.status.installState === "authenticated";

  return (
    <div className="sidebar-engine">
      <span className="sidebar-engine__label">Moteur</span>
      <span
        className={
          connecte
            ? "sidebar-engine__value"
            : "sidebar-engine__value sidebar-engine__value--off"
        }
      >
        {selection.status.displayName},{" "}
        {connecte ? "connecté" : "non authentifié"}
      </span>
    </div>
  );
}

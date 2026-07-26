import React from "react";
import { useHelpDisclosure, type HelpFieldId } from "./strategy-help";

export type StrategyFieldProps = {
  /** Nature du champ : porte l etat de repli, partage entre instances. */
  field: HelpFieldId;
  /** Identifiant DOM unique de la commande, par instance. */
  controlId: string;
  label: string;
  /** Texte d aide, replie par defaut, depliable par le bouton du libelle. */
  help: string;
  /** `start` pour les zones de texte, `center` pour les champs d une ligne. */
  align?: "center" | "start";
  children: React.ReactNode;
};

/**
 * Une ligne de formulaire : libelle a gauche, champ a droite, aide repliee.
 *
 * Trois gestes tiennent dans ce composant, et c est ce qui fait passer l onglet
 * Profil de quatre lignes empilees par champ a une seule :
 *   - le champ est sur la meme ligne que son libelle (grille 176px / 1fr) ;
 *   - l aide sort du flux tant qu elle est repliee ;
 *   - l exemple n est plus une ligne sous le champ, il est devenu son texte
 *     indicatif, donc visible quand il sert et absent des que le champ est
 *     rempli. Il est fourni par l appelant sur la commande enfant.
 *
 * L aide est toujours rendue et masquee par l attribut `hidden` plutot que
 * conditionnee : `aria-controls` doit designer un element existant, et le
 * lecteur d ecran ne suit pas une cible qui apparait au clic.
 */
export function StrategyField({
  field,
  controlId,
  label,
  help,
  align = "center",
  children
}: StrategyFieldProps) {
  const disclosure = useHelpDisclosure();
  const open = disclosure.isOpen(field);
  const helpId = `${controlId}-help`;

  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: controlId,
        "aria-describedby": open ? helpId : undefined
      })
    : children;

  return (
    <div className="strategy-row" data-align={align}>
      <div className="strategy-row__labelcell">
        <label className="strategy-row__label" htmlFor={controlId}>
          {label}
        </label>
        <button
          type="button"
          className="strategy-row__help-toggle"
          aria-expanded={open}
          aria-controls={helpId}
          aria-label={open ? `Masquer l'aide sur ${label}` : `Afficher l'aide sur ${label}`}
          onClick={() => disclosure.toggle(field)}
        >
          <span aria-hidden="true">?</span>
        </button>
      </div>
      {control}
      <p className="strategy-row__help" id={helpId} hidden={!open}>
        {help}
      </p>
    </div>
  );
}

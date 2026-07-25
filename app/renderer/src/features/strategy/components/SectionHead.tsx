import type { ReactNode } from "react";

export type SectionHeadProps = {
  title: string;
  /** Ce a quoi sert la section. Conserve de l ancienne mise en page. */
  lead: string;
  /** Aide de glossaire du terme metier, quand la section en porte un. */
  hint?: ReactNode;
  /** Action de portee contenu : ajouter un element a la liste. */
  action?: ReactNode;
};

/**
 * En-tete des onglets qui gerent une liste.
 *
 * L onglet Profil n en a pas : il n a ni terme de glossaire a expliquer ni
 * element a ajouter, et son titre repeterait le libelle de l onglet actif.
 * Les cinq autres en gardent un, parce qu il porte deux choses que la barre
 * d onglets ne peut pas porter : le bouton d ajout, de portee contenu, et
 * l aide de glossaire du terme metier.
 */
export function SectionHead({ title, lead, hint, action }: SectionHeadProps) {
  return (
    <div className="strategy-section-head">
      <div>
        <h2 className="strategy-section-head__title">
          {title}
          {hint}
        </h2>
        <p className="strategy-section-head__lead">{lead}</p>
      </div>
      {action ? <div className="strategy-section-head__action">{action}</div> : null}
    </div>
  );
}

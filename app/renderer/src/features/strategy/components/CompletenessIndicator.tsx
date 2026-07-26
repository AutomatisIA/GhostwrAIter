export type CompletenessIndicatorProps = {
  /** Nombre d elements renseignes. */
  filled: number;
  /** Nombre d elements declares. Zero signifie section vide. */
  total: number;
  /** Nom de l unite comptee, au singulier : « champ », « offre »... */
  unitOne: string;
  /** Le meme nom au pluriel. Le francais ne se deduit pas d un `+ s`. */
  unitMany: string;
  /** Libelle affiche a la place du decompte quand la section est vide. */
  emptyLabel: string;
  /** Ce que l etat actuel change a la generation. `null` quand tout est en place. */
  consequence: string | null;
};

/**
 * Icone d information de la ligne de consequence.
 *
 * Tracee ici et non dans `design-system/primitives/icons` : ce jeu partage
 * n expose pas de glyphe d information et appartient au chantier commun, qu un
 * chantier d ecran ne modifie pas. La forme reprend le trace de la maquette et
 * le style du jeu partage (24x24, trait 1,75, extremites rondes).
 */
function InfoGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="8" />
      <line x1="12" y1="11.5" x2="12" y2="16" />
    </svg>
  );
}

/**
 * Indicateur de completude : une jauge de cinq segments, un decompte en
 * chiffres tabulaires, et sous eux une ligne factuelle disant ce que l etat
 * courant change a la generation.
 *
 * La version precedente affichait un badge « Section vide : impactera la
 * qualite de post-writer » : un reproche, doublé d un nom de rouage interne que
 * l utilisateur n a aucune raison de connaitre. La ligne de consequence nomme
 * desormais ce qui manque et l effet reel, sans exagerer un echec qui ne se
 * produit pas.
 *
 * La jauge porte UN segment par element compte, jamais une resolution fixe.
 * La version precedente en dessinait cinq quelle que soit la section : sous
 * l onglet Profil, quatre champs tous remplis laissaient un segment gris a
 * cote de la mention « 4 sur 4 », et l indicateur se contredisait lui-meme.
 * Une jauge dont le nombre de cases est le nombre de choses a remplir est
 * lisible sans legende.
 *
 * Le decompte nomme desormais son unite (« 4 champs sur 4 ») : « 4 sur 4 »
 * seul obligeait a deviner ce qui etait compte. Les segments restent
 * decoratifs pour un lecteur d ecran, l information etant portee par ce texte.
 */
export function CompletenessIndicator({
  filled,
  total,
  unitOne,
  unitMany,
  emptyLabel,
  consequence
}: CompletenessIndicatorProps) {
  const lit = Math.max(0, Math.min(total, filled));
  const countText =
    total === 0 ? emptyLabel : `${filled} ${total > 1 ? unitMany : unitOne} sur ${total}`;

  return (
    <div className="strategy-completeness">
      <div className="strategy-completeness__row">
        <span className="eyebrow">Complétude</span>
        {total > 0 ? (
          <div className="strategy-completeness__segments" aria-hidden="true">
            {Array.from({ length: total }, (_, index) => (
              <span
                key={index}
                className="strategy-completeness__segment"
                data-lit={index < lit ? "true" : undefined}
              />
            ))}
          </div>
        ) : null}
        <span className="strategy-completeness__count" role="status">
          {countText}
        </span>
      </div>
      {consequence ? (
        <p className="strategy-completeness__consequence">
          <InfoGlyph />
          {consequence}
        </p>
      ) : null}
    </div>
  );
}

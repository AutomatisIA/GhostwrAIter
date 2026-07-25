const SEGMENT_COUNT = 5;

export type CompletenessIndicatorProps = {
  /** Nombre d elements renseignes. */
  filled: number;
  /** Nombre d elements declares. Zero signifie section vide. */
  total: number;
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
 * La jauge est une resolution fixe de cinq segments, pas un segment par champ :
 * elle se lit d un coup d oeil quelle que soit la section, et le decompte a
 * cote donne le chiffre exact. Les segments sont donc decoratifs pour un
 * lecteur d ecran, l information etant portee par le texte adjacent.
 */
export function CompletenessIndicator({
  filled,
  total,
  emptyLabel,
  consequence
}: CompletenessIndicatorProps) {
  const ratio = total === 0 ? 0 : Math.max(0, Math.min(1, filled / total));
  const lit = Math.round(ratio * SEGMENT_COUNT);
  const countText = total === 0 ? emptyLabel : `${filled} sur ${total}`;

  return (
    <div className="strategy-completeness">
      <div className="strategy-completeness__row">
        <span className="eyebrow">Complétude</span>
        <div className="strategy-completeness__segments" aria-hidden="true">
          {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
            <span
              key={index}
              className="strategy-completeness__segment"
              data-lit={index < lit ? "true" : undefined}
            />
          ))}
        </div>
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

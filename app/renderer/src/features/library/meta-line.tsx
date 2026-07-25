import { Fragment, type ReactNode } from "react";

/**
 * Pastille du pilier. Elle ne vaut que collee au nom qu elle annonce : posee en
 * tete de rangee comme fragment autonome, `MetaLine` inserait un point median
 * derriere elle et la ligne s ouvrait sur « · Brouillon », une puce sans
 * referent suivie d un separateur sans rien a separer.
 */
export function PillarDot() {
  return <span className="library-row__dot" aria-hidden="true" />;
}

/**
 * Ligne de metadonnees : des fragments separes par des points medians. Le
 * separateur est purement typographique, d ou `aria-hidden` : lu a voix haute il
 * n ajoute rien au fragment qu il suit.
 *
 * La troncature appartient a chaque fragment (voir `library.css`), pas au
 * conteneur : un rognage de conteneur coupe le dernier fragment en plein milieu
 * d un mot, sans marque, ce qui donne un texte faux plutot qu un texte abrege.
 *
 * Une seule rangee pour les trois usages de l ecran (ligne de triage, ligne de
 * planning, panneau de lecture) : la separation et la troncature sont le meme
 * probleme partout, et trois copies divergeaient a la premiere retouche.
 */
export function MetaLine({ parts, className }: { parts: ReactNode[]; className?: string }) {
  return (
    <span className={["library-row__meta", className].filter(Boolean).join(" ")}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span className="library-row__sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          {part}
        </Fragment>
      ))}
    </span>
  );
}

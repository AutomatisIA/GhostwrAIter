import type { ReactNode } from "react";

type PageFrameProps = {
  /** Surtitre en capitales, a gauche de la barre. Nomme l ecran, jamais l action. */
  eyebrow: string;
  /** Actions de portee ecran, alignees a droite de la barre. */
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Cadre commun a tous les ecrans : une barre d en-tete de hauteur fixe, puis un
 * corps qui defile seul.
 *
 * Ce decoupage est la correction de fond d un defaut signale trois fois sous des
 * formes differentes : « le haut de l app n est plus visible quand on change
 * d ecran », « l ecran est coupe », « la mise en page est mauvaise ». La cause
 * commune etait que la page entiere defilait, en-tete compris. Chaque correctif
 * remettait le defilement a zero au bon moment sans empecher l en-tete de
 * partir vers le haut des que l utilisateur descendait.
 *
 * Ici l en-tete est `flex: none` dans une colonne de hauteur bornee, et le seul
 * conteneur qui defile est `.page__body`. L en-tete ne peut plus sortir de
 * l ecran : ce n est plus une valeur a maintenir, c est une propriete de la
 * structure.
 */
export function PageFrame({ eyebrow, actions, children }: PageFrameProps) {
  return (
    <div className="page">
      <header className="page__bar">
        {/* Un `h1`, pas un `span`. Ce surtitre EST le titre de la page : c est
            le seul endroit ou son nom est ecrit. Le rendre non semantique
            priverait les cinq ecrans de titre de niveau un, et une navigation
            par titres n aurait plus rien a annoncer. La maquette decrit son
            APPARENCE, capitales et petit corps, pas son rang. */}
        <h1 className="page__eyebrow">{eyebrow}</h1>
        {actions ? <div className="page__actions">{actions}</div> : null}
      </header>
      <div className="page__body">{children}</div>
    </div>
  );
}

import { Button } from "../../../design-system/primitives";

export type StrategyAsideProps = {
  /**
   * Phrase disant ce que l etat courant du profil produit a la generation.
   * `null` sur les onglets qui ne parlent pas du profil : y afficher une phrase
   * sur le profil ferait dire au panneau autre chose que ce que l ecran montre.
   */
  profileEffect: string | null;
  /** Vrai des qu un socle existe, meme perime. */
  foundationExists: boolean;
  /** Vrai quand la strategie a bouge depuis la derniere generation. */
  foundationOutdated: boolean;
  /** Libelle du bouton, calcule par l ecran : generer, regenerer, recommande. */
  foundationLabel: string;
  /**
   * Faux sur l onglet Socle editorial, qui dit deja l etat du socle en une
   * phrase complete au-dessus de son contenu. Le repeter ici en deux mots
   * n ajouterait rien et affaiblirait l original.
   */
  showFreshness: boolean;
  generating: boolean;
  onGenerate: () => void;
};

/**
 * Colonne de droite de l ecran Strategie.
 *
 * Elle repond a deux defauts a la fois. Le premier est que la moitie basse de
 * l ecran etait vide alors que le meme ecran etait juge trop long : le
 * formulaire tenait dans une colonne et laissait cinq cents pixels inutilises a
 * sa droite comme sous lui. Le second est que « Regenerer le socle » siegeait
 * dans la barre de page, en bouton plein, a cote de « Enregistrer » : deux
 * actions au meme rang, dont la plus voyante n etait pas la principale.
 *
 * La regeneration vit donc ici, en bouton borde, accompagnee de la phrase qui
 * dit ce qu elle fait et ce qu elle ne fait pas. Elle reste presente sur les
 * six onglets, parce que c est le seul endroit d ou on peut la declencher.
 *
 * Ce panneau ne porte volontairement ni `strategy-section` ni
 * `strategy-surface` : ces deux classes sont les reperes de mesure des portes
 * de recette geometriques, qui visent la premiere occurrence dans le document.
 */
export function StrategyAside({
  profileEffect,
  foundationExists,
  foundationOutdated,
  foundationLabel,
  showFreshness,
  generating,
  onGenerate
}: StrategyAsideProps) {
  // L etat precede son libelle : la teinte se decide sur l etat, jamais en
  // relisant la chaine affichee, qui peut etre reformulee sans preavis.
  const state = !foundationExists ? "absent" : foundationOutdated ? "outdated" : "fresh";
  const freshness = { absent: "Jamais généré", outdated: "À régénérer", fresh: "À jour" }[state];

  // Sur les onglets qui ne parlent pas du profil, le panneau ne porte plus que
  // le socle : son surtitre le dit, et la ligne d etat en dessous n a plus a
  // repeter le mot.
  const title = profileEffect ? "Effet sur les générations" : "Socle éditorial";

  return (
    <aside className="strategy-aside">
      <span className="eyebrow">{title}</span>

      <div className="strategy-aside__card">
        {profileEffect ? (
          <>
            <p className="strategy-aside__lead">{profileEffect}</p>
            <div className="strategy-aside__rule" />
          </>
        ) : null}

        {showFreshness ? (
          <div className="strategy-aside__status">
            <span className="strategy-aside__status-label">
              {profileEffect ? "Socle éditorial" : "État"}
            </span>
            {/* L ambre ne signale que l attention a porter, jamais un succes ni
                un echec : seul l etat perime le merite. */}
            <span
              className="strategy-aside__status-value"
              data-tone={state === "outdated" ? "attention" : undefined}
            >
              {freshness}
            </span>
          </div>
        ) : null}

        <Button variant="secondary" onClick={onGenerate} loading={generating}>
          {foundationLabel}
        </Button>

        <p className="strategy-aside__note">
          La régénération n'est pas l'action principale de cet écran : elle relit tout le reste,
          elle ne s'enregistre pas.
        </p>
      </div>
    </aside>
  );
}

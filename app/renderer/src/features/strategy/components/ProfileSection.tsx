import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { CompletenessIndicator } from "./CompletenessIndicator";
import { StrategyField } from "./StrategyField";
import { capitalize, isFilled, joinFr } from "./completeness-text";

type ProfileSectionProps = {
  profile: StrategyBundleInput["profile"];
  onUpdate: (field: keyof StrategyBundleInput["profile"], value: string) => void;
};

/**
 * Onglet Profil : quatre champs, une seule surface bordee, aides repliees.
 *
 * Cet onglet est la mesure de reference de la refonte. Il ne porte plus de
 * titre ni de phrase d introduction de section : l onglet actif s appelle deja
 * « Profil », et la phrase qui s y trouvait (« Le minimum pour comprendre votre
 * metier, votre promesse et votre angle editorial ») ne faisait que reformuler
 * les quatre libelles qui la suivaient. Les aides de champ, elles, sont toutes
 * conservees, repliees sous leur bouton.
 */
export function ProfileSection({ profile, onUpdate }: ProfileSectionProps) {
  const missing = [
    { name: "nom affiché", value: profile.name },
    { name: "positionnement", value: profile.positioning },
    { name: "biographie", value: profile.bio },
    { name: "résumé d'expertise", value: profile.expertiseSummary }
  ].filter((field) => !isFilled(field.value));

  const filled = 4 - missing.length;
  const consequence =
    missing.length === 0
      ? null
      : `${capitalize(joinFr(missing.map((field) => field.name)))} ${
          missing.length > 1 ? "vides" : "vide"
        }. Les posts générés seront plus génériques, sans que la génération échoue.`;

  return (
    <section className="strategy-section" aria-label="Profil et positionnement">
      <div className="strategy-surface">
        <StrategyField
          field="profile-name"
          controlId="profile-name"
          label="Nom affiché"
          help="Le nom affiché et signé sous vos posts. Il apparaît dans l'aperçu et sert au modèle à écrire à la première personne."
        >
          <input
            value={profile.name}
            onChange={(event) => onUpdate("name", event.target.value)}
            // Aucun nom propre ici : l application est publique et distribuee.
            // Un exemple nominatif affiche le nom d une personne reelle a tous
            // ses utilisateurs, et ne dit pas mieux quoi saisir qu une consigne.
            placeholder="Votre nom, tel qu'il apparaît sur LinkedIn"
          />
        </StrategyField>

        <StrategyField
          field="profile-positioning"
          controlId="profile-positioning"
          label="Positionnement"
          help="En une phrase : pour qui vous travaillez et le problème que vous résolvez. C'est la ligne la plus utilisée par le modèle, plus elle est précise, moins les posts sont génériques."
          align="start"
        >
          {/* Zone de deux lignes et non champ d une ligne : un positionnement
              utile depasse regulierement 90 caracteres, et sur une seule ligne
              sa fin sortait du champ. L utilisateur ne pouvait plus relire ce
              qu il avait ecrit sans se deplacer au clavier dans le champ.
              `rows` porte la mesure, le CSS s y accroche par attribut. */}
          <textarea
            rows={2}
            value={profile.positioning}
            onChange={(event) => onUpdate("positioning", event.target.value)}
            placeholder="Ex. Consultant IA générative pour PME industrielles"
          />
        </StrategyField>

        <StrategyField
          field="profile-bio"
          controlId="profile-bio"
          label="Biographie"
          help="Quelques lignes sur votre parcours et ce qui vous rend crédible. Le récit court, pas le curriculum : il situe votre légitimité dans les posts qui la mobilisent."
          align="start"
        >
          <textarea
            value={profile.bio}
            onChange={(event) => onUpdate("bio", event.target.value)}
            placeholder="Ex. J'aide les dirigeants à passer d'expérimentations floues à des cas d'usage rentables."
          />
        </StrategyField>

        <StrategyField
          field="profile-expertise"
          controlId="profile-expertise"
          label="Résumé d'expertise"
          help="Vos domaines de compétence, listés simplement. Le modèle s'en sert pour choisir des exemples que vous pourrez assumer."
          align="start"
        >
          <textarea
            value={profile.expertiseSummary}
            onChange={(event) => onUpdate("expertiseSummary", event.target.value)}
            placeholder="Ex. Audit IA, cadrage des cas d'usage, copilotes métier, adoption terrain."
          />
        </StrategyField>
      </div>

      <CompletenessIndicator
        filled={filled}
        total={4}
        unitOne="champ"
        unitMany="champs"
        emptyLabel="Aucun champ renseigné"
        consequence={consequence}
      />
    </section>
  );
}

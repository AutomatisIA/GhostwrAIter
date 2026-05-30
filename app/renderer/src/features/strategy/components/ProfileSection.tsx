import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { Field } from "../../../design-system/primitives";
import { CompletenessIndicator } from "./CompletenessIndicator";

type ProfileSectionProps = {
  profile: StrategyBundleInput["profile"];
  onUpdate: (field: keyof StrategyBundleInput["profile"], value: string) => void;
};

function isFilled(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function ProfileSection({ profile, onUpdate }: ProfileSectionProps) {
  const fields = [profile.name, profile.positioning, profile.bio, profile.expertiseSummary];
  const filled = fields.filter(isFilled).length;
  const critical = !isFilled(profile.name) || !isFilled(profile.positioning);

  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2>Profil et positionnement</h2>
          <p>Le minimum pour comprendre votre métier, votre promesse et votre angle éditorial.</p>
        </div>
      </div>

      <CompletenessIndicator
        variant="fields"
        filled={filled}
        total={fields.length}
        critical={critical}
        impactedSkill="post-writer"
      />

      <div className="strategy-fields">
        <Field
          label="Nom"
          htmlFor="profile-name"
          hint="Le nom affiché et signé sous vos posts."
        >
          <input
            value={profile.name}
            onChange={(event) => onUpdate("name", event.target.value)}
            placeholder="Ex. Philippe"
          />
        </Field>

        <Field
          label="Positionnement"
          htmlFor="profile-positioning"
          hint="En une phrase : pour qui vous travaillez et le problème que vous résolvez."
          example="Consultant IA générative pour PME industrielles."
        >
          <input
            value={profile.positioning}
            onChange={(event) => onUpdate("positioning", event.target.value)}
            placeholder="Ex. Consultant IA générative pour PME industrielles"
          />
        </Field>

        <Field
          label="Bio"
          htmlFor="profile-bio"
          hint="Quelques lignes sur votre parcours et ce qui vous rend crédible."
        >
          <textarea
            value={profile.bio}
            onChange={(event) => onUpdate("bio", event.target.value)}
            rows={4}
            placeholder="Ex. J'aide les dirigeants à passer d'expérimentations floues à des cas d'usage rentables."
          />
        </Field>

        <Field
          label="Résumé d'expertise"
          htmlFor="profile-expertise"
          hint="Vos domaines de compétence, listés simplement."
          example="Audit IA, cadrage des cas d'usage, copilotes métier, adoption terrain."
        >
          <textarea
            value={profile.expertiseSummary}
            onChange={(event) => onUpdate("expertiseSummary", event.target.value)}
            rows={3}
            placeholder="Ex. Audit IA, cadrage des cas d'usage, copilotes métier, adoption terrain."
          />
        </Field>
      </div>
    </section>
  );
}

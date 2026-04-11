import type { StrategyBundleInput } from "@shared/schemas/strategy";

type ProfileSectionProps = {
  profile: StrategyBundleInput["profile"];
  onUpdate: (field: keyof StrategyBundleInput["profile"], value: string) => void;
};

export function ProfileSection({ profile, onUpdate }: ProfileSectionProps) {
  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2>Profil et positionnement</h2>
          <p>Le minimum pour comprendre ton metier, ta promesse et ton angle editorial.</p>
        </div>
      </div>

      <label className="field">
        <span>Nom</span>
        <input
          aria-label="Nom"
          value={profile.name}
          onChange={(event) => onUpdate("name", event.target.value)}
          placeholder="Ex. Philippe"
        />
      </label>

      <label className="field">
        <span>Positionnement</span>
        <input
          aria-label="Positionnement"
          value={profile.positioning}
          onChange={(event) => onUpdate("positioning", event.target.value)}
          placeholder="Ex. Consultant IA generative pour PME industrielles"
        />
      </label>

      <label className="field">
        <span>Bio</span>
        <textarea
          aria-label="Bio"
          value={profile.bio}
          onChange={(event) => onUpdate("bio", event.target.value)}
          rows={4}
          placeholder="Ex. J'aide les dirigeants a passer d'experimentations floues a des cas d'usage rentables."
        />
      </label>

      <label className="field">
        <span>Resume d'expertise</span>
        <textarea
          aria-label="Resume d'expertise"
          value={profile.expertiseSummary}
          onChange={(event) => onUpdate("expertiseSummary", event.target.value)}
          rows={3}
          placeholder="Ex. Audit IA, cadrage des cas d'usage, copilotes metier, adoption terrain."
        />
      </label>
    </section>
  );
}

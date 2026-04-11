import type { StrategyBundleInput } from "@shared/schemas/strategy";

type PillarsSectionProps = {
  pillars: StrategyBundleInput["pillars"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: keyof StrategyBundleInput["pillars"][number],
    value: string | boolean
  ) => void;
};

export function PillarsSection({
  pillars,
  onAdd,
  onRemove,
  onUpdate
}: PillarsSectionProps) {
  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2>Piliers editoriaux</h2>
          <p>Les piliers servent a organiser le backlog, la bibliotheque et le calendrier.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onAdd}>
          Ajouter un pilier
        </button>
      </div>

      {pillars.map((pillar, index) => (
        <article key={`pillar-${index}`} className="editor-card">
          <div className="section-heading compact">
            <strong>Pilier {index + 1}</strong>
            <button
              type="button"
              className="secondary-button danger-button"
              onClick={() => onRemove(index)}
            >
              Retirer
            </button>
          </div>

          <label className="field">
            <span>Label du pilier {index + 1}</span>
            <input
              aria-label={`Label du pilier ${index + 1}`}
              value={pillar.label}
              onChange={(event) => onUpdate(index, "label", event.target.value)}
              placeholder="Ex. Adoption IA"
            />
          </label>

          <label className="field">
            <span>Description du pilier</span>
            <textarea
              rows={2}
              value={pillar.description ?? ""}
              onChange={(event) => onUpdate(index, "description", event.target.value)}
              placeholder="Ex. Comment cadrer, embarquer l'equipe et deployer sans friction."
            />
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={pillar.isDefault}
              onChange={(event) => onUpdate(index, "isDefault", event.target.checked)}
            />
            <span>Pilier par defaut</span>
          </label>
        </article>
      ))}
    </section>
  );
}

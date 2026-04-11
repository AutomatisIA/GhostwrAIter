import type { PostObjective, PostTypology } from "@shared/types/workshop";
import { OBJECTIVES, TYPOLOGIES } from "../constants";

type CadragePanelProps = {
  typology: PostTypology;
  onTypologyChange: (typology: PostTypology) => void;
  objective: PostObjective;
  onObjectiveChange: (objective: PostObjective) => void;
  onNext: () => void;
};

export function CadragePanel({
  typology,
  onTypologyChange,
  objective,
  onObjectiveChange,
  onNext
}: CadragePanelProps) {
  return (
    <div className="workshop-step">
      <h3>Choisis l'angle et l'objectif</h3>
      <p className="step-description">
        Commence par definir le type de post et son objectif prioritaire.
        Cela sert a orienter la structure et le niveau de tension du draft.
      </p>
      <div className="grid-selection">
        {TYPOLOGIES.map((t) => (
          <article
            key={t.value}
            className={`selection-card ${typology === t.value ? "selected" : ""}`}
            onClick={() => onTypologyChange(t.value)}
          >
            <strong>{t.label}</strong>
            <p>{t.description}</p>
          </article>
        ))}
      </div>
      <div className="input-group">
        <label>Objectif prioritaire</label>
        <select
          value={objective}
          onChange={(e) => onObjectiveChange(e.target.value as PostObjective)}
        >
          {OBJECTIVES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <button className="primary-button" onClick={onNext}>
          Suivant : Structure
        </button>
      </div>
    </div>
  );
}

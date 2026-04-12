import type { HookOption, PostObjective, PostTypology, StructureOption } from "@shared/types/workshop";
import { STEP_LABELS, TYPOLOGIES, formatObjectiveLabel, formatTypologyDescription } from "../constants";

type WorkshopGuideProps = {
  step: number;
  status: string;
  typology: PostTypology;
  objective: PostObjective;
  selectedStructure: StructureOption | undefined;
  selectedHook: HookOption | undefined;
};

export function WorkshopGuide({
  step,
  status,
  typology,
  objective,
  selectedStructure,
  selectedHook
}: WorkshopGuideProps) {
  return (
    <aside className="workshop-guide">
      <article className="editor-card">
        <span className="status-label">Parcours de production</span>
        <strong>{STEP_LABELS[step - 1]}</strong>
        <p>
          L'atelier te montre a chaque etape ce qui a deja ete choisi et ce qu'il
          reste a decider avant le draft final.
        </p>
        <div className="stepper-nav">
          {STEP_LABELS.map((label, index) => (
            <div key={label} className={`step-item ${step >= index + 1 ? "active" : ""}`}>
              {label}
            </div>
          ))}
        </div>
      </article>

      <article className="editor-card">
        <span className="status-label">Resume courant</span>
        <div className="workshop-summary">
          <div>
            <span className="status-label">Typologie retenue</span>
            <strong>{TYPOLOGIES.find((item) => item.value === typology)?.label}</strong>
            <p>{formatTypologyDescription(typology)}</p>
          </div>
          <div>
            <span className="status-label">Objectif retenu</span>
            <strong>{formatObjectiveLabel(objective)}</strong>
          </div>
          <div>
            <span className="status-label">Structure</span>
            <strong>
              {selectedStructure?.label
                ? selectedStructure.label.split(/\s*->\s*/).map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 ? <span style={{ color: "var(--color-accent-sky)", margin: "0 6px" }}>›</span> : null}
                    </span>
                  ))
                : "Pas encore choisie"}
            </strong>
          </div>
          <div>
            <span className="status-label">Accroche</span>
            <strong>{selectedHook?.text ?? "Pas encore choisie"}</strong>
          </div>
        </div>
      </article>

      <article className="editor-card">
        <span className="status-label">Etat actuel</span>
        <p className="form-status">{status}</p>
      </article>
    </aside>
  );
}

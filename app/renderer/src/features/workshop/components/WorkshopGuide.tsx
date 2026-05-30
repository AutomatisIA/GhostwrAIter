import type { HookOption, PostObjective, PostTypology, StructureOption } from "@shared/types/workshop";
import { Card, Stepper } from "../../../design-system/primitives";
import type { StepDescriptor } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { STEP_LABELS, TYPOLOGIES, formatObjectiveLabel, formatTypologyDescription } from "../constants";

type WorkshopGuideProps = {
  step: number;
  status: string;
  typology: PostTypology;
  objective: PostObjective;
  selectedStructure: StructureOption | undefined;
  selectedHook: HookOption | undefined;
};

// Le `Stepper` rend son propre marqueur numéroté (ou ✓). On retire donc le
// préfixe « N. » des libellés pour éviter un double numéro à l'affichage.
const STEPPER_STEPS: StepDescriptor[] = STEP_LABELS.map((label, index) => ({
  key: `step-${index + 1}`,
  label: label.replace(/^\d+\.\s*/, "")
}));

function renderStructureLabel(label: string) {
  return label.split(/\s*->\s*/).map((part, i, arr) => (
    <span key={i}>
      {part}
      {i < arr.length - 1 ? (
        <span className="workshop-structure-arrow" aria-hidden="true">
          {" › "}
        </span>
      ) : null}
    </span>
  ));
}

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
      <Card elevation={2} className="workshop-guide-card">
        <span className="status-label">Parcours de production</span>
        <strong>{STEP_LABELS[step - 1]}</strong>
        <p>
          L'atelier te montre à chaque étape ce qui a déjà été choisi et ce qu'il
          reste à décider avant le draft final.
        </p>
        {/* Stepper : etats distincts completed/current/upcoming, aria-current.
            currentIndex est 0-base alors que `step` est 1-base. */}
        <Stepper steps={STEPPER_STEPS} currentIndex={step - 1} />
      </Card>

      <Card elevation={1} className="workshop-guide-card">
        <span className="status-label">Résumé courant</span>
        <div className="workshop-summary">
          <div>
            <span className="status-label">
              Typologie retenue <InfoHint term="typologie" />
            </span>
            <strong>{TYPOLOGIES.find((item) => item.value === typology)?.label}</strong>
            <p>{formatTypologyDescription(typology)}</p>
          </div>
          <div>
            <span className="status-label">
              Objectif retenu <InfoHint term="objectif" />
            </span>
            <strong>{formatObjectiveLabel(objective)}</strong>
          </div>
          <div>
            <span className="status-label">
              Structure <InfoHint term="structure" />
            </span>
            <strong>
              {selectedStructure?.label
                ? renderStructureLabel(selectedStructure.label)
                : "Pas encore choisie"}
            </strong>
          </div>
          <div>
            <span className="status-label">
              Accroche <InfoHint term="accroche" />
            </span>
            <strong>{selectedHook?.text ?? "Pas encore choisie"}</strong>
          </div>
        </div>
      </Card>

      <Card elevation={1} className="workshop-guide-card">
        <span className="status-label">État actuel</span>
        <p className="form-status">{status}</p>
      </Card>
    </aside>
  );
}

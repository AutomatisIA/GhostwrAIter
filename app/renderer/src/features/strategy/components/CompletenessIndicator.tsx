import { Tooltip } from "../../../design-system/primitives";

const SEGMENT_COUNT = 5;
const WHY_TEXT =
  "Plus cette section est renseignée, meilleure est la qualité des posts générés par l'IA. Une section vide dégrade le résultat. Il n'y a pas de nombre imposé.";

type BaseProps = {
  critical: boolean;
  impactedSkill: string;
};

type FieldsProps = BaseProps & {
  variant: "fields";
  filled: number;
  total: number;
};

type ListProps = BaseProps & {
  variant: "list";
  count: number;
  itemNoun: string;
};

type CompletenessIndicatorProps = FieldsProps | ListProps;

function InfoButton() {
  return (
    <Tooltip content={WHY_TEXT}>
      <button
        type="button"
        className="completeness-info"
        aria-label="Pourquoi cette section compte"
      >
        ?
      </button>
    </Tooltip>
  );
}

export function CompletenessIndicator(props: CompletenessIndicatorProps) {
  if (props.variant === "list") {
    const { count, itemNoun, critical, impactedSkill } = props;
    const plural = count > 1 ? "s" : "";
    return (
      <div className="completeness-indicator">
        <div className="completeness-header">
          <span className="completeness-title">Renseignement de la section</span>
          <InfoButton />
          <span
            className={`completeness-state ${count > 0 ? "ok" : "empty"}`}
            role="status"
          >
            {count > 0 ? `${count} ${itemNoun}${plural}` : "Aucun élément"}
          </span>
        </div>
        {critical ? (
          <span className="completeness-badge" role="status">
            Section vide : impactera la qualité de {impactedSkill}
          </span>
        ) : null}
      </div>
    );
  }

  const { filled, total, critical, impactedSkill } = props;
  const ratio = total === 0 ? 0 : Math.max(0, Math.min(1, filled / total));
  const litSegments = Math.round(ratio * SEGMENT_COUNT);
  const complete = filled >= total && total > 0;

  return (
    <div className="completeness-indicator">
      <div className="completeness-header">
        <span className="completeness-title">Complétude du profil</span>
        <InfoButton />
        <span className="completeness-count">
          {complete ? "Complet" : `${filled} / ${total} champs renseignés`}
        </span>
      </div>
      <div
        className="completeness-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={SEGMENT_COUNT}
        aria-valuenow={litSegments}
        aria-label={`Complétude du profil : ${litSegments} sur ${SEGMENT_COUNT}`}
      >
        {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
          <span
            key={index}
            className={`completeness-segment ${index < litSegments ? "lit" : ""}`}
          />
        ))}
      </div>
      {critical ? (
        <span className="completeness-badge" role="status">
          Profil incomplet : impactera la qualité de {impactedSkill}
        </span>
      ) : null}
    </div>
  );
}

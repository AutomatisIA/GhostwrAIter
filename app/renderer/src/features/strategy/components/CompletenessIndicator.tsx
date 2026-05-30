type CompletenessIndicatorProps = {
  filled: number;
  total: number;
  critical: boolean;
  impactedSkill: string;
};

const SEGMENT_COUNT = 5;

export function CompletenessIndicator({
  filled,
  total,
  critical,
  impactedSkill
}: CompletenessIndicatorProps) {
  const ratio = total === 0 ? 0 : Math.max(0, Math.min(1, filled / total));
  const litSegments = Math.round(ratio * SEGMENT_COUNT);

  return (
    <div className="completeness-indicator">
      <div
        className="completeness-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={SEGMENT_COUNT}
        aria-valuenow={litSegments}
        aria-label={`Section remplie à ${litSegments} sur ${SEGMENT_COUNT}`}
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
          Section incomplète : impactera la qualité de {impactedSkill}
        </span>
      ) : null}
    </div>
  );
}

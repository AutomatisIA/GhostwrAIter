import type { StructureOption } from "@shared/types/workshop";

type StructurePanelProps = {
  structures: StructureOption[];
  selectedStructureKey: string;
  onSelect: (key: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
  isLoadingNext: boolean;
};

export function StructurePanel({
  structures,
  selectedStructureKey,
  onSelect,
  onBack,
  onNext,
  isLoading,
  isLoadingNext
}: StructurePanelProps) {
  return (
    <div className="workshop-step">
      <h3>Selectionne une structure narrative</h3>
      <p className="step-description">
        La structure determine l'ordre du raisonnement. Choisis celle qui
        sert le mieux l'idee et l'objectif retenu.
      </p>
      <div className="grid-selection">
        {isLoading ? (
          <>
            <article className="selection-card skeleton-card" aria-busy="true" />
            <article className="selection-card skeleton-card" aria-busy="true" />
            <article className="selection-card skeleton-card" aria-busy="true" />
          </>
        ) : (
          structures.map((s) => (
            <article
              key={s.key}
              className={`selection-card ${selectedStructureKey === s.key ? "selected" : ""}`}
              onClick={() => onSelect(s.key)}
            >
              <strong>{s.label}</strong>
              <p>{s.rationale}</p>
            </article>
          ))
        )}
      </div>
      <div className="form-actions">
        <button className="secondary-button" onClick={onBack}>
          Retour
        </button>
        <button
          className="primary-button"
          onClick={onNext}
          disabled={isLoading || isLoadingNext || structures.length === 0}
        >
          {isLoadingNext ? (
            <>
              <span className="spinner-inline" aria-hidden="true" />
              Generation en cours...
            </>
          ) : (
            "Suivant : Accroche"
          )}
        </button>
      </div>
    </div>
  );
}

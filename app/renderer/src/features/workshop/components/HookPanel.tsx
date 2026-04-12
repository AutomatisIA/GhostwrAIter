import type { HookOption } from "@shared/types/workshop";

type HookPanelProps = {
  hooks: HookOption[];
  selectedHookId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
  isLoadingNext: boolean;
};

export function HookPanel({
  hooks,
  selectedHookId,
  onSelect,
  onBack,
  onNext,
  isLoading,
  isLoadingNext
}: HookPanelProps) {
  return (
    <div className="workshop-step">
      <h3>Choisis ton accroche (Hook)</h3>
      <p className="step-description">
        L'accroche sert a faire entrer le lecteur dans le sujet. Le score
        donne un signal de potentiel, pas une verite absolue.
      </p>
      <div className="list-selection">
        {isLoading ? (
          <>
            <article className="selection-card list-card skeleton-card" aria-busy="true" />
            <article className="selection-card list-card skeleton-card" aria-busy="true" />
            <article className="selection-card list-card skeleton-card" aria-busy="true" />
          </>
        ) : (
          hooks.map((h) => (
            <article
              key={h.id}
              className={`selection-card list-card ${selectedHookId === h.id ? "selected" : ""}`}
              onClick={() => onSelect(h.id)}
            >
              <div className="status-label">{h.family}</div>
              <p>{h.text}</p>
              <div className="score-badge">{Math.round(h.score * 100)}%</div>
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
          disabled={isLoading || isLoadingNext || hooks.length === 0}
        >
          {isLoadingNext ? (
            <>
              <span className="spinner-inline" aria-hidden="true" />
              Generation en cours...
            </>
          ) : (
            "Generer le draft final"
          )}
        </button>
      </div>
    </div>
  );
}

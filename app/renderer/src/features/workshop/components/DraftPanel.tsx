import type {
  HookOption,
  PostObjective,
  PostTypology,
  StructureOption,
  WorkshopSession
} from "@shared/types/workshop";
import { TYPOLOGIES, formatObjectiveLabel, getQualityFeedback } from "../constants";

type DraftPanelProps = {
  session: WorkshopSession;
  typology: PostTypology;
  objective: PostObjective;
  selectedStructureKey: string;
  selectedStructure: StructureOption | undefined;
  selectedHook: HookOption | undefined;
  onReopenCadrage: () => void;
  onReopenStructureSelection: () => void;
  onReopenHookSelection: () => void;
  onCorrect: () => void;
  isLoadingCorrection: boolean;
};

export function DraftPanel({
  session,
  typology,
  objective,
  selectedStructureKey,
  selectedStructure,
  selectedHook,
  onReopenCadrage,
  onReopenStructureSelection,
  onReopenHookSelection,
  onCorrect,
  isLoadingCorrection
}: DraftPanelProps) {
  const qualityFeedback = getQualityFeedback(session.draft.qualityScore);

  return (
    <div className="workshop-layout">
      <div className="workshop-sidebar">
        <article className="list-card">
          <div className="status-label">Pret a publier ou retravailler</div>
          <strong>{session.draft.headline}</strong>
          <p>
            Le draft est genere. Tu peux maintenant le corriger, le relire
            ou l'envoyer dans la bibliotheque puis au calendrier.
          </p>
        </article>

        <article className="list-card">
          <div className="status-label">Lecture critique</div>
          <strong>{qualityFeedback.title}</strong>
          <p>{qualityFeedback.message}</p>
        </article>

        <article className="list-card">
          <div className="status-label">Contexte utilise</div>
          <p>Pilier : {session.contextUsed.pillarLabel}</p>
          <p>Voix : {session.contextUsed.voiceGuardrail}</p>
          <p>Skills : {session.contextUsed.activeSkills.join(", ")}</p>
        </article>

        <article className="list-card">
          <div className="status-label">Configuration</div>
          <p>Typologie : {TYPOLOGIES.find((item) => item.value === typology)?.label}</p>
          <p>Objectif : {formatObjectiveLabel(objective)}</p>
          <p>Structure : {selectedStructure?.label ?? selectedStructureKey}</p>
          <p>
            Accroche : {selectedHook?.text ?? session.draft.selectedHookText ?? "Non definie"}
          </p>
        </article>

        <div className="workshop-summary">
          <button className="secondary-button full-width" onClick={onReopenCadrage}>
            Revoir le cadrage
          </button>
          <button className="secondary-button full-width" onClick={onReopenStructureSelection}>
            Changer la structure
          </button>
          <button className="secondary-button full-width" onClick={onReopenHookSelection}>
            Changer l'accroche
          </button>
        </div>

        <button
          className="secondary-button full-width"
          onClick={onCorrect}
          disabled={isLoadingCorrection}
        >
          {isLoadingCorrection ? (
            <>
              <span className="spinner-inline" aria-hidden="true" />
              Generation en cours...
            </>
          ) : (
            "Lancer la correction premium"
          )}
        </button>
      </div>

      <article className="list-card workshop-draft main-content">
        <div className="status-label">Post Final</div>
        <strong>{session.draft.headline}</strong>
        <div className="draft-body">
          {session.draft.bodyMarkdown.split("\n").map((line, i) => (
            <p key={i}>{line || "\u00A0"}</p>
          ))}
        </div>
        <div className="quality-row">
          <span>Qualite estimée</span>
          <strong>{Math.round(session.draft.qualityScore * 100)}%</strong>
        </div>
      </article>
    </div>
  );
}

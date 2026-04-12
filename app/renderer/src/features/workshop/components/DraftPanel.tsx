import { useState } from "react";
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
  onSaveDraftText: (headline: string, bodyMarkdown: string) => void;
  isSavingDraftText: boolean;
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
  isLoadingCorrection,
  onSaveDraftText,
  isSavingDraftText
}: DraftPanelProps) {
  const qualityFeedback = getQualityFeedback(session.draft.qualityScore);
  const [isEditing, setIsEditing] = useState(false);
  const [editHeadline, setEditHeadline] = useState(session.draft.headline);
  const [editBody, setEditBody] = useState(session.draft.bodyMarkdown);
  const [copyLabel, setCopyLabel] = useState("Copier le post");

  function handleStartEditing() {
    setEditHeadline(session.draft.headline);
    setEditBody(session.draft.bodyMarkdown);
    setIsEditing(true);
  }

  function handleCancelEditing() {
    setIsEditing(false);
  }

  function handleSave() {
    onSaveDraftText(editHeadline, editBody);
    setIsEditing(false);
  }

  function handleCopyPost() {
    const text = session.draft.headline + "\n\n" + session.draft.bodyMarkdown;
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel("Copie !");
      setTimeout(() => setCopyLabel("Copier le post"), 1500);
    });
  }

  return (
    <div className="workshop-layout">
      <div className="workshop-sidebar">
        <article className="list-card">
          <div className="status-label">Pret a publier ou retravailler</div>
          <strong>{session.draft.headline}</strong>
          <p>
            Le draft est genere. Tu peux le modifier a la main, lancer une
            correction premium ou l'envoyer dans la bibliotheque puis au calendrier.
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
          <p>Structure : {selectedStructure?.label
            ? selectedStructure.label.split(/\s*->\s*/).map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 ? <span style={{ color: "var(--color-accent-sky)", margin: "0 6px" }}>›</span> : null}
                </span>
              ))
            : selectedStructureKey}</p>
          <p>
            Accroche : {selectedHook?.text ?? session.draft.selectedHookText ?? "Non definie"}
          </p>
        </article>

        <div className="workshop-summary">
          <button type="button" className="secondary-button full-width" onClick={onReopenCadrage}>
            Revoir le cadrage
          </button>
          <button type="button" className="secondary-button full-width" onClick={onReopenStructureSelection}>
            Changer la structure
          </button>
          <button type="button" className="secondary-button full-width" onClick={onReopenHookSelection}>
            Changer l'accroche
          </button>
        </div>

        {!isEditing ? (
          <button
            type="button"
            className="primary-button full-width"
            onClick={handleStartEditing}
            disabled={isLoadingCorrection || isSavingDraftText}
          >
            Modifier le texte
          </button>
        ) : null}

        {session.draft.qualityScore < 0.85 && !isEditing ? (
          <span className="correction-hint">
            Score actuel : {Math.round(session.draft.qualityScore * 100)}% — correction recommandee
          </span>
        ) : null}

        <button
          type="button"
          className={`secondary-button full-width ${session.draft.qualityScore < 0.85 && !isEditing ? "correction-recommended" : ""}`}
          onClick={onCorrect}
          disabled={isLoadingCorrection || isEditing}
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
        <div className="status-label">{isEditing ? "Mode edition" : "Post Final"}</div>
        {isEditing ? (
          <>
            <input
              className="draft-edit-headline"
              value={editHeadline}
              onChange={(e) => setEditHeadline(e.target.value)}
              aria-label="Titre du post"
            />
            <textarea
              className="draft-edit-body"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={16}
              aria-label="Corps du post"
            />
            <div className="form-actions">
              <button
                type="button"
                className="primary-button"
                onClick={handleSave}
                disabled={isSavingDraftText || !editHeadline.trim() || !editBody.trim()}
              >
                {isSavingDraftText ? (
                  <>
                    <span className="spinner-inline" aria-hidden="true" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer"
                )}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleCancelEditing}
                disabled={isSavingDraftText}
              >
                Annuler
              </button>
            </div>
          </>
        ) : (
          <>
            <strong>{session.draft.headline}</strong>
            <div className="draft-body">
              {session.draft.bodyMarkdown.split("\n").map((line, i) => (
                <p key={i}>{line || "\u00A0"}</p>
              ))}
            </div>
            <div className="quality-row">
              <span>Qualite estimee</span>
              <strong>{Math.round(session.draft.qualityScore * 100)}%</strong>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handleCopyPost}
              >
                {copyLabel}
              </button>
            </div>
          </>
        )}
      </article>
    </div>
  );
}

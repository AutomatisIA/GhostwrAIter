import { useEffect, useMemo, useState } from "react";
import type {
  HookOption,
  PostObjective,
  PostTypology,
  StructureOption,
  WorkshopSession
} from "@shared/types/workshop";
import { detectTells, type TellFamilyId } from "../../../../../shared/ai-tells";
import { Button, Card } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { formatCharCount } from "../../../../../shared/post-metrics";
import { TYPOLOGIES, formatObjectiveLabel, getQualityFeedback } from "../constants";
import {
  AI_TELL_FAMILIES_PREFERENCE_KEY,
  parseTellFamiliesPreference
} from "../../ai-tells/tellsPreference";
import { AiTellsReport } from "./AiTellsReport";

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
  const [enabledTellFamilies, setEnabledTellFamilies] = useState<TellFamilyId[] | undefined>(
    undefined
  );

  const correctionRecommended = session.draft.qualityScore < 0.85 && !isEditing;

  // Lue au montage, comme la preference de theme : un changement fait dans
  // l'onglet Voix pendant que cet ecran est deja ouvert ne se propage pas ici
  // tant que le composant n'est pas remonte.
  useEffect(() => {
    window.linkedinPoster.settings
      .getPreference(AI_TELL_FAMILIES_PREFERENCE_KEY)
      .then(({ value }: { value: string | null }) => {
        setEnabledTellFamilies(parseTellFamiliesPreference(value));
      })
      .catch(() => {});
  }, []);

  const tellReport = useMemo(
    () => detectTells(session.draft.bodyMarkdown, enabledTellFamilies),
    [session.draft.bodyMarkdown, enabledTellFamilies]
  );

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
      setCopyLabel("Copié !");
      setTimeout(() => setCopyLabel("Copier le post"), 1500);
    });
  }

  return (
    <div className="workshop-layout">
      <div className="workshop-sidebar">
        <Card elevation={1}>
          <div className="status-label">Prêt à publier ou retravailler</div>
          <strong>{session.draft.headline}</strong>
          <p>
            Le draft est généré. Tu peux le modifier à la main, lancer une
            correction premium ou l'envoyer dans la bibliothèque puis au calendrier.
          </p>
        </Card>

        <Card elevation={1}>
          <div className="status-label">Lecture critique</div>
          <strong>{qualityFeedback.title}</strong>
          <p>{qualityFeedback.message}</p>
        </Card>

        <Card elevation={1}>
          <div className="status-label">
            Contexte utilisé <InfoHint term="pilier" />
          </div>
          <p>Pilier : {session.contextUsed.pillarLabel}</p>
          <p>Voix : {session.contextUsed.voiceGuardrail}</p>
          <p>Skills : {session.contextUsed.activeSkills.join(", ")}</p>
        </Card>

        <Card elevation={1}>
          <div className="status-label">Configuration</div>
          <p>Typologie : {TYPOLOGIES.find((item) => item.value === typology)?.label}</p>
          <p>Objectif : {formatObjectiveLabel(objective)}</p>
          <p>
            Structure :{" "}
            {selectedStructure?.label
              ? renderStructureLabel(selectedStructure.label)
              : selectedStructureKey}
          </p>
          <p>
            Accroche : {selectedHook?.text ?? session.draft.selectedHookText ?? "Non définie"}
          </p>
        </Card>

        {/* Navigation de retour : hierarchie attenuee (ghost) pour ne pas
            concurrencer l'action premium. */}
        <div className="workshop-summary">
          <Button variant="ghost" className="full-width" onClick={onReopenCadrage}>
            Revoir le cadrage
          </Button>
          <Button variant="ghost" className="full-width" onClick={onReopenStructureSelection}>
            Changer la structure
          </Button>
          <Button variant="ghost" className="full-width" onClick={onReopenHookSelection}>
            Changer l'accroche
          </Button>
        </div>

        {/* Action dominante : la correction premium est l'acte fort de l'étape.
            La modification manuelle reste secondaire. */}
        <Button
          variant="primary"
          className="full-width"
          onClick={onCorrect}
          loading={isLoadingCorrection}
          disabled={isLoadingCorrection || isEditing}
        >
          {isLoadingCorrection ? "Correction en cours…" : "Lancer la correction premium"}
        </Button>

        {correctionRecommended ? (
          <span className="correction-hint">
            Score actuel : {Math.round(session.draft.qualityScore * 100)}%. Correction recommandée.
          </span>
        ) : null}

        {!isEditing ? (
          <Button
            variant="secondary"
            className="full-width"
            onClick={handleStartEditing}
            disabled={isLoadingCorrection || isSavingDraftText}
          >
            Modifier le texte
          </Button>
        ) : null}
      </div>

      <Card elevation={2} className="workshop-draft main-content" as="article">
        <div className="status-label">{isEditing ? "Mode édition" : "Post final"}</div>
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
              <Button
                variant="primary"
                onClick={handleSave}
                loading={isSavingDraftText}
                disabled={isSavingDraftText || !editHeadline.trim() || !editBody.trim()}
              >
                {isSavingDraftText ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button variant="ghost" onClick={handleCancelEditing} disabled={isSavingDraftText}>
                Annuler
              </Button>
            </div>
          </>
        ) : (
          <>
            <strong>{session.draft.headline}</strong>
            <div className="draft-body">
              {session.draft.bodyMarkdown.split("\n").map((line, i) => (
                <p key={i}>{line || " "}</p>
              ))}
            </div>
            <div className="quality-row">
              <span>Longueur</span>
              <strong>{formatCharCount(session.draft.bodyMarkdown)}</strong>
            </div>
            <AiTellsReport hits={tellReport.hits} />
            <div className="form-actions">
              <Button variant="secondary" onClick={handleCopyPost}>
                {copyLabel}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

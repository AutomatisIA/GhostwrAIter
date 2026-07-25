import { useEffect, useMemo, useState } from "react";
import type { WorkshopSession } from "@shared/types/workshop";
import { detectTells, type TellFamilyId } from "../../../../../shared/ai-tells";
import { Button } from "../../../design-system/primitives";
import { LINKEDIN_MAX_CHARS, measurePost } from "../../../../../shared/post-metrics";
import {
  AI_TELL_FAMILIES_PREFERENCE_KEY,
  parseTellFamiliesPreference
} from "../../ai-tells/tellsPreference";
import { AiTellsReport } from "./AiTellsReport";
import { CorrectionDiff } from "./CorrectionDiff";
import { PostPreview } from "./PostPreview";
import { buildMarkedParagraphs, describeFamilies } from "./marked-text";

type DraftPanelProps = {
  session: WorkshopSession;
  onReopenStructureSelection: () => void;
  onReopenHookSelection: () => void;
  onCorrect: () => void;
  isLoadingCorrection: boolean;
  onSaveDraftText: (headline: string, bodyMarkdown: string) => void;
  isSavingDraftText: boolean;
};

function formatRemaining(chars: number): { label: string; over: boolean } {
  const remaining = LINKEDIN_MAX_CHARS - chars;
  if (remaining < 0) {
    return {
      label: `${Math.abs(remaining).toLocaleString("fr-FR")} caractères au-delà de la limite`,
      over: true
    };
  }
  return { label: `${remaining.toLocaleString("fr-FR")} caractères restants`, over: false };
}

/**
 * Etape finale de l atelier : le texte a gauche, l apercu du fil a droite.
 *
 * Le compteur d en-tete affiche les caracteres RESTANTS, pas un pourcentage de
 * qualite. Le score que cet ecran montrait etait une auto-evaluation du modele :
 * entre deux corpus, il est passe de 84 a 82 % pendant que le taux de defauts
 * reels baissait de pres de deux tiers (docs/audit-2026-07-editorial.md,
 * section 6). Un produit dont la premiere regle editoriale est « zero chiffre
 * invente » ne peut pas en afficher un a chaque brouillon.
 */
export function DraftPanel({
  session,
  onReopenStructureSelection,
  onReopenHookSelection,
  onCorrect,
  isLoadingCorrection,
  onSaveDraftText,
  isSavingDraftText
}: DraftPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editHeadline, setEditHeadline] = useState(session.draft.headline);
  const [editBody, setEditBody] = useState(session.draft.bodyMarkdown);
  const [copyLabel, setCopyLabel] = useState("Copier le post");
  const [enabledTellFamilies, setEnabledTellFamilies] = useState<TellFamilyId[] | undefined>(
    undefined
  );

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

  /**
   * Texte tel qu il etait juste avant la derniere correction. Sans lui,
   * l utilisateur ne peut pas savoir ce que la correction a change, ni meme
   * qu elle a eu lieu.
   */
  const lastCorrection = (() => {
    const versions = session.versions ?? [];
    const index = versions.map((v) => v.reason).lastIndexOf("correction");
    if (index <= 0) return null;
    return { before: versions[index - 1]!.bodyMarkdown };
  })();

  const tellReport = useMemo(
    () => detectTells(session.draft.bodyMarkdown, enabledTellFamilies),
    [session.draft.bodyMarkdown, enabledTellFamilies]
  );

  const paragraphs = useMemo(
    () => buildMarkedParagraphs(session.draft.bodyMarkdown, tellReport.hits),
    [session.draft.bodyMarkdown, tellReport.hits]
  );

  const remaining = formatRemaining(measurePost(session.draft.bodyMarkdown).chars);

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
    <div className="draft-screen">
      <div className="draft-main">
        <div className="draft-scroll">
          <header className="draft-head">
            <h2 className="draft-title">
              {isEditing ? "Réécriture du post" : session.draft.headline}
            </h2>
            <span
              className="draft-remaining"
              data-over={remaining.over ? "true" : undefined}
            >
              {remaining.label}
            </span>
          </header>

          {isEditing ? (
            <div className="draft-edit">
              <label className="ds-field__label" htmlFor="draft-edit-headline">
                Titre du post
              </label>
              <input
                id="draft-edit-headline"
                className="draft-edit-headline"
                value={editHeadline}
                onChange={(e) => setEditHeadline(e.target.value)}
              />
              <label className="ds-field__label" htmlFor="draft-edit-body">
                Corps du post
              </label>
              <textarea
                id="draft-edit-body"
                className="draft-edit-body"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={18}
              />
            </div>
          ) : (
            <>
              <div className="draft-text">
                {paragraphs.map((paragraph) => (
                  <p key={paragraph.key}>
                    {paragraph.segments.map((segment, index) =>
                      segment.families.length === 0 ? (
                        <span key={index}>{segment.text}</span>
                      ) : (
                        <button
                          key={index}
                          type="button"
                          className="draft-tell"
                          onClick={handleStartEditing}
                          title={`Marqueur d'écriture IA : ${describeFamilies(segment.families)}. Cliquez pour réécrire.`}
                        >
                          {segment.text}
                        </button>
                      )
                    )}
                  </p>
                ))}
              </div>

              <AiTellsReport hits={tellReport.hits} onFix={handleStartEditing} />

              {/* Derniere correction premium, s il y en a eu une. `versions` est
                  ordonne du plus ancien au plus recent : la version qui precede
                  la correction porte le texte d avant. */}
              {lastCorrection ? (
                <CorrectionDiff
                  before={lastCorrection.before}
                  after={session.draft.bodyMarkdown}
                />
              ) : null}
            </>
          )}
        </div>

        <div className="draft-actions">
          {isEditing ? (
            <>
              <Button
                variant="primary"
                size="lg"
                onClick={handleSave}
                loading={isSavingDraftText}
                disabled={isSavingDraftText || !editHeadline.trim() || !editBody.trim()}
              >
                {isSavingDraftText ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button variant="secondary" onClick={handleCancelEditing} disabled={isSavingDraftText}>
                Annuler
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" size="lg" onClick={handleCopyPost}>
                {copyLabel}
              </Button>
              <Button
                variant="secondary"
                onClick={handleStartEditing}
                disabled={isLoadingCorrection || isSavingDraftText}
              >
                Modifier le texte
              </Button>
              <Button
                variant="secondary"
                onClick={onCorrect}
                loading={isLoadingCorrection}
                disabled={isLoadingCorrection}
              >
                Correction premium
              </Button>
              <Button variant="ghost" onClick={onReopenHookSelection}>
                Changer l&apos;accroche
              </Button>
              <Button variant="ghost" onClick={onReopenStructureSelection}>
                Changer la structure
              </Button>
            </>
          )}
        </div>
      </div>

      <PostPreview
        bodyMarkdown={session.draft.bodyMarkdown}
        contextUsed={session.contextUsed}
      />
    </div>
  );
}

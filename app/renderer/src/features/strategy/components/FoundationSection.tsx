import { useState, type ReactNode } from "react";
import { Button } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { SectionHead } from "./SectionHead";

type FoundationSectionProps = {
  summary: string;
  outdated: boolean;
  /** Retour de generation en cours, rendu au-dessus du socle. */
  progress: ReactNode;
  /** Ecrit le socle retouche a la main. Meme chemin d enregistrement que la generation. */
  onApplyManualEdit: (value: string) => void;
};

/**
 * Onglet « Socle editorial ».
 *
 * Le bouton de generation n est plus ici : il a rejoint la barre de page, ou il
 * est atteignable depuis les six onglets. Ce qui reste dans le corps est ce qui
 * ne concerne que cet onglet : l explication, l avertissement de peremption, la
 * retouche a la main et le socle lui-meme.
 */
export function FoundationSection({
  summary,
  outdated,
  progress,
  onApplyManualEdit
}: FoundationSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEditing() {
    setDraft(summary);
    setIsEditing(true);
  }

  function applyEdit() {
    onApplyManualEdit(draft);
    setIsEditing(false);
  }

  return (
    <section className="strategy-section" aria-label="Socle éditorial">
      <SectionHead
        title="Socle éditorial"
        hint={<InfoHint term="socle-editorial" />}
        lead="Résumé structuré de votre stratégie, utilisé comme contexte par tous les modules de génération. Générez-le depuis votre profil, vos offres, vos ICPs et vos piliers, ou écrivez-le à la main."
        action={
          summary && !isEditing ? (
            <Button variant="secondary" onClick={startEditing}>
              Modifier à la main
            </Button>
          ) : null
        }
      />

      {outdated ? (
        <p className="strategy-outdated" role="status">
          La stratégie a été modifiée depuis la dernière génération du socle. Régénérez-le pour que
          les prochains brouillons utilisent les données à jour.
        </p>
      ) : null}

      {progress}

      {isEditing ? (
        <div className="strategy-foundation-editor">
          <textarea
            className="strategy-foundation-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Socle éditorial"
          />
          <div className="strategy-foundation-actions">
            <Button variant="primary" onClick={applyEdit}>
              Appliquer les modifications
            </Button>
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : summary ? (
        <div className="strategy-surface strategy-foundation-preview">{summary}</div>
      ) : (
        <p className="strategy-foundation-hint">
          Aucun socle éditorial généré. Remplissez d'abord les onglets Profil, Offres, ICPs et
          Piliers, puis lancez la génération depuis la barre en haut de l'écran.
        </p>
      )}
    </section>
  );
}

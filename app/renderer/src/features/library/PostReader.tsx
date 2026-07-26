import type { ReactNode } from "react";
import type { LibraryEntry } from "@shared/types/library";
import {
  LINKEDIN_FOLD_CHARS,
  LINKEDIN_MAX_CHARS,
  measurePost
} from "../../../../shared/post-metrics";
import { PillarDot } from "./meta-line";
import { formatNeverReviewed, formatVersionHistory, isNeverReviewed } from "./triage";

/** Etiquettes libres montrees en clair dans le panneau de metadonnees. */
const MAX_VISIBLE_TAGS = 3;

type PostReaderProps = {
  entry: LibraryEntry;
  /** Date posee dans le calendrier, quand il y en a une. */
  plannedDate?: string;
  now?: Date;
};

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="library-reader__meta-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Volet de droite : le post, lisible.
 *
 * C est la raison d etre de l ecran. Une liste bien rangee reste une liste de
 * fichiers : elle ne dira jamais lequel des trente est le plus pres d etre
 * publie, parce qu on juge un brouillon en le lisant. Le texte est donc pose ici
 * a sa mesure de lecture, soixante-huit caracteres, avec le trait de repli trace
 * DANS le texte a l endroit exact ou LinkedIn coupera.
 *
 * Le trait reprend le trace de l Atelier (`PostPreview`), a une valeur pres : le
 * fond de l etiquette suit la surface qui la porte. L Atelier pose son apercu
 * sur `--surface-raised`, ce volet-ci est sur `--surface-app` ; copier la valeur
 * sans la relire donnait un rectangle blanc sur fond gris en theme clair.
 */
export function PostReader({ entry, plannedDate, now }: PostReaderProps) {
  const metrics = measurePost(entry.bodyMarkdown);
  const after = [...(entry.bodyMarkdown ?? "")].slice(LINKEDIN_FOLD_CHARS).join("");
  const history = formatVersionHistory(entry, now);
  const neverReviewed = isNeverReviewed(entry);

  const extraTags = entry.tags.filter(
    (tag) => tag.trim().toLowerCase() !== entry.pillarLabel.trim().toLowerCase()
  );
  const shownTags = extraTags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTags = extraTags.slice(MAX_VISIBLE_TAGS);

  return (
    <div className="library-reader__read">
      <article className="library-reader__col">
        <h2 className="library-reader__title">{entry.headline}</h2>

        <div className="library-reader__text">
          <span>{metrics.visibleBeforeFold}</span>
          {metrics.isFolded ? (
            <>
              <span className="library-reader__fold" aria-hidden="true">
                <span className="library-reader__fold-label">Repli, {LINKEDIN_FOLD_CHARS}</span>
              </span>
              <span className="library-reader__after">{after}</span>
            </>
          ) : null}
        </div>
      </article>

      <dl className="library-reader__meta">
        <MetaRow label="Pilier">
          <span className="library-reader__pillar">
            <PillarDot />
            {entry.pillarLabel}
          </span>
        </MetaRow>

        <MetaRow label="Longueur">
          <span
            className={`library-reader__num${
              metrics.overLimit ? " library-row__attention" : ""
            }`}
          >
            {metrics.chars.toLocaleString("fr-FR")} sur {LINKEDIN_MAX_CHARS.toLocaleString("fr-FR")}
          </span>
        </MetaRow>

        {/* L historique existe en base depuis le premier jour et n etait affiche
            nulle part. Une seule version n est pas un historique : c est le
            signal qui bloque la publication, et il se dit en clair. */}
        {neverReviewed ? (
          <MetaRow label="Versions">
            <span className="library-row__attention">{formatNeverReviewed(entry)}</span>
          </MetaRow>
        ) : history ? (
          <MetaRow label="Versions">{history}</MetaRow>
        ) : null}

        {/* Pour qui ce post a ete ecrit. Omise plutot que rendue vide sur les
            brouillons anterieurs au champ : une ligne « Cible : rien » ferait
            croire a une donnee perdue la ou il n y en a jamais eu. */}
        {entry.targetIcpSegment ? (
          <MetaRow label="Cible">{entry.targetIcpSegment}</MetaRow>
        ) : null}

        {plannedDate ? (
          <MetaRow label="Publication prévue">
            <span className="library-reader__num">{plannedDate}</span>
          </MetaRow>
        ) : null}

        {shownTags.length > 0 ? (
          <MetaRow label="Mots clés">
            <span className="library-reader__tags">
              <span className="library-reader__tag-list">{shownTags.join(", ")}</span>
              {hiddenTags.length > 0 ? (
                <span className="library-row__more" title={hiddenTags.join(", ")}>
                  +{hiddenTags.length}
                </span>
              ) : null}
            </span>
          </MetaRow>
        ) : null}
      </dl>
    </div>
  );
}

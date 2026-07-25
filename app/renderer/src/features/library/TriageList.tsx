import type { ReactNode } from "react";
import type { LibraryEntry } from "@shared/types/library";
import { formatCharCount, measurePost } from "../../../../shared/post-metrics";
import { MetaLine } from "./meta-line";
import {
  MAX_ROWS_PER_GROUP,
  formatHiddenCount,
  formatLastModified,
  formatShownCount,
  formatVariantCount,
  isNeverReviewed,
  type SubjectGroup
} from "./triage";

type TriageListProps = {
  groups: readonly SubjectGroup[];
  selectedDraftId: string | null;
  onSelect: (draftId: string) => void;
  /** Cles des sujets dont la queue repliee est ouverte. */
  expandedKeys: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  /** Injectable pour que les libelles relatifs soient mesurables. */
  now?: Date;
};

/**
 * Metadonnees d une ligne de triage.
 *
 * Elles disent ce qu il reste a faire, pas ce que le brouillon est. « Jamais
 * relu » remplace donc le compte de versions quand il n y en a qu une : ce sont
 * deux facons de dire la meme chose, et c est la formulation en clair qui porte
 * l information utile.
 */
function rowMeta(entry: LibraryEntry, now: Date | undefined): ReactNode[] {
  const parts: ReactNode[] = [
    <span
      className={`library-row__num${
        measurePost(entry.bodyMarkdown).overLimit ? " library-row__num--over" : ""
      }`}
      key="chars"
    >
      {formatCharCount(entry.bodyMarkdown)}
    </span>
  ];

  if (isNeverReviewed(entry)) {
    parts.push(
      <span className="library-row__attention" key="never">
        jamais relu
      </span>
    );
    return parts;
  }

  if (typeof entry.versionCount === "number" && entry.versionCount >= 2) {
    parts.push(
      <span className="library-row__num" key="versions">
        {entry.versionCount} versions
      </span>
    );
  }

  const modified = formatLastModified(entry, now);
  if (modified) {
    parts.push(<span key="modified">{modified}</span>);
  }

  return parts;
}

/**
 * Volet de gauche : les brouillons de l entree de triage courante, regroupes par
 * sujet.
 *
 * Une ligne n y porte aucune action. Cinq actions par ligne sur trente lignes
 * saturaient la moitie de l ecran et faisaient de « Supprimer » le motif le plus
 * repete de l application ; elles vivent desormais sur le post selectionne, une
 * seule fois. Une ligne sert a choisir quoi lire, et rien d autre.
 */
export function TriageList({
  groups,
  selectedDraftId,
  onSelect,
  expandedKeys,
  onToggleGroup,
  now
}: TriageListProps) {
  return (
    <div className="library-groups">
      {groups.map((group) => {
        const expanded = expandedKeys.has(group.key);
        const hidden = Math.max(0, group.entries.length - MAX_ROWS_PER_GROUP);
        const shown = expanded ? group.entries : group.entries.slice(0, MAX_ROWS_PER_GROUP);
        const variants = formatVariantCount(group.entries.length);

        return (
          <section className="library-group" key={group.key}>
            <h2 className="library-group__head">
              <span className="library-group__title">{group.title}</span>
              {variants ? <span className="library-group__variants">{variants}</span> : null}
            </h2>

            <ul className="library-group__rows">
              {shown.map((entry) => {
                const selected = entry.draftId === selectedDraftId;
                return (
                  <li key={entry.draftId}>
                    <button
                      type="button"
                      className="library-triage-row"
                      aria-current={selected ? "true" : undefined}
                      onClick={() => onSelect(entry.draftId)}
                    >
                      <span className="library-triage-row__title">{entry.headline}</span>
                      <MetaLine className="library-triage-row__meta" parts={rowMeta(entry, now)} />
                    </button>
                  </li>
                );
              })}
            </ul>

            {hidden > 0 ? (
              <button
                type="button"
                className="library-group__toggle"
                aria-expanded={expanded}
                onClick={() => onToggleGroup(group.key)}
              >
                <span>{expanded ? formatShownCount(hidden) : formatHiddenCount(hidden)}</span>
                <span className="library-group__toggle-action">
                  {expanded ? "Replier" : "Déplier"}
                </span>
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

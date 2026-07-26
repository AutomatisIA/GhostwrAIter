import { Card } from "../../../design-system/primitives";
import {
  countChanged,
  diffParagraphs,
  type ParagraphChange
} from "../../../../../shared/diff-paragraphs";

type Props = {
  /** Version precedente du corps, telle que persistee avant la correction. */
  before: string;
  after: string;
};

/**
 * Montre ce que la correction premium a reellement change.
 *
 * Sans cette vue, l utilisateur devait comparer deux textes a l oeil pour savoir
 * si la correction avait fait quelque chose. La fonctionnalite pouvait marcher
 * parfaitement sans qu il puisse le constater, ce qui revient au meme que de ne
 * pas marcher.
 */
export function CorrectionDiff({ before, after }: Props) {
  const changes = diffParagraphs(before, after);
  const changed = countChanged(changes);

  if (changed === 0) {
    return (
      <Card elevation={1} className="correction-diff">
        <span className="correction-diff-title">Correction premium</span>
        <p className="correction-diff-empty">
          La correction a été lancée et n&apos;a modifié aucun paragraphe. Le texte
          d&apos;origine est conservé.
        </p>
      </Card>
    );
  }

  return (
    <Card elevation={1} className="correction-diff">
      <span className="correction-diff-title">Correction premium</span>
      <p className="correction-diff-summary">
        {changed === 1 ? "1 paragraphe réécrit" : `${changed} paragraphes réécrits`}
      </p>

      <ol className="correction-diff-list">
        {changes.map((change, index) => (
          <ChangeRow key={index} change={change} position={index + 1} />
        ))}
      </ol>
    </Card>
  );
}

function ChangeRow({ change, position }: { change: ParagraphChange; position: number }) {
  if (change.kind === "unchanged") return null;

  return (
    <li className="correction-diff-item">
      <span className="correction-diff-position">Paragraphe {position}</span>

      {change.kind === "modified" ? (
        <>
          <p className="correction-diff-before">{change.before}</p>
          <p className="correction-diff-after">{change.after}</p>
        </>
      ) : null}

      {change.kind === "added" ? (
        <p className="correction-diff-after">{change.text}</p>
      ) : null}

      {change.kind === "removed" ? (
        <p className="correction-diff-before">{change.text}</p>
      ) : null}
    </li>
  );
}

/**
 * Comparaison paragraphe par paragraphe de deux versions d un brouillon.
 *
 * Sert a rendre visible ce qu'une correction a change. Sans cela, l utilisateur
 * doit comparer deux textes a l oeil pour savoir si la correction a fait quelque
 * chose : une fonctionnalite dont on ne peut pas constater l effet ne sert a
 * rien, quel que soit son fonctionnement interne.
 *
 * Le decoupage se fait au paragraphe, pas au mot. Un post LinkedIn compte moins
 * de dix paragraphes, et une correction editoriale reecrit des phrases entieres :
 * un diff au mot produirait du bruit la ou le paragraphe montre l intention.
 */

export type ParagraphChange =
  | { kind: "unchanged"; text: string }
  | { kind: "modified"; before: string; after: string }
  | { kind: "added"; text: string }
  | { kind: "removed"; text: string };

const split = (text: string): string[] =>
  (text ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

/**
 * Apparie les paragraphes par position. Une correction editoriale reecrit sur
 * place et change rarement l ordre : l appariement positionnel donne un resultat
 * lisible pour un cout nul, la ou un alignement plus savant apporterait peu.
 */
export function diffParagraphs(before: string, after: string): ParagraphChange[] {
  const left = split(before);
  const right = split(after);
  const changes: ParagraphChange[] = [];

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const b = left[index];
    const a = right[index];

    if (b === undefined) changes.push({ kind: "added", text: a! });
    else if (a === undefined) changes.push({ kind: "removed", text: b });
    else if (a === b) changes.push({ kind: "unchanged", text: a });
    else changes.push({ kind: "modified", before: b, after: a });
  }

  return changes;
}

/** Nombre de paragraphes reellement touches, pour un resume en une ligne. */
export function countChanged(changes: readonly ParagraphChange[]): number {
  return changes.filter((change) => change.kind !== "unchanged").length;
}

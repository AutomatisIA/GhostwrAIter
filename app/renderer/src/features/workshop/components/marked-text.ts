/*
 * Decoupage du corps d un post en paragraphes, avec les marqueurs d ecriture IA
 * reperes comme segments a souligner DANS le texte.
 *
 * La liste separee que l ecran affichait auparavant obligeait a chercher a l oeil
 * ou se trouvait chaque extrait. Souligner sur place supprime la recherche.
 *
 * Deux pieges, tous les deux traites ici :
 *
 * 1. `detectTells` travaille sur un texte NORMALISE (apostrophes courbes
 *    ramenees a l apostrophe droite, espaces insecables ramenes a l espace,
 *    CRLF ramene a LF). Les deux premieres transformations conservent la
 *    longueur, la troisieme non. On reconstruit donc la meme normalisation en
 *    gardant, pour chaque caractere normalise, sa position d origine : les
 *    positions rendues par la detection deviennent exploitables sur le texte
 *    REEL, qui est celui qu on affiche. Afficher le texte normalise reviendrait
 *    a modifier a l ecran les apostrophes de l utilisateur.
 *
 * 2. Plusieurs motifs peuvent couvrir la meme portion de phrase. Sans fusion des
 *    recouvrements, on produirait des segments imbriques et le soulignement
 *    sauterait. Les intervalles sont donc fusionnes, en cumulant les familles.
 */
import { TELL_FAMILIES, type TellFamilyId, type TellHit } from "../../../../../shared/ai-tells";

export type MarkedSegment = {
  text: string;
  /** Familles reperees sur ce segment. Tableau vide = texte ordinaire. */
  families: TellFamilyId[];
};

export type MarkedParagraph = {
  key: number;
  segments: MarkedSegment[];
};

type Span = { start: number; end: number; families: TellFamilyId[] };

/**
 * Reproduit `normalize()` de `app/shared/ai-tells.ts` en gardant la trace de la
 * position d origine de chaque caractere produit.
 */
function normalizeWithPositions(text: string): { positions: number[] } {
  const positions: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    // CRLF : seul le saut de ligne survit a la normalisation, le retour chariot
    // disparait. C est la seule transformation qui change la longueur.
    if (text[index] === "\r" && text[index + 1] === "\n") continue;
    positions.push(index);
  }
  return { positions };
}

function toOriginalSpans(hits: readonly TellHit[], positions: number[], length: number): Span[] {
  const spans: Span[] = [];

  for (const hit of hits) {
    const size = hit.excerpt.length;
    if (size <= 0) continue;
    if (hit.index < 0 || hit.index >= positions.length) continue;

    const start = positions[hit.index]!;
    const lastNormalized = Math.min(hit.index + size - 1, positions.length - 1);
    const end = Math.min(positions[lastNormalized]! + 1, length);
    if (end <= start) continue;

    spans.push({ start, end, families: [hit.family] });
  }

  spans.sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: Span[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.start < last.end) {
      last.end = Math.max(last.end, span.end);
      for (const family of span.families) {
        if (!last.families.includes(family)) last.families.push(family);
      }
      continue;
    }
    merged.push({ start: span.start, end: span.end, families: [...span.families] });
  }

  return merged;
}

function sliceSegments(text: string, from: number, to: number, spans: Span[]): MarkedSegment[] {
  const segments: MarkedSegment[] = [];
  let cursor = from;

  for (const span of spans) {
    if (span.end <= from) continue;
    if (span.start >= to) break;

    const start = Math.max(span.start, from);
    const end = Math.min(span.end, to);
    if (start > cursor) segments.push({ text: text.slice(cursor, start), families: [] });
    if (end > start) segments.push({ text: text.slice(start, end), families: span.families });
    cursor = Math.max(cursor, end);
  }

  if (cursor < to) segments.push({ text: text.slice(cursor, to), families: [] });
  return segments;
}

/**
 * Paragraphes du post, marqueurs compris. Les lignes vides ne produisent pas de
 * paragraphe : l espacement entre paragraphes est porte par la mise en page.
 */
export function buildMarkedParagraphs(
  body: string,
  hits: readonly TellHit[]
): MarkedParagraph[] {
  const text = body ?? "";
  const { positions } = normalizeWithPositions(text);
  const spans = toOriginalSpans(hits ?? [], positions, text.length);

  const paragraphs: MarkedParagraph[] = [];
  let cursor = 0;
  let key = 0;

  for (const line of text.split("\n")) {
    const start = cursor;
    const end = start + line.length;
    // Le saut de ligne consomme un caractere de plus.
    cursor = end + 1;
    if (line.trim().length === 0) continue;
    paragraphs.push({ key: key++, segments: sliceSegments(text, start, end, spans) });
  }

  return paragraphs;
}

const labelOfFamily = (id: TellFamilyId): string =>
  TELL_FAMILIES.find((family) => family.id === id)?.label ?? id;

/** Libelle lisible des familles portees par un segment souligne. */
export function describeFamilies(families: readonly TellFamilyId[]): string {
  return families.map(labelOfFamily).join(", ");
}

/**
 * Mesures reelles d un post LinkedIn.
 *
 * Elles remplacent l affichage du `qualityScore`, qui etait une auto-evaluation
 * du modele et non une mesure : entre deux corpus, ce score est passe de 84 a
 * 82 % pendant que le taux de defauts reels baissait de pres de deux tiers. Un
 * produit dont la premiere regle editoriale est « zero chiffre invente »
 * affichait un chiffre invente sur chaque carte
 * (cf. docs/audit-2026-07-editorial.md section 6).
 *
 * Les valeurs ci-dessous sont verifiables par l utilisateur : il peut les
 * recompter. Elles comblent en outre deux manques releves dans
 * docs/audit-2026-07-fonctionnel.md section 10 : aucun compteur de caracteres,
 * aucun apercu de la coupure « voir plus ».
 */

/** Limite dure d un post LinkedIn. Au-dela, la publication est refusee. */
export const LINKEDIN_MAX_CHARS = 3000;

/**
 * Nombre de caracteres affiches avant le repli « voir plus » sur le fil.
 * LinkedIn ne publie pas ce seuil et l ajuste selon le support ; 210 est la
 * valeur communement observee sur le fil web. A traiter comme un ordre de
 * grandeur qui aide a soigner l accroche, pas comme une garantie.
 */
export const LINKEDIN_FOLD_CHARS = 210;

export type PostMetrics = {
  chars: number;
  words: number;
  /** Depasse la limite de publication. */
  overLimit: boolean;
  /** Part de la limite consommee, entre 0 et 1 et au-dela. */
  usage: number;
  /** Texte visible avant le repli « voir plus ». */
  visibleBeforeFold: string;
  /** Le post est-il assez long pour etre replie ? */
  isFolded: boolean;
};

export function measurePost(bodyMarkdown: string): PostMetrics {
  const text = bodyMarkdown ?? "";
  const chars = [...text].length;
  const words = text.split(/\s+/).filter(Boolean).length;

  return {
    chars,
    words,
    overLimit: chars > LINKEDIN_MAX_CHARS,
    usage: chars / LINKEDIN_MAX_CHARS,
    visibleBeforeFold: [...text].slice(0, LINKEDIN_FOLD_CHARS).join(""),
    isFolded: chars > LINKEDIN_FOLD_CHARS
  };
}

/** Libelle compact pour une carte de liste. */
export function formatCharCount(bodyMarkdown: string): string {
  const { chars, overLimit } = measurePost(bodyMarkdown);
  const formatted = chars.toLocaleString("fr-FR");
  return overLimit
    ? `${formatted} caractères, au-delà de la limite LinkedIn`
    : `${formatted} caractères`;
}

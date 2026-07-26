/**
 * Redaction des lignes de consequence affichees sous l indicateur de
 * completude.
 *
 * La regle de ton tient en une phrase : dire ce qui manque, puis ce que ca
 * change reellement a la generation. Jamais de reproche, jamais de score, et
 * surtout jamais de menace d echec quand il n y en a pas : un profil incomplet
 * produit des posts plus generiques, il n empeche aucune generation. Une alerte
 * qui exagere la premiere fois n est plus lue la deuxieme.
 */

/** Enumeration francaise : « a », « a et b », « a, b et c ». */
export function joinFr(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]!}`;
}

/** Majuscule initiale, pour ouvrir une phrase sur un nom de champ. */
export function capitalize(text: string): string {
  return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);
}

/** Vrai si la valeur porte autre chose que des espaces. */
export function isFilled(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

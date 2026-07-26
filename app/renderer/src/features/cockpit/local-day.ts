/**
 * Jour civil LOCAL au format `YYYY-MM-DD`.
 *
 * `plannedDate` est une date civile : « le 26 juillet », sans heure ni fuseau.
 * La comparer a `new Date().toISOString().slice(0, 10)` compare une date locale
 * a un jour calcule en UTC, et les deux ne coincident pas partout ni tout le
 * temps. A Paris, entre minuit et 02:00 l ete, l instant courant appartient
 * encore a la veille en UTC : un post prevu aujourd hui n etait pas signale a
 * publier. Dans les fuseaux negatifs, le decalage joue dans l autre sens et un
 * post du lendemain etait signale trop tot.
 *
 * On construit donc la chaine depuis les composantes locales, celles-la memes
 * que l utilisateur lit sur son horloge.
 */
export function localDayIso(instant: Date = new Date()): string {
  const year = String(instant.getFullYear()).padStart(4, "0");
  const month = String(instant.getMonth() + 1).padStart(2, "0");
  const day = String(instant.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

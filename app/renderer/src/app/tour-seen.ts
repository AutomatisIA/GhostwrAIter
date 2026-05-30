/*
 * Détection « visite guidée déjà vue » (feature 010).
 *
 * Le flag `guided-tour-seen` n'est jamais écrit qu'à la valeur littérale "true"
 * (cf. App.tsx closeTour). On teste donc cette valeur exacte plutôt qu'une
 * simple présence, qui serait fragile face à toute autre valeur persistée.
 * Fonction pure, isolée pour être testable sans monter le composant.
 */
export function isTourSeen(value: string | null | undefined): boolean {
  return value === "true";
}

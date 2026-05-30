/*
 * Donnees et logique pure de la visite guidee (feature 010, T040/T041).
 *
 * Isole du composant `GuidedTour.tsx` pour rester compatible Fast Refresh
 * (un fichier de composant n'exporte que des composants) et pour tester la
 * decision de declenchement sans DOM ni IPC.
 */

/** Cle du flag persiste dans `app_settings` (API settings generique). */
export const GUIDED_TOUR_SEEN_KEY = "guided-tour-seen";

export interface TourStep {
  /** Ecran ou jalon presente. */
  title: string;
  /** Explication en langage clair, sans jargon. */
  body: string;
  /** Prochaine action concrete a retenir (facultative). */
  nextAction?: string;
}

/**
 * Etapes de la visite. La premiere situe le parcours, les cinq suivantes
 * presentent chaque ecran dans l'ordre conseille, la derniere celebre.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    title: "Bienvenue dans GhostwrAIter",
    body: "En quelques minutes, voici comment passer d'une idée à un post LinkedIn prêt à publier. Le parcours conseillé est simple : on pose d'abord sa stratégie, on crée ensuite ses posts, puis on les retrouve dans la bibliothèque.",
    nextAction: "Suivez les étapes, vous pouvez passer à tout moment."
  },
  {
    title: "Cockpit",
    body: "Votre tableau de bord. Il vous montre où vous en êtes et ce qu'il reste à faire : c'est le point de départ à chaque ouverture.",
    nextAction: "Revenez-y pour avoir une vue d'ensemble."
  },
  {
    title: "1. Stratégie",
    body: "Commencez ici. Vous décrivez les clients que vous visez, vos thèmes et votre façon de vous exprimer. L'application s'en sert pour écrire des posts qui vous ressemblent.",
    nextAction: "Renseignez votre stratégie en premier."
  },
  {
    title: "2. Créer",
    body: "C'est ici que vous transformez une idée en post, étape par étape, avec l'aide de l'assistant. Vous gardez toujours la main : rien n'est publié sans votre validation.",
    nextAction: "Générez vos idées, puis rédigez vos posts."
  },
  {
    title: "3. Bibliothèque",
    body: "Tous vos posts s'y rangent : brouillons, versions retravaillées et publications planifiées. Vous les retrouvez, les modifiez et les organisez quand vous voulez.",
    nextAction: "Retrouvez et planifiez vos posts ici."
  },
  {
    title: "Paramètres",
    body: "Le thème, le moteur IA et vos données. Vous pourrez aussi y relancer cette visite guidée à tout moment.",
    nextAction: "Réglez l'apparence et le moteur IA."
  },
  {
    title: "C'est parti",
    body: "Vous connaissez le parcours : Stratégie, puis Créer, puis Bibliothèque. Lancez-vous, l'application vous guide à chaque étape.",
    nextAction: "Ouvrez la Stratégie pour démarrer."
  }
];

/**
 * Decision PURE de declenchement automatique de la visite.
 *
 * - `seen` : le flag `guided-tour-seen` est-il pose dans `app_settings` ?
 * - `isEmpty` : l'espace de travail est-il vierge (aucune strategie ni idee) ?
 *
 * La visite ne s'auto-declenche QUE si elle n'a jamais ete vue ET que l'espace
 * est vierge. L'absence du flag est le signal fort ; l'espace vierge est le
 * garde-fou secondaire. Testable sans DOM ni IPC.
 */
export function shouldShowTour(input: { seen: boolean; isEmpty: boolean }): boolean {
  return !input.seen && input.isEmpty;
}

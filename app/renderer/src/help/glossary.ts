/**
 * Glossaire de vulgarisation (T035, feature 010, data-model §3).
 *
 * Source unique réutilisée partout (SC-004) : chaque `InfoHint` lit ce
 * dictionnaire. Les définitions sont volontairement courtes et en langage
 * clair, pensées pour un dirigeant de PME non initié. On y vulgarise aussi
 * bien le jargon métier (pilier, ICP, accroche...) que le jargon technique
 * (moteur IA, OAuth) : aucune définition ne doit elle-même contenir de jargon.
 */

export interface GlossaryEntry {
  /** Libellé lisible du terme, tel qu'affiché à l'écran. */
  label: string;
  /** Définition courte en langage clair, sans jargon. */
  definition: string;
  /** Exemple concret facultatif pour ancrer la définition. */
  example?: string;
}

/**
 * Dictionnaire des termes. La structure `as const satisfies` garantit à la
 * fois que chaque entrée respecte `GlossaryEntry` et que les clés servent à
 * dériver le type `TermKey` (pas de dérive possible entre type et données).
 */
export const GLOSSARY = {
  pilier: {
    label: "Pilier",
    definition:
      "Un des grands thèmes autour desquels vous publiez. Vous en choisissez deux à quatre, et chaque idée ou post se rattache à l'un d'eux pour garder une ligne cohérente.",
    example: "Recrutement, gestion du temps, relation client."
  },
  icp: {
    label: "ICP (client idéal)",
    definition:
      "Le portrait du type de client que vous visez : son métier, sa taille d'entreprise, ses problèmes. Il sert à écrire des posts qui parlent vraiment à ces personnes.",
    example: "Dirigeants de PME du bâtiment de 10 à 50 salariés."
  },
  accroche: {
    label: "Accroche",
    definition:
      "La première phrase d'un post, celle qui doit donner envie de lire la suite. Sur LinkedIn, c'est elle qui décide si on s'arrête ou si on passe."
  },
  structure: {
    label: "Structure",
    definition:
      "La façon dont le post est organisé du début à la fin : comment l'idée est amenée, développée, puis conclue. Une bonne structure rend le message clair et facile à suivre.",
    example: "Erreur, puis conséquence, puis correction."
  },
  typologie: {
    label: "Typologie",
    definition:
      "Le genre du post que vous voulez écrire. Choisir une typologie oriente le ton et la mise en forme.",
    example: "Retour d'expérience, conseil pratique, prise de position."
  },
  objectif: {
    label: "Objectif",
    definition:
      "Ce que vous attendez du post : faire réagir, expliquer, rassurer, donner envie de vous contacter. L'objectif guide le contenu et la conclusion."
  },
  voix: {
    label: "Voix",
    definition:
      "Votre façon de vous exprimer : le ton, les mots que vous employez, ce que vous vous interdisez. Ces règles évitent les textes fades ou trop génériques et font que vos posts vous ressemblent.",
    example: "Direct et concret, sans jargon ni promesse miracle."
  },
  "socle-editorial": {
    label: "Socle éditorial",
    definition:
      "Le résumé de votre stratégie (clients visés, thèmes, ton) que l'application garde en mémoire. Il est fourni automatiquement à l'assistant à chaque génération pour que vos posts vous ressemblent."
  },
  draft: {
    label: "Brouillon",
    definition:
      "Une première version de post, générée ou écrite, que vous pouvez relire, retravailler et corriger avant de la publier. Rien n'est envoyé sans votre validation."
  },
  variante: {
    label: "Variante",
    definition:
      "Une autre version du même post, formulée différemment, pour vous laisser le choix de l'angle ou du ton qui vous convient le mieux."
  },
  repurpose: {
    label: "Recyclage de contenu",
    definition:
      "Réutiliser un contenu que vous avez déjà (un article, une note, un ancien post) pour en faire un nouveau post LinkedIn, sans repartir de zéro."
  },
  "moteur-ia": {
    label: "Moteur IA",
    definition:
      "L'assistant d'intelligence artificielle installé sur votre ordinateur qui rédige les textes. L'application utilise votre propre abonnement, vos contenus restent chez vous.",
    example: "Codex, Claude ou Gemini."
  },
  oauth: {
    label: "Connexion sécurisée",
    definition:
      "La façon de relier l'application à votre compte sans jamais lui confier votre mot de passe. Vous autorisez l'accès une fois, et vous pouvez le retirer quand vous voulez."
  },
  cadrage: {
    label: "Cadrage",
    definition:
      "L'étape où l'on précise de quoi va parler le post avant de l'écrire : le sujet, l'angle et le message principal. Un bon cadrage évite de partir dans tous les sens."
  },
  "score-qualite": {
    label: "Score de qualité",
    definition:
      "Une note automatique qui évalue si un post respecte vos règles d'écriture (ton, longueur, clarté). Elle vous signale les textes à retravailler avant publication."
  }
} as const satisfies Record<string, GlossaryEntry>;

/** Clé de terme valide, dérivée directement des clés du glossaire. */
export type TermKey = keyof typeof GLOSSARY;

/** Liste figée de toutes les clés de termes, pratique pour itérer. */
export const TERM_KEYS = Object.keys(GLOSSARY) as TermKey[];

/**
 * Recherche une entrée par sa clé. Le lookup est volontairement runtime et
 * renvoie `undefined` pour une clé absente : cela permet aux appelants (et aux
 * tests) de gérer un terme inconnu de façon sûre, sans supposer sa présence.
 */
export function getTerm(key: TermKey): GlossaryEntry | undefined {
  return GLOSSARY[key];
}

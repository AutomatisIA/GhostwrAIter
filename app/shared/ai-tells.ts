/**
 * Detection des marqueurs d'ecriture IA dans un texte francais.
 *
 * Source des categories : page Wikipedia « Signs of AI writing », restreinte
 * aux motifs detectables mecaniquement en prose francaise de format LinkedIn.
 *
 * Ce module est la version applicative de `scripts/audit-ai-tells.mjs`, qui
 * reste l'outil d'audit en ligne de commande. Il vit dans la couche partagee
 * parce qu'il sert aux deux bouts de la chaine : le processus principal y lit
 * les familles a interdire pour les injecter dans les prompts, le renderer y
 * lit les occurrences reperees pour les montrer dans le texte.
 *
 * LIMITE ASSUMEE : ces expressions regulieres sous-comptent. Une variante non
 * prevue passe. Le module sert a montrer ce qu'il trouve, jamais a certifier
 * qu'un texte est propre. L'interface doit le dire.
 */

export type TellFamilyId =
  | "parallelisme-negatif"
  | "pivot"
  | "regle-de-trois"
  | "vocabulaire"
  | "autorite-vague"
  | "structure"
  | "typographie"
  | "chute"
  | "meta";

export type TellFamily = {
  id: TellFamilyId;
  label: string;
  /** Ce que le motif produit, en une phrase, pour l'utilisateur. */
  description: string;
  /** Consigne injectee dans le prompt quand la famille est interdite. */
  constraint: string;
  /** Poids dans la densite. 3 = signature forte. */
  severity: 1 | 2 | 3;
};

/**
 * Les neuf familles. `constraint` est redigee en anglais parce que les prompts
 * de skill le sont, et deliberement sans citer aucune formule : nommer une
 * tournure pour l'interdire revient a la donner en exemple au modele.
 */
export const TELL_FAMILIES: readonly TellFamily[] = [
  {
    id: "parallelisme-negatif",
    label: "Parallélisme négatif",
    description:
      "Construire une phrase sur l'opposition entre ce qu'une chose n'est pas et ce qu'elle est. C'est le marqueur le plus reconnaissable.",
    constraint:
      "Do not build a sentence on the opposition between what something is not and what it is, in any of its forms.",
    severity: 3
  },
  {
    id: "pivot",
    label: "Pivot dramatique",
    description:
      "Annoncer que le vrai sujet arrive, au lieu de l'aborder directement.",
    constraint:
      "Do not open a paragraph with a formula announcing that the real point is arriving.",
    severity: 3
  },
  {
    id: "regle-de-trois",
    label: "Règle de trois",
    description:
      "Grouper systématiquement les idées par trois pour le rythme, même quand deux suffisent.",
    constraint: "Do not group three items for rhythm when two or four carry the same meaning.",
    severity: 2
  },
  {
    id: "vocabulaire",
    label: "Vocabulaire gonflé",
    description:
      "Les adjectifs d'insistance qui ne disent rien : crucial, essentiel, véritable, incontournable.",
    constraint:
      "Do not use intensity adjectives that add no information. Prefer the concrete noun to the emphatic one.",
    severity: 1
  },
  {
    id: "autorite-vague",
    label: "Autorité vague",
    description:
      "Attribuer une opinion à un groupe indéfini : beaucoup pensent, on entend souvent, les experts.",
    constraint:
      "Do not attribute a claim to an unnamed group. Either name the source or state the claim directly.",
    severity: 2
  },
  {
    id: "structure",
    label: "Lignes sèches empilées",
    description:
      "Enchaîner les paragraphes d'une seule phrase courte, ce qui donne un rythme mécanique.",
    constraint:
      "Do not stack more than two consecutive paragraphs of a single short sentence. Vary sentence length across the piece.",
    severity: 2
  },
  {
    id: "typographie",
    label: "Typographie machine",
    description: "Cadratins et emojis en guise de ponctuation.",
    constraint: "Do not use dashes as separators, and do not use emoji. Commas, colons and full stops only.",
    severity: 2
  },
  {
    id: "chute",
    label: "Chute sentencieuse",
    description: "Terminer sur une maxime générale plutôt que sur une conséquence concrète.",
    constraint:
      "The closing line must state a consequence or a decision, not a general truth.",
    severity: 2
  },
  {
    id: "meta",
    label: "Commentaire méta",
    description:
      "Parler du post dans le post : nommer la structure employée, commenter la rédaction.",
    constraint:
      "Never name the structure, the typology, the objective or the writing process inside the output.",
    severity: 3
  }
];

export type TellHit = {
  family: TellFamilyId;
  /** Extrait fautif, tel qu'il apparait dans le texte. */
  excerpt: string;
  /** Position de depart dans le texte normalise, pour un surlignage eventuel. */
  index: number;
};

export type TellReport = {
  words: number;
  hits: TellHit[];
  /** Points ponderes pour 100 mots. Comparable entre textes de longueurs differentes. */
  density: number;
  /** Familles effectivement reperees. */
  families: TellFamilyId[];
};

const normalize = (text: string): string =>
  (text ?? "").replace(/[’ʼ]/g, "'").replace(/[\u00A0\u202F]/g, " ").replace(/\r\n/g, "\n");

const PATTERNS: ReadonlyArray<{ family: TellFamilyId; regex: RegExp }> = [
  {
    family: "parallelisme-negatif",
    regex: /\b(?:ce\s+)?n'est\s+pas\s+[^.!?\n]{3,90}?[.,]\s*(?:c'est|mais)\b[^.!?\n]{0,60}/gi
  },
  {
    family: "parallelisme-negatif",
    regex:
      /\b(?:le|la)\s+(?:vrai\s+|vraie\s+)?(?:probl[eè]me|sujet|enjeu|question|d[eé]bat|point|frein|risque|pi[eè]ge)\s+n'est\s+pas\b[^.!?\n]{0,90}/gi
  },
  { family: "parallelisme-negatif", regex: /\bil\s+ne\s+s'agit\s+pas\s+(?:de|d')\b[^.!?\n]{0,90}/gi },
  {
    family: "parallelisme-negatif",
    regex: /\bnon\s+seulement\b[^.!?\n]{0,90}?\bmais\s+(?:aussi|[eé]galement)\b/gi
  },
  {
    family: "parallelisme-negatif",
    regex: /\bne?\s+\w+\s+(?:pas|plus)\s+(?:seulement|uniquement|juste)\b[^.!?\n]{0,90}?\bmais\b[^.!?\n]{0,50}/gi
  },
  { family: "pivot", regex: /\bc'est\s+(?:\w+\s+)?l[aà]\s+que\b[^.!?\n]{0,70}/gi },
  {
    family: "pivot",
    regex:
      /\b(?:en\s+r[eé]alit[eé]|au\s+fond|au\s+final|en\s+somme|en\s+d[eé]finitive|force\s+est\s+de\s+constater)\b/gi
  },
  {
    family: "regle-de-trois",
    regex: /\b[\wéèêàçôûîï']{4,},\s+[\wéèêàçôûîï']{4,}\s+et\s+[\wéèêàçôûîï']{4,}\b/gi
  },
  {
    family: "vocabulaire",
    regex:
      /\b(?:crucial(?:e|es|aux)?|essentiel(?:le|s|les)?|incontournable(?:s)?|indispensable(?:s)?|v[eé]ritable(?:s)?|profond[eé]ment|r[eé]volutionn\w*)\b/gi
  },
  {
    family: "autorite-vague",
    regex:
      /\b(?:beaucoup\s+(?:pensent|croient|se\s+trompent|confondent)|on\s+(?:entend|lit|voit|parle)\s+(?:souvent|beaucoup)|certains\s+(?:disent|pensent)|les\s+experts?\s+\w+)/gi
  },
  { family: "typographie", regex: /—/g },
  {
    family: "typographie",
    regex: /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/gu
  },
  {
    family: "meta",
    regex:
      /\b(?:structure\s+retenue|version\s+revue|ce\s+post\s+(?:part|repose)|dans\s+cet\s+article)\b/gi
  }
];

/** Nombre de paragraphes d'une seule phrase courte, empiles consecutivement. */
function detectStackedLines(text: string): TellHit[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length < 4) return [];

  let run = 0;
  for (const paragraph of paragraphs) {
    const isShort =
      paragraph.split(/\s+/).filter(Boolean).length <= 12 &&
      paragraph.split(/(?<=[.!?…])\s+/).filter(Boolean).length <= 1;
    run = isShort ? run + 1 : 0;
    if (run > 2) {
      return [{ family: "structure", excerpt: paragraph.slice(0, 80), index: text.indexOf(paragraph) }];
    }
  }
  return [];
}

/** Derniere phrase formulee en maxime plutot qu'en consequence. */
function detectClosingMaxim(text: string): TellHit[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const last = paragraphs[paragraphs.length - 1] ?? "";
  const isMaxim =
    /\b(?:vaut\s+(?:souvent\s+)?(?:plus|mieux)|n'est\s+pas\s+\w+[^.!?\n]{0,40}c'est|ne\s+sera\s+pas\s+\w+)/i.test(
      last
    );
  return isMaxim ? [{ family: "chute", excerpt: last.slice(0, 100), index: text.indexOf(last) }] : [];
}

const severityOf = (id: TellFamilyId): number =>
  TELL_FAMILIES.find((family) => family.id === id)?.severity ?? 1;

/**
 * Analyse un texte. `enabledFamilies` restreint la detection aux familles que
 * l'utilisateur a choisi de surveiller ; par defaut toutes sont actives.
 */
export function detectTells(
  text: string,
  enabledFamilies?: readonly TellFamilyId[]
): TellReport {
  const normalized = normalize(text);
  const enabled = enabledFamilies
    ? new Set(enabledFamilies)
    : new Set(TELL_FAMILIES.map((family) => family.id));

  const hits: TellHit[] = [];

  for (const { family, regex } of PATTERNS) {
    if (!enabled.has(family)) continue;
    for (const match of normalized.matchAll(regex)) {
      hits.push({ family, excerpt: match[0].trim(), index: match.index ?? 0 });
    }
  }

  if (enabled.has("structure")) hits.push(...detectStackedLines(normalized));
  if (enabled.has("chute")) hits.push(...detectClosingMaxim(normalized));

  const words = normalized.split(/\s+/).filter(Boolean).length;
  const weighted = hits.reduce((sum, hit) => sum + severityOf(hit.family), 0);

  return {
    words,
    hits: hits.sort((a, b) => a.index - b.index),
    density: words > 0 ? Number(((weighted / words) * 100).toFixed(2)) : 0,
    families: [...new Set(hits.map((hit) => hit.family))]
  };
}

/**
 * Bloc de contraintes a injecter dans les prompts, construit a partir des
 * familles que l'utilisateur interdit. Rendre une chaine vide quand rien n'est
 * interdit evite d'ajouter une section vide au prompt.
 */
export function buildTellConstraints(enabledFamilies: readonly TellFamilyId[]): string {
  const lines = TELL_FAMILIES.filter((family) => enabledFamilies.includes(family.id)).map(
    (family) => `- ${family.constraint}`
  );

  return lines.length === 0
    ? ""
    : `Structural constraints, which take precedence over any stylistic preference:\n${lines.join("\n")}`;
}

/** Toutes les familles, valeur par defaut d'une installation neuve. */
export const ALL_TELL_FAMILIES: readonly TellFamilyId[] = TELL_FAMILIES.map((family) => family.id);

/**
 * Cle de preference ou sont stockees les familles interdites, sous forme d un
 * tableau JSON d identifiants. Partagee entre le processus principal, qui la lit
 * pour construire les contraintes, et le renderer, qui l ecrit depuis l onglet
 * Voix. Une seule declaration evite que les deux cotes divergent.
 */
export const AI_TELL_PREFERENCE_KEY = "ai_tell_families";

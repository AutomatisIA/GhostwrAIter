/*
 * Regles de triage de la Bibliotheque.
 *
 * Tout ce qui decide de l ORDRE et des LIBELLES vit ici, hors de React : c est
 * la partie que l on peut mesurer sans rendre un ecran, et c est celle qui a
 * echoue trois fois. « Jamais relu » n a jamais ete affiche parce que le signal
 * etait cherche dans `drafts` alors qu il vit dans `draft_versions` : il arrive
 * desormais par `versionCount`, et la regle tient en une ligne testable.
 *
 * Aucune valeur n est inventee ni completee : un champ absent fait disparaitre
 * son fragment, il ne prend pas une valeur par defaut. Un « jamais relu » pose
 * par defaut sur trente brouillons serait exactement le mensonge que ce
 * chantier vient corriger.
 */
import type { LibraryEntry, LibraryTriage } from "@shared/types/library";

/** Une entree de triage : ce qu il reste a faire, et son libelle. */
export type TriageBucket = {
  id: LibraryTriage;
  /** Libelle de l entree, au pluriel : il porte toujours un compte. */
  label: string;
  /** Titre de l etat vide de cette entree. */
  emptyTitle: string;
  /** Ce que l entree contiendrait si elle n etait pas vide. */
  emptyDescription: string;
};

/**
 * Les trois entrees, dans l ordre de la maquette : ce qui bloque d abord, puis
 * ce qui est pret, puis ce qui est deja pose dans le calendrier.
 */
export const TRIAGE_BUCKETS: readonly TriageBucket[] = [
  {
    id: "a-relire",
    label: "À relire",
    emptyTitle: "Rien à relire",
    emptyDescription:
      "Aucun brouillon n'attend une première relecture. Ceux qui n'ont jamais été repris depuis leur génération apparaîtront ici."
  },
  {
    id: "pret",
    label: "Prêts",
    emptyTitle: "Aucun brouillon prêt",
    emptyDescription:
      "Un brouillon devient prêt dès que vous l'avez repris au moins une fois. Relisez-en un, il basculera ici."
  },
  {
    id: "planifie",
    label: "Planifiés",
    emptyTitle: "Aucune publication planifiée",
    emptyDescription:
      "Posez une date sur un brouillon prêt depuis le volet de lecture : il rejoindra cette entrée et le planning."
  }
];

/** Nombre de lignes montrees par sujet avant repli. */
export const MAX_ROWS_PER_GROUP = 3;

export type TriageCounts = Record<LibraryTriage, number>;

/** Comptes reels par entree de triage, derives de `triage`. */
export function countByTriage(entries: readonly LibraryEntry[]): TriageCounts {
  const counts: TriageCounts = { "a-relire": 0, pret: 0, planifie: 0 };

  for (const entry of entries) {
    if (entry.triage in counts) {
      counts[entry.triage] += 1;
    }
  }

  return counts;
}

/**
 * Rang d aboutissement. Le plus abouti est celui qui est le plus pres d etre
 * publie : une date posee devance une reprise, qui devance une generation
 * jamais relue.
 */
const TRIAGE_RANK: Record<LibraryTriage, number> = {
  planifie: 2,
  pret: 1,
  "a-relire": 0
};

const timeOf = (iso: string | undefined): number => {
  const value = Date.parse(iso ?? "");
  return Number.isNaN(value) ? 0 : value;
};

const rankOf = (entry: LibraryEntry): number => TRIAGE_RANK[entry.triage] ?? 0;

/**
 * Du plus abouti au moins abouti. Les egalites sont tranchees par le nombre de
 * versions puis par la fraicheur, et en dernier recours par l identifiant :
 * sans ce dernier critere, deux brouillons identiques changeraient de place a
 * chaque rendu et la selection sauterait toute seule.
 */
export function compareByAchievement(a: LibraryEntry, b: LibraryEntry): number {
  const byRank = rankOf(b) - rankOf(a);
  if (byRank !== 0) return byRank;

  const byVersions = (b.versionCount ?? 0) - (a.versionCount ?? 0);
  if (byVersions !== 0) return byVersions;

  const byDate = timeOf(b.lastVersionAt) - timeOf(a.lastVersionAt);
  if (byDate !== 0) return byDate;

  // Comparaison BRUTE, pas `localeCompare`. Un identifiant n est pas du texte
  // humain : le comparer selon une locale le soumet aux donnees ICU, qui
  // different d une plateforme a l autre. Ce dernier critere existe pour rendre
  // l ordre STABLE ; le confier a une comparaison dependante du systeme
  // reviendrait a le rendre stable sur une machine et pas sur une autre, ce qui
  // est precisement ce qu il doit empecher.
  if (a.draftId < b.draftId) return -1;
  if (a.draftId > b.draftId) return 1;
  return 0;
}

export type SubjectGroup = {
  /** Cle de regroupement : le titre de l idee, a defaut son identifiant. */
  key: string;
  title: string;
  /** Du plus abouti au moins abouti. */
  entries: LibraryEntry[];
};

/**
 * Regroupe par sujet, c est-a-dire par titre d idee.
 *
 * Le fait mesure sur l espace de reference : dix idees produisent les trente
 * brouillons, la plus prolifique en porte huit. Presenter huit variantes du
 * meme sujet comme huit objets independants est ce qui rend la liste
 * illisible ; le regroupement n est pas une commodite d affichage, c est le
 * rangement que les donnees reclament.
 */
export function groupBySubject(entries: readonly LibraryEntry[]): SubjectGroup[] {
  const groups = new Map<string, SubjectGroup>();

  for (const entry of entries) {
    const title = (entry.ideaTitle ?? "").trim();
    const key = title || entry.ideaId;
    const existing = groups.get(key);

    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(key, { key, title: title || "Sujet sans titre", entries: [entry] });
    }
  }

  const ordered = [...groups.values()];

  for (const group of ordered) {
    group.entries.sort(compareByAchievement);
  }

  // Les sujets les plus prolifiques en tete : ce sont eux qui portent la
  // decision (quelle variante garder), les sujets uniques n en portent aucune.
  ordered.sort((a, b) => {
    const bySize = b.entries.length - a.entries.length;
    if (bySize !== 0) return bySize;

    const byDate = timeOf(b.entries[0]?.lastVersionAt) - timeOf(a.entries[0]?.lastVersionAt);
    if (byDate !== 0) return byDate;

    return a.title.localeCompare(b.title, "fr");
  });

  return ordered;
}

/** Les entrees dans l ordre ou elles sont posees a l ecran, groupes aplatis. */
export function flattenGroups(groups: readonly SubjectGroup[]): LibraryEntry[] {
  return groups.flatMap((group) => group.entries);
}

/**
 * Vrai quand le brouillon n a que sa version de generation. C est LE signal qui
 * bloque la publication, et il se lit dans `draft_versions`, pas dans `drafts`.
 *
 * Le seuil est `<= 1`, pas `=== 1`, et cette nuance vient de l ECRITURE : la
 * requete de `library.service.ts` compte les lignes de `draft_versions` avec un
 * `COALESCE(..., 0)`, donc un brouillon sans aucune version rend ZERO. Une
 * egalite stricte aurait tu le marqueur precisement sur le brouillon le moins
 * relu de tous, ce qui aurait fait echouer cette fonctionnalite une quatrieme
 * fois, et en silence. Meme seuil que `deriveTriage`, cote processus principal :
 * les deux repondent a la meme question et ne peuvent pas diverger.
 *
 * Le champ absent, lui, ne dit rien : `undefined <= 1` vaut faux, et c est le
 * verdict voulu. Traiter l absence comme un « jamais relu » afficherait le
 * marqueur sur la totalite de la bibliotheque le jour ou le champ cesserait
 * d arriver.
 */
export function isNeverReviewed(entry: LibraryEntry): boolean {
  return typeof entry.versionCount === "number" && entry.versionCount <= 1;
}

/** Le meme fait, ecrit pour le panneau de metadonnees du post lu. */
export function formatNeverReviewed(entry: LibraryEntry): string {
  return entry.versionCount === 1 ? "1 version, jamais relu" : "Aucune version, jamais relu";
}

const FEMININE_NUMBERS = [
  "zéro",
  "une",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf"
];

const spell = (count: number): string =>
  count >= 0 && count < FEMININE_NUMBERS.length ? FEMININE_NUMBERS[count]! : String(count);

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Mention de tete de groupe. Elle n a de sens qu au pluriel : sur un sujet
 * unique il n y a pas de choix a faire, donc rien a signaler.
 */
export function formatVariantCount(count: number): string | null {
  if (count < 2) return null;
  return `${count} variantes du même sujet`;
}

/** Libelle de la ligne de repli, sous les trois premieres variantes. */
export function formatHiddenCount(count: number): string {
  return count === 1
    ? "Une variante de plus, repliée"
    : `${capitalize(spell(count))} variantes de plus, repliées`;
}

/** Le meme decompte, une fois le repli ouvert. */
export function formatShownCount(count: number): string {
  return count === 1
    ? "Une variante de plus, affichée"
    : `${capitalize(spell(count))} variantes de plus, affichées`;
}

/**
 * Date relative en clair. Au-dela d une semaine, la date absolue est plus utile
 * qu un « il y a 23 j » que personne ne reconvertit de tete.
 */
export function formatRelativeDay(iso: string | undefined, now: Date = new Date()): string | null {
  const then = new Date(iso ?? "");
  if (Number.isNaN(then.getTime())) return null;

  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);

  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;

  return `le ${then.toLocaleDateString("fr-FR")}`;
}

/**
 * Historique des versions, en une ligne. Il existe en base depuis toujours et
 * n etait affiche nulle part.
 *
 * Rend `null` quand il n y a rien a raconter : une seule version n est pas un
 * historique, c est l absence d historique, et elle se dit ailleurs par
 * « jamais relu ».
 */
export function formatVersionHistory(entry: LibraryEntry, now: Date = new Date()): string | null {
  const count = entry.versionCount;
  if (typeof count !== "number" || count < 2) return null;

  const day = formatRelativeDay(entry.lastVersionAt, now);
  return day ? `${count} versions, la dernière ${day}` : `${count} versions`;
}

/** « modifié hier » pour la ligne de liste. */
export function formatLastModified(entry: LibraryEntry, now: Date = new Date()): string | null {
  const day = formatRelativeDay(entry.lastVersionAt, now);
  return day ? `modifié ${day}` : null;
}

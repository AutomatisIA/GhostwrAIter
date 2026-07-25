import { createContext, useContext } from "react";

/**
 * Repli des aides de l ecran Strategie : catalogue, cle de persistance et
 * contrat du contexte.
 *
 * Le probleme d origine : chaque champ empilait quatre lignes (libelle, aide,
 * champ, exemple). L aide avait ete ecrite pour le premier jour et restait
 * affichee le centieme. Elle est desormais repliee par defaut, depliable au
 * champ, et son etat survit au redemarrage.
 *
 * L etat est persiste par NATURE de champ (`offer-promise`), jamais par
 * instance (`offer-promise-2`). Trois raisons, toutes rencontrees :
 *   - le texte d aide est le meme pour toutes les offres, donc deplier
 *     « Promesse » sur l une et pas sur l autre n a pas de sens ;
 *   - les listes sont indexees par position : retirer la deuxieme offre
 *     recollerait l etat deplie sur une autre ligne ;
 *   - l objet persiste reste borne a une vingtaine de cles, quelle que soit la
 *     taille de la strategie.
 * Les identifiants DOM, eux, restent par instance : ils portent le lien
 * `label`/`aria-controls`, qui doit etre unique dans la page.
 */

/** Onglets de l ecran, dans l ordre de la barre. */
export type StrategyTab = "profil" | "offres" | "icps" | "piliers" | "voix" | "socle";

/**
 * Catalogue des aides par onglet. Il sert deux usages : typer le champ `field`
 * de `StrategyField` (une faute de frappe devient une erreur de compilation) et
 * donner a la bascule globale la liste exacte des aides de l onglet courant.
 * L onglet « Socle editorial » ne porte aucun champ de saisie repliable.
 */
export const HELP_FIELDS = {
  profil: ["profile-name", "profile-positioning", "profile-bio", "profile-expertise"],
  offres: ["offer-name", "offer-promise", "offer-problems", "offer-proofs", "offer-cta"],
  icps: [
    "icp-segment",
    "icp-pains",
    "icp-objections",
    "icp-outcomes",
    "icp-language",
    "icp-behavior"
  ],
  piliers: ["pillar-label", "pillar-description"],
  voix: ["voice-category", "voice-type", "voice-text"],
  socle: []
} as const satisfies Record<StrategyTab, readonly string[]>;

/** Union de toutes les natures de champ declarees dans le catalogue. */
export type HelpFieldId = (typeof HELP_FIELDS)[StrategyTab][number];

/**
 * Cle unique de preference. Une seule cle pour tout l ecran : elle porte un
 * objet JSON `{ "profile-bio": true }`. Une cle par champ multiplierait les
 * allers-retours IPC par le nombre de champs a chaque montage.
 */
export const STRATEGY_HELP_PREFERENCE_KEY = "strategy_help_expanded";

/**
 * Decode la valeur brute renvoyee par `settings.getPreference`. Tolerante par
 * construction : `null` (jamais enregistre), JSON illisible, tableau ou objet
 * mal forme renvoient `undefined`, et l appelant applique son defaut (tout
 * replie). Seules les entrees `true` sont conservees, les autres ne portent
 * aucune information.
 */
export function parseHelpDisclosurePreference(
  raw: string | null
): Record<string, boolean> | undefined {
  if (raw === null) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }
  const expanded: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === true) expanded[key] = true;
  }
  return expanded;
}

export type HelpDisclosureApi = {
  /** Vrai si l aide de cette nature de champ est depliee. */
  isOpen: (field: HelpFieldId) => boolean;
  /** Bascule l aide d une nature de champ. */
  toggle: (field: HelpFieldId) => void;
  /** Deplie ou replie d un coup toutes les aides fournies (bascule globale). */
  setFields: (fields: readonly HelpFieldId[], open: boolean) => void;
};

export const HelpDisclosureContext = createContext<HelpDisclosureApi | null>(null);

export function useHelpDisclosure(): HelpDisclosureApi {
  const api = useContext(HelpDisclosureContext);
  if (!api) {
    throw new Error("useHelpDisclosure doit etre appele sous HelpDisclosureProvider");
  }
  return api;
}

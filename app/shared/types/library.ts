/**
 * Etat de triage d un brouillon : ce qu il reste a en faire.
 *
 * Le classement par date ne dit pas lequel des trente brouillons est le plus
 * pres d etre publie. Ces trois etats le disent, et ils sont DERIVES de faits
 * deja en base, jamais saisis.
 */
export type LibraryTriage =
  /** Aucune reprise depuis la generation : c est ce qui bloque la publication. */
  | "a-relire"
  /** Corrige ou modifie a la main au moins une fois. */
  | "pret"
  /** Une date de publication est posee. */
  | "planifie";

export type LibraryEntry = {
  draftId: string;
  ideaId: string;
  headline: string;
  bodyPreview: string;
  bodyMarkdown: string;
  qualityScore: number;
  createdAt: string;
  status: "draft" | "variant" | "scheduled";
  pillarLabel: string;
  tags: string[];
  sourceDraftId: string | null;

  /*
   * Champs ajoutes le 25 juillet 2026 pour l ecran de triage.
   *
   * Ils existaient tous en base et n atteignaient pas le renderer. C est ce qui
   * a fait echouer trois tentatives d afficher « jamais relu » : les agents ont
   * cherche une colonne dans `drafts`, l ont a juste titre declaree absente, et
   * ont renonce plutot que d inventer le marqueur. Le signal etait dans
   * `draft_versions`, une table plus loin.
   */

  /** Titre de l idee d origine. Cle de regroupement par sujet. */
  ideaTitle: string;
  /**
   * Nombre d entrees dans `draft_versions`. A UN, le brouillon n a que sa
   * version de generation : ni correction, ni edition manuelle. Sur l espace de
   * reference, vingt brouillons sur trente sont dans ce cas.
   */
  versionCount: number;
  /** Horodatage de la version la plus recente, pour « modifie hier ». */
  lastVersionAt: string;
  /**
   * Cible visee du post, choisie a la creation de l idee. `null` pour les
   * brouillons anterieurs au champ : la ligne de metadonnees est alors omise
   * plutot que rendue vide.
   */
  targetIcpSegment: string | null;
  /** Derive des trois faits ci-dessus, jamais saisi. */
  triage: LibraryTriage;
};

// Re-exported from the zod schema in app/shared/schemas/library.ts which is
// now the single source of truth for the search-entries input shape. The
// schema uses `SearchLibraryInput` as its derived name; both aliases are
// provided here so existing imports continue to compile.
import type {
  SearchLibraryInput,
  SearchLibraryInput as LibrarySearchInput
} from "../schemas/library";
export type { SearchLibraryInput, LibrarySearchInput };

export type LibraryApi = {
  listEntries: () => Promise<LibraryEntry[]>;
  searchEntries: (input: LibrarySearchInput) => Promise<LibraryEntry[]>;
  createVariantFromDraft: (draftId: string) => Promise<LibraryEntry>;
  updateEntryText: (
    draftId: string,
    headline: string,
    bodyMarkdown: string
  ) => Promise<void>;
  createDivergentVariant: (draftId: string) => Promise<LibraryEntry>;
  deleteEntry: (draftId: string) => Promise<void>;
};

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
};

// Re-exported from the zod schema in app/shared/schemas/library.ts which is
// now the single source of truth for the search-entries input shape. The
// schema uses `SearchLibraryInput` as its derived name; both aliases are
// provided here so existing imports continue to compile.
export type { SearchLibraryInput } from "../schemas/library";
export type { SearchLibraryInput as LibrarySearchInput } from "../schemas/library";

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

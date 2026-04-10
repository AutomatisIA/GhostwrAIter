export type LibraryEntry = {
  draftId: string;
  headline: string;
  bodyPreview: string;
  qualityScore: number;
  createdAt: string;
  status: "draft" | "variant" | "scheduled";
  pillarLabel: string;
  tags: string[];
  sourceDraftId: string | null;
};

export type LibrarySearchInput = {
  query?: string;
  pillarLabel?: string;
  status?: LibraryEntry["status"];
  tag?: string;
};

export type LibraryApi = {
  listEntries: () => Promise<LibraryEntry[]>;
  searchEntries: (input: LibrarySearchInput) => Promise<LibraryEntry[]>;
  createVariantFromDraft: (draftId: string) => Promise<LibraryEntry>;
};

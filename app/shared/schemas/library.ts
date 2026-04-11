import { z } from "zod";

/**
 * Status values for a library entry, matching the existing
 * LibraryEntry["status"] union in app/shared/types/library.ts.
 */
export const libraryEntryStatusSchema = z.enum([
  "draft",
  "variant",
  "scheduled"
]);

/**
 * Input shape accepted by `library:search-entries`. Every field is
 * optional — an empty object retrieves every entry. This matches the
 * current LibrarySearchInput type.
 */
export const searchLibraryInputSchema = z
  .object({
    query: z.string().optional(),
    pillarLabel: z.string().optional(),
    status: libraryEntryStatusSchema.optional(),
    tag: z.string().optional()
  })
  .strict();

export type SearchLibraryInput = z.infer<typeof searchLibraryInputSchema>;

/**
 * Scalar schema for `library:create-variant-from-draft`. The channel
 * takes a single draft id as its only argument.
 */
export const draftIdSchema = z.string().min(1, "draftId is required");

// Re-export the shared empty-input schema for `library:list-entries`.
export { emptyInputSchema } from "./common";

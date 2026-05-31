import { z } from "zod";

/**
 * The five post typologies supported by the v1 editorial pipeline.
 * Must stay in sync with app/shared/types/workshop.ts PostTypology.
 */
export const postTypologySchema = z.enum([
  "expertise",
  "contrarian",
  "case_study",
  "tutorial",
  "thought_leadership"
]);

/**
 * The four post objectives recognized by the pipeline. Must stay in
 * sync with app/shared/types/workshop.ts PostObjective.
 */
export const postObjectiveSchema = z.enum([
  "awareness",
  "authority",
  "conversion",
  "engagement"
]);

/**
 * A single hook option passed through the positional tuple to
 * `workshop:generate-final-draft`. Must match
 * app/shared/types/workshop.ts HookOption.
 */
export const hookOptionSchema = z
  .object({
    id: z.string().min(1, "hook id is required"),
    family: z.string().min(1, "hook family is required"),
    text: z.string().min(1, "hook text is required"),
    score: z.number().min(0, "score must be between 0 and 1").max(1, "score must be between 0 and 1")
  })
  .strict();

export type HookOption = z.infer<typeof hookOptionSchema>;

// Scalar schemas used throughout the workshop IPC surface.
export const ideaIdSchema = z.string().min(1, "ideaId is required");
export const draftIdSchema = z.string().min(1, "draftId is required");
export const structureKeySchema = z.string().min(1, "structureKey is required");
export const structureLabelSchema = z.string().min(1, "structureLabel is required");
export const hookIdSchema = z.string().min(1, "selectedHookId is required");
export const hookTextSchema = z.string().min(1, "selectedHookText is required");
export const variantTypeSchema = z.string().min(1, "variantType is required");

/**
 * Tuple schema for `workshop:get-suggested-structures`: three
 * positional arguments (ideaId, typology, objective).
 */
export const suggestedStructuresTupleSchema = z.tuple([
  ideaIdSchema,
  postTypologySchema,
  postObjectiveSchema
]);

/**
 * Tuple schema for `workshop:generate-hooks`: three positional
 * arguments (ideaId, typology, structureKey).
 */
export const generateHooksTupleSchema = z.tuple([
  ideaIdSchema,
  postTypologySchema,
  structureKeySchema
]);

/**
 * Tuple schema for `workshop:generate-final-draft`: eight positional
 * arguments matching the exact signature of the runtime service.
 * The last element is an array of hook options, each validated by
 * hookOptionSchema.
 */
export const generateFinalDraftTupleSchema = z.tuple([
  ideaIdSchema,
  postTypologySchema,
  postObjectiveSchema,
  structureKeySchema,
  structureLabelSchema,
  hookIdSchema,
  hookTextSchema,
  z.array(hookOptionSchema)
]);

/**
 * Tuple schema for `workshop:create-variant`: two positional
 * arguments (draftId, variantType).
 */
export const createVariantTupleSchema = z.tuple([draftIdSchema, variantTypeSchema]);

/**
 * Tuple schema for `workshop:correct-draft`: single positional
 * argument (draftId). Exposed as a tuple so the handler uses the
 * tuple-variant wrapper consistently with its siblings.
 */
export const correctDraftTupleSchema = z.tuple([draftIdSchema]);

export const updateDraftTextTupleSchema = z.tuple([
  draftIdSchema,
  z.string().min(1, "headline is required"),
  z.string().min(1, "bodyMarkdown is required")
]);

/**
 * Input schema for `workshop:create-draft-from-content`: importe un texte de
 * post existant comme brouillon corrigeable. Single-input (objet), valide en
 * strict pour rejeter toute cle parasite.
 */
export const createDraftFromContentSchema = z
  .object({
    pillarLabel: z.string().min(1, "pillarLabel is required"),
    headline: z.string().min(1, "headline is required"),
    bodyMarkdown: z.string().min(1, "bodyMarkdown is required")
  })
  .strict();

export type CreateDraftFromContentInput = z.infer<typeof createDraftFromContentSchema>;

import { z } from "zod";

/**
 * Input shape accepted by `ideas:create`. Every field is required
 * and non-empty: a manual idea must have a title, a defensible
 * angle, and a pillar label tying it to the editorial strategy.
 */
export const ideaInputSchema = z
  .object({
    title: z.string().min(1, "title is required"),
    angle: z.string().min(1, "angle is required"),
    pillarLabel: z.string().min(1, "pillarLabel is required")
  })
  .strict();

export type IdeaInput = z.infer<typeof ideaInputSchema>;

/**
 * Input shape accepted by `ideas:create-from-news-source`. Both
 * fields are required and non-empty so the strict-execution
 * Codex doctrine has enough material to refuse a weak source
 * downstream without the handler crashing on a missing field
 * upstream.
 */
export const newsSourceInputSchema = z
  .object({
    sourceTitle: z.string().min(1, "sourceTitle is required"),
    sourceSummary: z.string().min(1, "sourceSummary is required")
  })
  .strict();

export type NewsSourceInput = z.infer<typeof newsSourceInputSchema>;

// Re-export the shared empty-input schema for `ideas:list` and
// `ideas:generate-from-strategy`.
export { emptyInputSchema } from "./common";

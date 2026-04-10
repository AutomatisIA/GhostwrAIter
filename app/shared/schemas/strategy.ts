import { z } from "zod";

export const profileInputSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required"),
  positioning: z.string().trim().min(1, "Positioning is required"),
  bio: z.string().default(""),
  expertiseSummary: z.string().default("")
});

export const offerInputSchema = z.object({
  name: z.string().trim().min(1, "Offer name is required"),
  promise: z.string().trim().min(1, "Offer promise is required"),
  problems: z.string().trim().min(1, "Offer problems are required"),
  proofPoints: z.string().optional(),
  ctaModes: z.string().optional()
});

export const icpInputSchema = z.object({
  segment: z.string().trim().min(1, "ICP segment is required"),
  pains: z.string().trim().min(1, "ICP pains are required"),
  objections: z.string().optional(),
  desiredOutcomes: z.string().optional(),
  languageCues: z.string().optional(),
  linkedinBehavior: z.string().optional()
});

export const pillarInputSchema = z.object({
  label: z.string().trim().min(1, "Pillar label is required"),
  description: z.string().optional(),
  position: z.number().int().nonnegative(),
  isDefault: z.boolean().optional().default(false)
});

export const voiceRuleInputSchema = z.object({
  category: z.string().trim().min(1, "Voice rule category is required"),
  ruleText: z.string().trim().min(1, "Voice rule text is required"),
  ruleType: z.enum(["do", "dont", "anti_style", "format_rule"])
});

export const strategyBundleInputSchema = z.object({
  profile: profileInputSchema,
  offers: z.array(offerInputSchema),
  icps: z.array(icpInputSchema),
  pillars: z.array(pillarInputSchema),
  voiceRules: z.array(voiceRuleInputSchema)
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type OfferInput = z.infer<typeof offerInputSchema>;
export type IcpInput = z.infer<typeof icpInputSchema>;
export type PillarInput = z.infer<typeof pillarInputSchema>;
export type VoiceRuleInput = z.infer<typeof voiceRuleInputSchema>;
export type StrategyBundleInput = z.infer<typeof strategyBundleInputSchema>;

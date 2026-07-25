import type { IdeaRecord } from "./ideas";

// Re-exported from the zod schemas in app/shared/schemas/workshop.ts which
// is now the single source of truth for the workshop IPC input shapes
// (feature 003).
export type { HookOption } from "../schemas/workshop";
import type { z } from "zod";
import type {
  HookOption,
  postObjectiveSchema,
  postTypologySchema
} from "../schemas/workshop";

export type PostTypology = z.infer<typeof postTypologySchema>;
export type PostObjective = z.infer<typeof postObjectiveSchema>;

export type StructureOption = {
  key: string;
  label: string;
  rationale: string;
};

export type WorkshopHook = {
  id: string;
  text: string;
};

export type WorkshopDraft = {
  id: string;
  headline: string;
  bodyMarkdown: string;
  qualityScore: number;
  typology?: PostTypology;
  objective?: PostObjective;
  structureKey?: string;
  structureLabel?: string;
  selectedHookText?: string;
};

export type WorkshopVersion = {
  id: string;
  bodyMarkdown: string;
  qualityScore: number;
  reason: "generation" | "correction" | "variant" | "manual_edit";
  createdAt: string;
};

export type WorkshopRun = {
  id: string;
  skillName: string;
  status: "succeeded" | "failed" | "partial";
  summary: string;
};

export type WorkshopContextUsed = {
  pillarLabel: string;
  strategyProfileName?: string;
  strategyPositioning?: string;
  strategyBio?: string;
  strategyExpertiseSummary?: string;
  strategyOffersSummary?: string;
  strategyIcpSummary?: string;
  pillarDescription?: string;
  voiceGuardrail: string;
  activeSkills: string[];
};

export type WorkshopSession = {
  idea: IdeaRecord;
  draft: WorkshopDraft;
  hooks: WorkshopHook[];
  run: WorkshopRun;
  versions: WorkshopVersion[];
  /**
   * Renseigne par `correctDraft` uniquement. `false` signifie que la correction
   * n a pas ameliore le brouillon et que le texte d origine est conserve. Sans
   * ce drapeau, l interface annoncait « Draft corrige » sur un texte inchange :
   * sur les corrections reellement mesurees en base, 37 % etaient dans ce cas.
   */
  correctionApplied?: boolean;
  contextUsed: WorkshopContextUsed;
};

export type WorkshopApi = {
  getSessionByIdeaId: (ideaId: string) => Promise<WorkshopSession | null>;
  generateFromIdea: (ideaId: string) => Promise<WorkshopSession>;
  correctDraft: (draftId: string) => Promise<WorkshopSession>;
  getSuggestedStructures: (
    ideaId: string,
    typology: PostTypology,
    objective: PostObjective
  ) => Promise<StructureOption[]>;
  generateHooks: (
    ideaId: string,
    typology: PostTypology,
    structureKey: string
  ) => Promise<HookOption[]>;
  generateFinalDraft: (
    ideaId: string,
    typology: PostTypology,
    objective: PostObjective,
    structureKey: string,
    structureLabel: string,
    selectedHookId: string,
    selectedHookText: string,
    hooks: HookOption[]
  ) => Promise<WorkshopSession>;
  createVariant: (draftId: string, variantType: string) => Promise<WorkshopSession>;
  updateDraftText: (
    draftId: string,
    headline: string,
    bodyMarkdown: string
  ) => Promise<WorkshopSession>;
  /** Importe un texte de post existant comme brouillon corrigeable (puis correctDraft). */
  createDraftFromContent: (input: {
    pillarLabel: string;
    headline: string;
    bodyMarkdown: string;
  }) => Promise<WorkshopSession>;
};

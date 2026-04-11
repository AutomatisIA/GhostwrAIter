import type { IdeaRecord } from "./ideas";

export type PostTypology =
  | "expertise"
  | "contrarian"
  | "case_study"
  | "tutorial"
  | "thought_leadership";
export type PostObjective = "awareness" | "authority" | "conversion" | "engagement";

export type StructureOption = {
  key: string;
  label: string;
  rationale: string;
};

export type HookOption = {
  id: string;
  family: string;
  text: string;
  score: number;
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
  reason: "generation" | "correction" | "variant";
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
  voiceGuardrail: string;
  activeSkills: string[];
};

export type WorkshopSession = {
  idea: IdeaRecord;
  draft: WorkshopDraft;
  hooks: WorkshopHook[];
  run: WorkshopRun;
  versions: WorkshopVersion[];
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
};

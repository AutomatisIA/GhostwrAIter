import type { IdeaRecord } from "./ideas";

export type WorkshopHook = {
  id: string;
  text: string;
};

export type WorkshopDraft = {
  id: string;
  headline: string;
  bodyMarkdown: string;
  qualityScore: number;
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
};

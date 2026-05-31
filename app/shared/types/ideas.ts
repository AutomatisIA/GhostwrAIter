export type IdeaRecord = {
  id: string;
  title: string;
  angle: string;
  pillarLabel: string;
  createdAt: string;
};

// Re-exported from the zod schema in app/shared/schemas/ideas.ts which is
// now the single source of truth for the IPC input shapes (feature 003).
import type { IdeaInput, NewsSourceInput } from "../schemas/ideas";
export type { IdeaInput, NewsSourceInput };

export type IdeaDraftCreationResult = {
  idea: IdeaRecord;
  draft: {
    id: string;
    headline: string;
    bodyMarkdown: string;
    qualityScore: number;
  };
  hooks: Array<{
    id: string;
    text: string;
  }>;
  run: {
    id: string;
    skillName: string;
    status: "succeeded" | "failed" | "partial";
    summary: string;
  };
  versions: Array<{
    id: string;
    bodyMarkdown: string;
    qualityScore: number;
    reason: "generation" | "correction" | "variant";
    createdAt: string;
  }>;
  contextUsed: {
    pillarLabel: string;
    voiceGuardrail: string;
    activeSkills: string[];
  };
};

export type IdeasApi = {
  listIdeas: () => Promise<IdeaRecord[]>;
  createIdea: (idea: IdeaInput) => Promise<IdeaRecord>;
  createFromNewsSource: (input: NewsSourceInput) => Promise<IdeaDraftCreationResult>;
  generateFromStrategy: () => Promise<IdeaRecord[]>;
};

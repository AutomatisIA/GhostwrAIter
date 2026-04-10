export type IdeaRecord = {
  id: string;
  title: string;
  angle: string;
  pillarLabel: string;
  createdAt: string;
};

export type IdeaInput = {
  title: string;
  angle: string;
  pillarLabel: string;
};

export type NewsSourceInput = {
  sourceTitle: string;
  sourceSummary: string;
};

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

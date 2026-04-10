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

export type IdeasApi = {
  listIdeas: () => Promise<IdeaRecord[]>;
  createIdea: (idea: IdeaInput) => Promise<IdeaRecord>;
};

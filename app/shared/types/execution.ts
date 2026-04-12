export type ExecutionRunEntry = {
  id: string;
  skillName: string;
  status: "succeeded" | "failed" | "partial";
  summary: string;
  createdAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  logPath: string | null;
};

export type ExecutionDiagnostics = {
  runnerMode: "unavailable" | "codex";
  codexAvailable: boolean;
  message: string;
  availableSkills: string[];
};

export type OpenRunLogResult = {
  opened: boolean;
};

export type ExecutionApi = {
  listRuns: () => Promise<ExecutionRunEntry[]>;
  getDiagnostics: () => Promise<ExecutionDiagnostics>;
  openRunLog: (runId: string) => Promise<OpenRunLogResult>;
};

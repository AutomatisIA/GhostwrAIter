export type ExecutionRunEntry = {
  id: string;
  skillName: string;
  status: "succeeded" | "failed" | "partial";
  summary: string;
  createdAt: string;
};

export type ExecutionDiagnostics = {
  runnerMode: "local-simulated" | "codex";
  codexAvailable: boolean;
  message: string;
  availableSkills: string[];
};

export type ExecutionApi = {
  listRuns: () => Promise<ExecutionRunEntry[]>;
  getDiagnostics: () => Promise<ExecutionDiagnostics>;
};

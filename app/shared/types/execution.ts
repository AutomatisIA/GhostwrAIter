export type ExecutionRunEntry = {
  id: string;
  skillName: string;
  status: "succeeded" | "failed" | "partial";
  summary: string;
  createdAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  hasLog: boolean;
};

import type { CliEngineStatus } from "./settings";

export type ExecutionDiagnostics = {
  activeEngine: string;
  engines: CliEngineStatus[];
  availableSkills: string[];
  message: string;
};

export type OpenRunLogResult = {
  opened: boolean;
};

export type ExecutionApi = {
  listRuns: () => Promise<ExecutionRunEntry[]>;
  getDiagnostics: () => Promise<ExecutionDiagnostics>;
  openRunLog: (runId: string) => Promise<OpenRunLogResult>;
};

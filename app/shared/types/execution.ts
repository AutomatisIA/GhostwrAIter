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

import type { ExecutionProgressEvent } from "./execution-progress";

/**
 * Abonnement additif au canal one-way `execution:progress` (feature 010, T028).
 * Expose au top-level de `window.linkedinPoster` (pas sous `.execution`), car
 * c'est une souscription d'evenement et non un appel requete/reponse : elle ne
 * passe pas par l'enveloppe IpcResult. Retourne une fonction de desabonnement.
 */
export type OnExecutionProgress = (
  listener: (event: ExecutionProgressEvent) => void
) => () => void;

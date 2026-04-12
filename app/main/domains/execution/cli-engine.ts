import type { CliEngineStatus } from "../../../shared/types/settings";

export interface CliEngine {
  readonly name: "codex" | "gemini" | "claude";
  isInstalled(): Promise<boolean>;
  isAuthenticated(): Promise<boolean>;
  getStatus(): Promise<CliEngineStatus>;
  executeSkill(prompt: string, timeoutMs?: number): Promise<string>;
}

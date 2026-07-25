export type ThemePreference = "system" | "light" | "dark";

export type CliInstallState = "not-installed" | "installed" | "authenticated";

export type CliEngineName = "codex" | "antigravity" | "claude";

export type CliEngineStatus = {
  name: CliEngineName;
  displayName: string;
  binaryPath: string | null;
  installState: CliInstallState;
  version: string | null;
  subscriptionLabel: string;
  installCommand: string;
  loginCommand: string;
  /**
   * Ou se procurer le moteur, quand aucune commande ne peut le faire.
   *
   * Antigravity n est pas un paquet npm et n a pas de sous-commande de
   * connexion : ses deux champs de commande sont vides, et sans cette phrase
   * l ecran ne dirait plus rien a qui ne l a pas installe. Une commande
   * inventee serait pire, une absence totale n aide pas.
   */
  setupHint?: string;
};

export type EngineSelection = {
  engine: CliEngineName;
  status: CliEngineStatus;
};

export type PreferenceEntry = {
  key: string;
  value: string;
  updated_at: string;
};

export type ExportWorkspaceResult = {
  exportPath: string;
};

export type CountExecutionLogsResult = {
  count: number;
};

export type PurgeExecutionLogsResult = {
  deletedCount: number;
};

export type SettingsApi = {
  exportWorkspace: () => Promise<ExportWorkspaceResult>;
  countExecutionLogs: () => Promise<CountExecutionLogsResult>;
  purgeExecutionLogs: () => Promise<PurgeExecutionLogsResult>;
  getPreference: (key: string) => Promise<{ key: string; value: string | null }>;
  setPreference: (key: string, value: string) => Promise<PreferenceEntry>;
  getAllPreferences: () => Promise<Record<string, string>>;
  detectEngines: () => Promise<{ engines: CliEngineStatus[] }>;
  getActiveEngine: () => Promise<EngineSelection>;
  setActiveEngine: (engine: CliEngineName) => Promise<EngineSelection>;
};

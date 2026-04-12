export type ThemePreference = "system" | "light" | "dark";

export type CliInstallState = "not-installed" | "installed" | "authenticated";

export type CliEngineName = "codex" | "gemini" | "claude";

export type CliEngineStatus = {
  name: CliEngineName;
  displayName: string;
  binaryPath: string | null;
  installState: CliInstallState;
  version: string | null;
  subscriptionLabel: string;
  installCommand: string;
  loginCommand: string;
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

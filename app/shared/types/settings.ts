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

/**
 * Result of an export or an import.
 *
 * `canceled` is a normal outcome, not a failure: the user closed the file
 * dialog, or declined the import confirmation. The renderer distinguishes it
 * so it can stay silent instead of announcing a backup that was never written.
 */
export type ExportWorkspaceResult =
  | { canceled: true }
  | {
      canceled: false;
      exportPath: string;
      /** Row count per table, as written into the archive manifest. */
      tableCounts: Record<string, number>;
      fileCount: number;
      byteSize: number;
    };

export type ImportWorkspaceResult =
  | { canceled: true }
  | {
      canceled: false;
      restoredTables: Record<string, number>;
      /** Tables the archive holds that this version of the app does not know. */
      ignoredTables: string[];
      restoredFileCount: number;
      /** Where the pre-import database was snapshotted, so the import is undoable. */
      backupPath: string;
    };

export type CountExecutionLogsResult = {
  count: number;
};

export type PurgeExecutionLogsResult = {
  deletedCount: number;
};

export type SettingsApi = {
  exportWorkspace: () => Promise<ExportWorkspaceResult>;
  importWorkspace: () => Promise<ImportWorkspaceResult>;
  countExecutionLogs: () => Promise<CountExecutionLogsResult>;
  purgeExecutionLogs: () => Promise<PurgeExecutionLogsResult>;
  getPreference: (key: string) => Promise<{ key: string; value: string | null }>;
  setPreference: (key: string, value: string) => Promise<PreferenceEntry>;
  getAllPreferences: () => Promise<Record<string, string>>;
  detectEngines: () => Promise<{ engines: CliEngineStatus[] }>;
  getActiveEngine: () => Promise<EngineSelection>;
  setActiveEngine: (engine: CliEngineName) => Promise<EngineSelection>;
};

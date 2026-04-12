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
};

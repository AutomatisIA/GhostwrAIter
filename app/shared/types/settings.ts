export type ExportWorkspaceResult = {
  exportPath: string;
};

export type PurgeExecutionLogsResult = {
  deletedCount: number;
};

export type SettingsApi = {
  exportWorkspace: () => Promise<ExportWorkspaceResult>;
  purgeExecutionLogs: () => Promise<PurgeExecutionLogsResult>;
};

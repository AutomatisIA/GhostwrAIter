import { ExportService } from "../domains/export/export.service";
import { PrivacyService } from "../domains/privacy/privacy.service";

type IpcRegistrar = {
  handle: (
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
};

export class SettingsRuntimeService {
  constructor(
    private readonly exportService: ExportService,
    private readonly privacyService: PrivacyService
  ) {}

  exportWorkspace() {
    return this.exportService.exportWorkspace();
  }

  purgeExecutionLogs() {
    return this.privacyService.purgeExecutionLogs();
  }
}

export function registerSettingsIpcHandlers(
  ipcRegistrar: IpcRegistrar,
  settingsService: SettingsRuntimeService
) {
  ipcRegistrar.handle("settings:export-workspace", async () =>
    settingsService.exportWorkspace()
  );
  ipcRegistrar.handle("settings:purge-execution-logs", async () =>
    settingsService.purgeExecutionLogs()
  );
}

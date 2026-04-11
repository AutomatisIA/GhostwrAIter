import { ExportService } from "../domains/export/export.service";
import { PrivacyService } from "../domains/privacy/privacy.service";
import { emptyInputSchema } from "../../shared/schemas/settings";
import {
  registerValidatedHandler,
  type IpcRegistrar
} from "./register-validated-handler";

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
  registerValidatedHandler(
    ipcRegistrar,
    "settings:export-workspace",
    emptyInputSchema,
    () => settingsService.exportWorkspace()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "settings:purge-execution-logs",
    emptyInputSchema,
    () => settingsService.purgeExecutionLogs()
  );
}

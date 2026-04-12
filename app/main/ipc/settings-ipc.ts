import { ExportService } from "../domains/export/export.service";
import { PrivacyService } from "../domains/privacy/privacy.service";
import { SettingsService } from "../domains/settings/settings.service";
import type { EngineRegistry } from "../domains/execution/engine-registry";
import type { CliEngineName } from "../../shared/types/settings";
import {
  emptyInputSchema,
  getPreferenceInputSchema,
  setPreferenceInputSchema,
  setActiveEngineInputSchema
} from "../../shared/schemas/settings";
import {
  registerValidatedHandler,
  type IpcRegistrar
} from "./register-validated-handler";

export class SettingsRuntimeService {
  constructor(
    private readonly exportService: ExportService,
    private readonly privacyService: PrivacyService,
    private readonly settingsService: SettingsService,
    private readonly engineRegistry?: EngineRegistry
  ) {}

  exportWorkspace() {
    return this.exportService.exportWorkspace();
  }

  countExecutionLogs() {
    return this.privacyService.countExecutionLogs();
  }

  purgeExecutionLogs() {
    return this.privacyService.purgeExecutionLogs();
  }

  getPreference(input: { key: string }) {
    return this.settingsService.getPreference(input.key);
  }

  setPreference(input: { key: string; value: string }) {
    return this.settingsService.setPreference(input.key, input.value);
  }

  getAllPreferences() {
    return this.settingsService.getAllPreferences();
  }

  async detectEngines() {
    if (!this.engineRegistry) {
      return { engines: [] };
    }
    const engines = await this.engineRegistry.detectEngines();
    return { engines };
  }

  async getActiveEngine() {
    if (!this.engineRegistry) {
      return {
        engine: "codex" as CliEngineName,
        status: {
          name: "codex" as CliEngineName,
          displayName: "Codex (ChatGPT)",
          binaryPath: null,
          installState: "not-installed" as const,
          version: null,
          subscriptionLabel: "",
          installCommand: "",
          loginCommand: ""
        }
      };
    }
    return this.engineRegistry.getActiveEngine();
  }

  async setActiveEngine(input: { engine: CliEngineName }) {
    if (!this.engineRegistry) {
      throw new Error("Engine registry not available");
    }
    return this.engineRegistry.setActiveEngine(input.engine);
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
    "settings:count-execution-logs",
    emptyInputSchema,
    () => settingsService.countExecutionLogs()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "settings:purge-execution-logs",
    emptyInputSchema,
    () => settingsService.purgeExecutionLogs()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "settings:get-preference",
    getPreferenceInputSchema,
    (input: { key: string }) => settingsService.getPreference(input)
  );
  registerValidatedHandler(
    ipcRegistrar,
    "settings:set-preference",
    setPreferenceInputSchema,
    (input: { key: string; value: string }) => settingsService.setPreference(input)
  );
  registerValidatedHandler(
    ipcRegistrar,
    "settings:get-all-preferences",
    emptyInputSchema,
    () => settingsService.getAllPreferences()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "settings:detect-engines",
    emptyInputSchema,
    () => settingsService.detectEngines()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "settings:get-active-engine",
    emptyInputSchema,
    () => settingsService.getActiveEngine()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "settings:set-active-engine",
    setActiveEngineInputSchema,
    (input: { engine: CliEngineName }) => settingsService.setActiveEngine(input)
  );
}

import { buildDefaultExportFileName, ExportService } from "../domains/export/export.service";
import type { ImportPreview, ImportService } from "../domains/export/import.service";
import { PrivacyService } from "../domains/privacy/privacy.service";
import { SettingsService } from "../domains/settings/settings.service";
import type { EngineRegistry } from "../domains/execution/engine-registry";
import type {
  CliEngineName,
  ExportWorkspaceResult,
  ImportWorkspaceResult
} from "../../shared/types/settings";
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

/**
 * The dialogs the backup flow needs, injected rather than imported.
 *
 * They live in the main process because the renderer must never hand over a
 * filesystem path: a compromised renderer would then choose where the
 * application writes, or which file it reads back in. Main opens the dialog,
 * main gets the path, and the path never crosses the IPC boundary.
 *
 * Injecting them also keeps this service testable without an Electron window.
 */
export type WorkspaceBackupDialogs = {
  askExportDestination: (defaultFileName: string) => Promise<string | null>;
  askArchiveToImport: () => Promise<string | null>;
  confirmImport: (preview: ImportPreview) => Promise<boolean>;
};

export class SettingsRuntimeService {
  constructor(
    private readonly exportService: ExportService,
    private readonly privacyService: PrivacyService,
    private readonly settingsService: SettingsService,
    private readonly engineRegistry?: EngineRegistry,
    private readonly importService?: ImportService,
    private readonly dialogs?: WorkspaceBackupDialogs
  ) {}

  async exportWorkspace(): Promise<ExportWorkspaceResult> {
    if (!this.dialogs) throw new Error("Aucune boîte de dialogue disponible pour l'export.");

    const destination = await this.dialogs.askExportDestination(
      buildDefaultExportFileName(new Date())
    );
    if (!destination) return { canceled: true };

    const result = await this.exportService.exportWorkspace(destination);
    return { canceled: false, ...result };
  }

  /**
   * Replaces the workspace with the contents of an archive.
   *
   * Destructive by nature, so it asks twice: once for the file, once for the
   * confirmation, which names what the archive holds. The pre-import database
   * snapshot is taken by the import service itself, before the first delete.
   */
  async importWorkspace(): Promise<ImportWorkspaceResult> {
    if (!this.importService || !this.dialogs) {
      throw new Error("L'import n'est pas disponible dans cette configuration.");
    }

    const archivePath = await this.dialogs.askArchiveToImport();
    if (!archivePath) return { canceled: true };

    const preview = await this.importService.previewArchive(archivePath);
    const confirmed = await this.dialogs.confirmImport(preview);
    if (!confirmed) return { canceled: true };

    const result = await this.importService.importWorkspace(archivePath, new Date());
    return { canceled: false, ...result };
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
    "settings:import-workspace",
    emptyInputSchema,
    () => settingsService.importWorkspace()
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

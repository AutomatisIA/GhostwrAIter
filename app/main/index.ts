import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import log from "electron-log/main.js";
import {
  attachDevToolsGuard,
  attachNavigationGuards,
  buildHardenedWebPreferences,
  isDevMode,
  type WebContentsLike
} from "./window-factory";
import { CalendarRuntimeService, registerCalendarIpcHandlers } from "./ipc/calendar-ipc";
import { createAppDatabase } from "./db/database";
import { CodexCliRunner } from "./domains/execution/codex-cli-runner";
import { CodexEngine } from "./domains/execution/codex-engine";
import { ClaudeEngine } from "./domains/execution/claude-engine";
import { AntigravityEngine } from "./domains/execution/antigravity-engine";
import { EngineRegistry } from "./domains/execution/engine-registry";
import { SkillRunnerService } from "./domains/execution/skill-runner.service";
import {
  AI_TELL_PREFERENCE_KEY,
  ALL_TELL_FAMILIES,
  buildTellConstraints,
  type TellFamilyId
} from "../shared/ai-tells";
import { ExecutionRuntimeService, registerExecutionIpcHandlers } from "./ipc/execution-ipc";
import { SkillRegistryService } from "./domains/execution/skill-registry.service";
import { IdeasService, registerIdeasIpcHandlers } from "./ipc/ideas-ipc";
import { LibraryRuntimeService, registerLibraryIpcHandlers } from "./ipc/library-ipc";
import { SettingsRuntimeService, registerSettingsIpcHandlers } from "./ipc/settings-ipc";
import { SettingsService } from "./domains/settings/settings.service";
import { registerStrategyIpcHandlers, StrategyService } from "./ipc/strategy-ipc";
import { registerWorkshopIpcHandlers, WorkshopRuntimeService } from "./ipc/workshop-ipc";
import {
  createWorkspaceService,
  resolveWorkspaceRoot,
  WorkspaceConfigurationError
} from "./workspace/workspace.service";
import { ExportService } from "./domains/export/export.service";
import { PrivacyService } from "./domains/privacy/privacy.service";

log.initialize();

function createWindow() {
  const devMode = isDevMode();
  const preloadPath = join(__dirname, "../preload/index.cjs");

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    title: "GhostwrAIter",
    backgroundColor: "#f4efe6",
    webPreferences: buildHardenedWebPreferences(preloadPath)
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  const allowedOrigins = devMode && rendererUrl
    ? [new URL(rendererUrl).origin]
    : ["file://"];

  const webContents = window.webContents as unknown as WebContentsLike;
  attachNavigationGuards(webContents, allowedOrigins, {
    openExternal: (url) => {
      void shell.openExternal(url);
    }
  });
  attachDevToolsGuard(webContents, devMode);

  if (devMode && rendererUrl) {
    window.loadURL(rendererUrl);
    return;
  }

  window.loadFile(join(__dirname, "../../out/renderer/index.html"));
}

app.whenReady().then(() => {
  let workspaceRoot: string;
  try {
    workspaceRoot = resolveWorkspaceRoot(app.getPath("userData"));
  } catch (err) {
    if (err instanceof WorkspaceConfigurationError) {
      log.error(
        `[startup] workspace configuration invalid (${err.reason}): ${err.message}`
      );
      // Also print to stderr so a terminal launch shows the error directly.
      console.error(`\n[ghostwraiter] ${err.message}\n`);
      app.exit(1);
      return;
    }
    throw err;
  }
  const workspaceService = createWorkspaceService(workspaceRoot);
  const workspacePaths = workspaceService.ensureWorkspace();
  const db = createAppDatabase(workspacePaths.databasePath);
  const appSettingsService = new SettingsService(db);
  const engineRegistry = new EngineRegistry(appSettingsService, [
    new CodexEngine(),
    new ClaudeEngine(),
    new AntigravityEngine()
  ]);
  /**
   * Familles de marqueurs d ecriture IA que l utilisateur interdit, reglees dans
   * l onglet Voix. Relues a chaque generation : un changement de reglage prend
   * effet sans redemarrer l application. Une preference absente vaut « toutes
   * interdites », qui est le comportement attendu d une installation neuve.
   */
  const getUserConstraints = () => {
    const stored = appSettingsService.getPreference(AI_TELL_PREFERENCE_KEY).value;
    if (stored === null) return buildTellConstraints(ALL_TELL_FAMILIES);

    try {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return buildTellConstraints(ALL_TELL_FAMILIES);
      const known = parsed.filter((id): id is TellFamilyId =>
        (ALL_TELL_FAMILIES as readonly string[]).includes(id as string)
      );
      return buildTellConstraints(known);
    } catch {
      return buildTellConstraints(ALL_TELL_FAMILIES);
    }
  };

  const skillRunnerService = new SkillRunnerService({
    codexCliRunner: new CodexCliRunner(),
    engineRegistry,
    getUserConstraints
  });
  const strategyService = new StrategyService(db, skillRunnerService);
  const getActiveStrategyBundle = () => {
    try {
      return strategyService.getActiveStrategyBundle();
    } catch {
      return null;
    }
  };
  const getFoundationSummary = () => {
    const pref = appSettingsService.getPreference("foundation_summary");
    return pref.value;
  };
  const ideasService = new IdeasService(db, skillRunnerService, getFoundationSummary);
  const workshopService = new WorkshopRuntimeService(
    db,
    ideasService.getRepository(),
    getActiveStrategyBundle,
    join(workspacePaths.logsDirectory, "executions"),
    skillRunnerService,
    getFoundationSummary
  );
  const libraryService = new LibraryRuntimeService(db, skillRunnerService, getActiveStrategyBundle, getFoundationSummary);
  const calendarService = new CalendarRuntimeService(db);
  const executionService = new ExecutionRuntimeService(
    db,
    new SkillRegistryService([
      join(app.getAppPath(), "skills"),
      join(workspacePaths.rootDirectory, "skills")
    ]),
    skillRunnerService,
    join(workspacePaths.logsDirectory, "executions"),
    engineRegistry
  );
  const settingsService = new SettingsRuntimeService(
    new ExportService(
      workspacePaths.rootDirectory,
      join(workspacePaths.contentDirectory, "exports"),
      join(workspacePaths.contentDirectory, "strategy"),
      join(workspacePaths.logsDirectory, "executions")
    ),
    new PrivacyService(join(workspacePaths.logsDirectory, "executions")),
    appSettingsService,
    engineRegistry
  );

  registerStrategyIpcHandlers(ipcMain, strategyService);
  registerIdeasIpcHandlers(ipcMain, ideasService);
  registerWorkshopIpcHandlers(ipcMain, workshopService);
  registerLibraryIpcHandlers(ipcMain, libraryService);
  registerCalendarIpcHandlers(ipcMain, calendarService);
  registerExecutionIpcHandlers(ipcMain, executionService);
  registerSettingsIpcHandlers(ipcMain, settingsService);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

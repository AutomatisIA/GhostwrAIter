import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import log from "electron-log/main.js";
import { CalendarRuntimeService, registerCalendarIpcHandlers } from "./ipc/calendar-ipc";
import { createAppDatabase } from "./db/database";
import { CodexCliRunner } from "./domains/execution/codex-cli-runner";
import { SkillRunnerService } from "./domains/execution/skill-runner.service";
import { ExecutionRuntimeService, registerExecutionIpcHandlers } from "./ipc/execution-ipc";
import { SkillRegistryService } from "./domains/execution/skill-registry.service";
import { IdeasService, registerIdeasIpcHandlers } from "./ipc/ideas-ipc";
import { LibraryRuntimeService, registerLibraryIpcHandlers } from "./ipc/library-ipc";
import { SettingsRuntimeService, registerSettingsIpcHandlers } from "./ipc/settings-ipc";
import { registerStrategyIpcHandlers, StrategyService } from "./ipc/strategy-ipc";
import { registerWorkshopIpcHandlers, WorkshopRuntimeService } from "./ipc/workshop-ipc";
import { createWorkspaceService, resolveWorkspaceRoot } from "./workspace/workspace.service";
import { ExportService } from "./domains/export/export.service";
import { PrivacyService } from "./domains/privacy/privacy.service";

log.initialize();

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    title: "LinkedIn Poster",
    backgroundColor: "#f4efe6",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false
    }  });

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  window.loadFile(join(__dirname, "../../out/renderer/index.html"));
}

app.whenReady().then(() => {
  const workspaceRoot = resolveWorkspaceRoot(app.getPath("userData"));
  const workspaceService = createWorkspaceService(workspaceRoot);
  const workspacePaths = workspaceService.ensureWorkspace();
  const db = createAppDatabase(workspacePaths.databasePath);
  const skillRunnerService = new SkillRunnerService({
    codexCliRunner: new CodexCliRunner()
  });
  const strategyService = new StrategyService(db, skillRunnerService);
  const getActiveStrategyBundle = () => {
    try {
      return strategyService.getActiveStrategyBundle();
    } catch {
      return null;
    }
  };
  const ideasService = new IdeasService(db, skillRunnerService);
  const workshopService = new WorkshopRuntimeService(
    db,
    ideasService.getRepository(),
    getActiveStrategyBundle,
    join(workspacePaths.logsDirectory, "executions"),
    skillRunnerService
  );
  const libraryService = new LibraryRuntimeService(db, skillRunnerService, getActiveStrategyBundle);
  const calendarService = new CalendarRuntimeService(db);
  const executionService = new ExecutionRuntimeService(
    db,
    () => new CodexCliRunner().isAvailable(),
    new SkillRegistryService([
      join(process.cwd(), "skills"),
      join(workspacePaths.rootDirectory, "skills")
    ]),
    skillRunnerService
  );
  const settingsService = new SettingsRuntimeService(
    new ExportService(
      workspacePaths.rootDirectory,
      join(workspacePaths.contentDirectory, "exports"),
      join(workspacePaths.contentDirectory, "strategy"),
      join(workspacePaths.logsDirectory, "executions")
    ),
    new PrivacyService(join(workspacePaths.logsDirectory, "executions"))
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

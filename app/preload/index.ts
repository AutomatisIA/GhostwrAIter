import { contextBridge, ipcRenderer } from "electron";
import type { ExecutionApi } from "@shared/types/execution";
import type { CalendarApi } from "@shared/types/calendar";
import type { IdeasApi } from "@shared/types/ideas";
import type { LibraryApi } from "@shared/types/library";
import type { SettingsApi } from "@shared/types/settings";
import type { StrategyApi } from "@shared/types/strategy";
import type { WorkshopApi } from "@shared/types/workshop";

const strategy: StrategyApi = {
  getActiveBundle: () => ipcRenderer.invoke("strategy:get-active-bundle"),
  saveBundle: (bundle) => ipcRenderer.invoke("strategy:save-bundle", bundle)
};

const ideas: IdeasApi = {
  listIdeas: () => ipcRenderer.invoke("ideas:list"),
  createIdea: (idea) => ipcRenderer.invoke("ideas:create", idea)
};

const workshop: WorkshopApi = {
  getSessionByIdeaId: (ideaId) =>
    ipcRenderer.invoke("workshop:get-session-by-idea-id", ideaId),
  generateFromIdea: (ideaId) =>
    ipcRenderer.invoke("workshop:generate-from-idea", ideaId),
  correctDraft: (draftId) => ipcRenderer.invoke("workshop:correct-draft", draftId)
};

const library: LibraryApi = {
  listEntries: () => ipcRenderer.invoke("library:list-entries"),
  searchEntries: (input) => ipcRenderer.invoke("library:search-entries", input),
  createVariantFromDraft: (draftId) =>
    ipcRenderer.invoke("library:create-variant-from-draft", draftId)
};

const calendar: CalendarApi = {
  listItems: () => ipcRenderer.invoke("calendar:list-items"),
  scheduleDraft: (input) => ipcRenderer.invoke("calendar:schedule-draft", input)
};

const execution: ExecutionApi = {
  listRuns: () => ipcRenderer.invoke("execution:list-runs"),
  getDiagnostics: () => ipcRenderer.invoke("execution:get-diagnostics")
};

const settings: SettingsApi = {
  exportWorkspace: () => ipcRenderer.invoke("settings:export-workspace"),
  purgeExecutionLogs: () => ipcRenderer.invoke("settings:purge-execution-logs")
};

contextBridge.exposeInMainWorld("linkedinPoster", {
  platform: process.platform,
  appName: "LinkedIn Poster",
  strategy,
  ideas,
  workshop,
  library,
  calendar,
  execution,
  settings
});

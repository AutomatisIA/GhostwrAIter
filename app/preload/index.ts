import { contextBridge, ipcRenderer } from "electron";
import type { ExecutionApi } from "@shared/types/execution";
import type { CalendarApi } from "@shared/types/calendar";
import type { IdeasApi } from "@shared/types/ideas";
import type { LibraryApi } from "@shared/types/library";
import type { SettingsApi } from "@shared/types/settings";
import type { StrategyApi } from "@shared/types/strategy";
import type { WorkshopApi } from "@shared/types/workshop";

/**
 * IPC result envelope shape as emitted by the main process validated
 * handlers. Duplicated here as a local type (not imported) because the
 * preload bundle is CJS-only (see feature 002 sandbox fix commit
 * 20e7c61) and importing from app/main/ would pull in main-process
 * dependencies.
 */
type IpcResultEnvelope<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly field?: string;
      };
    };

/**
 * Unwraps an IPC result envelope into either the success data or a
 * thrown typed Error. The thrown Error carries the envelope's error
 * code as its `name` and the message (suffixed with the field when
 * present) as its `message`, so the renderer's existing
 * `try { ... } catch (err) { setStatus(err.message) }` pattern keeps
 * working unchanged.
 *
 * Defense in depth: if the main process ever returns something that
 * does not match the envelope shape (legacy handler, build drift),
 * the helper surfaces a generic error naming the channel so the
 * problem is visible rather than silently turning into `undefined`.
 */
async function unwrap<T>(channel: string, promise: Promise<unknown>): Promise<T> {
  const raw = await promise;
  if (raw === null || typeof raw !== "object" || !("ok" in raw)) {
    const err = new Error(
      `IPC channel "${channel}" returned a value that is not an IpcResult envelope`
    );
    err.name = "IPC_MALFORMED_RESPONSE";
    throw err;
  }
  const envelope = raw as IpcResultEnvelope<T>;
  if (envelope.ok) {
    return envelope.data;
  }
  const error = new Error(
    envelope.error.field
      ? `${envelope.error.message} (field: ${envelope.error.field})`
      : envelope.error.message
  );
  error.name = envelope.error.code;
  throw error;
}

const strategy: StrategyApi = {
  getActiveBundle: () => unwrap("strategy:get-active-bundle", ipcRenderer.invoke("strategy:get-active-bundle")),
  saveBundle: (bundle) => unwrap("strategy:save-bundle", ipcRenderer.invoke("strategy:save-bundle", bundle)),
  generateFoundation: () =>
    unwrap("strategy:generate-foundation", ipcRenderer.invoke("strategy:generate-foundation"))
};

const ideas: IdeasApi = {
  listIdeas: () => unwrap("ideas:list", ipcRenderer.invoke("ideas:list")),
  createIdea: (idea) => unwrap("ideas:create", ipcRenderer.invoke("ideas:create", idea)),
  createFromNewsSource: (input) =>
    unwrap("ideas:create-from-news-source", ipcRenderer.invoke("ideas:create-from-news-source", input)),
  generateFromStrategy: () =>
    unwrap("ideas:generate-from-strategy", ipcRenderer.invoke("ideas:generate-from-strategy"))
};

const workshop: WorkshopApi = {
  getSessionByIdeaId: (ideaId) =>
    unwrap("workshop:get-session-by-idea-id", ipcRenderer.invoke("workshop:get-session-by-idea-id", ideaId)),
  generateFromIdea: (ideaId) =>
    unwrap("workshop:generate-from-idea", ipcRenderer.invoke("workshop:generate-from-idea", ideaId)),
  correctDraft: (draftId) =>
    unwrap("workshop:correct-draft", ipcRenderer.invoke("workshop:correct-draft", draftId)),
  getSuggestedStructures: (ideaId, typology, objective) =>
    unwrap(
      "workshop:get-suggested-structures",
      ipcRenderer.invoke("workshop:get-suggested-structures", ideaId, typology, objective)
    ),
  generateHooks: (ideaId, typology, structureKey) =>
    unwrap(
      "workshop:generate-hooks",
      ipcRenderer.invoke("workshop:generate-hooks", ideaId, typology, structureKey)
    ),
  generateFinalDraft: (
    ideaId,
    typology,
    objective,
    structureKey,
    structureLabel,
    selectedHookId,
    selectedHookText,
    hooks
  ) =>
    unwrap(
      "workshop:generate-final-draft",
      ipcRenderer.invoke(
        "workshop:generate-final-draft",
        ideaId,
        typology,
        objective,
        structureKey,
        structureLabel,
        selectedHookId,
        selectedHookText,
        hooks
      )
    ),
  createVariant: (draftId, variantType) =>
    unwrap("workshop:create-variant", ipcRenderer.invoke("workshop:create-variant", draftId, variantType)),
  updateDraftText: (draftId, headline, bodyMarkdown) =>
    unwrap(
      "workshop:update-draft-text",
      ipcRenderer.invoke("workshop:update-draft-text", draftId, headline, bodyMarkdown)
    )
};

const library: LibraryApi = {
  listEntries: () => unwrap("library:list-entries", ipcRenderer.invoke("library:list-entries")),
  searchEntries: (input) => unwrap("library:search-entries", ipcRenderer.invoke("library:search-entries", input)),
  createVariantFromDraft: (draftId) =>
    unwrap("library:create-variant-from-draft", ipcRenderer.invoke("library:create-variant-from-draft", draftId)),
  updateEntryText: (draftId, headline, bodyMarkdown) =>
    unwrap(
      "library:update-entry-text",
      ipcRenderer.invoke("library:update-entry-text", draftId, headline, bodyMarkdown)
    ),
  createDivergentVariant: (draftId) =>
    unwrap("library:create-divergent-variant", ipcRenderer.invoke("library:create-divergent-variant", draftId)),
  deleteEntry: (draftId) =>
    unwrap("library:delete-entry", ipcRenderer.invoke("library:delete-entry", draftId))
};

const calendar: CalendarApi = {
  listItems: () => unwrap("calendar:list-items", ipcRenderer.invoke("calendar:list-items")),
  scheduleDraft: (input) => unwrap("calendar:schedule-draft", ipcRenderer.invoke("calendar:schedule-draft", input))
};

const execution: ExecutionApi = {
  listRuns: () => unwrap("execution:list-runs", ipcRenderer.invoke("execution:list-runs")),
  getDiagnostics: () => unwrap("execution:get-diagnostics", ipcRenderer.invoke("execution:get-diagnostics")),
  openRunLog: (runId) =>
    unwrap("execution:open-run-log", ipcRenderer.invoke("execution:open-run-log", runId))
};

const settings: SettingsApi = {
  exportWorkspace: () => unwrap("settings:export-workspace", ipcRenderer.invoke("settings:export-workspace")),
  countExecutionLogs: () =>
    unwrap("settings:count-execution-logs", ipcRenderer.invoke("settings:count-execution-logs")),
  purgeExecutionLogs: () =>
    unwrap("settings:purge-execution-logs", ipcRenderer.invoke("settings:purge-execution-logs")),
  getPreference: (key) =>
    unwrap("settings:get-preference", ipcRenderer.invoke("settings:get-preference", { key })),
  setPreference: (key, value) =>
    unwrap("settings:set-preference", ipcRenderer.invoke("settings:set-preference", { key, value })),
  getAllPreferences: () =>
    unwrap("settings:get-all-preferences", ipcRenderer.invoke("settings:get-all-preferences")),
  detectEngines: () =>
    unwrap("settings:detect-engines", ipcRenderer.invoke("settings:detect-engines")),
  getActiveEngine: () =>
    unwrap("settings:get-active-engine", ipcRenderer.invoke("settings:get-active-engine")),
  setActiveEngine: (engine) =>
    unwrap("settings:set-active-engine", ipcRenderer.invoke("settings:set-active-engine", { engine }))
};

contextBridge.exposeInMainWorld("linkedinPoster", {
  platform: process.platform,
  appName: "GhostwrAIter",
  appVersion: "1.0.0",
  strategy,
  ideas,
  workshop,
  library,
  calendar,
  execution,
  settings
});

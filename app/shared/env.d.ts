import type { CalendarApi } from "./types/calendar";
import type { ExecutionApi, OnExecutionProgress } from "./types/execution";
import type { IdeasApi } from "./types/ideas";
import type { LibraryApi } from "./types/library";
import type { SettingsApi } from "./types/settings";
import type { StrategyApi } from "./types/strategy";
import type { WorkshopApi } from "./types/workshop";

export {};

declare global {
  /** Injecte par electron-vite (`define`) depuis package.json.version. */
  const __APP_VERSION__: string;

  interface Window {
    linkedinPoster: {
      platform: string;
      appName: string;
      appVersion: string;
      strategy: StrategyApi;
      ideas: IdeasApi;
      workshop: WorkshopApi;
      library: LibraryApi;
      calendar: CalendarApi;
      execution: ExecutionApi;
      settings: SettingsApi;
      /** Abonnement additif au canal de progression IA (feature 010, T028). */
      onExecutionProgress: OnExecutionProgress;
    };
  }
}

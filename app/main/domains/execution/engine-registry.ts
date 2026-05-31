import type { CliEngineName, CliEngineStatus, EngineSelection } from "../../../shared/types/settings";
import type { SettingsService } from "../settings/settings.service";
import type { CliEngine } from "./cli-engine";

const ACTIVE_ENGINE_PREFERENCE_KEY = "active_engine";
const ENGINE_PRIORITY: CliEngineName[] = ["codex", "claude", "gemini"];

export class EngineRegistry {
  private readonly engines: CliEngine[];

  constructor(
    private readonly settingsService: SettingsService,
    engines: CliEngine[]
  ) {
    this.engines = engines;
  }

  async detectEngines(): Promise<CliEngineStatus[]> {
    const statuses: CliEngineStatus[] = [];
    for (const engine of this.engines) {
      statuses.push(await engine.getStatus());
    }
    return statuses;
  }

  async getActiveEngine(): Promise<EngineSelection> {
    const preference = this.settingsService.getPreference(ACTIVE_ENGINE_PREFERENCE_KEY);
    const storedName = preference.value as CliEngineName | null;

    if (storedName) {
      const engine = this.getEngineByName(storedName);
      if (engine) {
        const status = await engine.getStatus();
        if (status.installState === "authenticated") {
          return { engine: storedName, status };
        }
      }
    }

    // Fallback: first authenticated engine by priority
    for (const name of ENGINE_PRIORITY) {
      const engine = this.getEngineByName(name);
      if (engine) {
        const status = await engine.getStatus();
        if (status.installState === "authenticated") {
          return { engine: name, status };
        }
      }
    }

    // No authenticated engine found — return the stored one or the first
    const fallbackName: CliEngineName = storedName ?? ENGINE_PRIORITY[0]!;
    const fallbackEngine = this.getEngineByName(fallbackName);
    const fallbackStatus = fallbackEngine
      ? await fallbackEngine.getStatus()
      : {
          name: fallbackName,
          displayName: fallbackName,
          binaryPath: null,
          installState: "not-installed" as const,
          version: null,
          subscriptionLabel: "",
          installCommand: "",
          loginCommand: ""
        };

    return { engine: fallbackName, status: fallbackStatus };
  }

  async setActiveEngine(name: CliEngineName): Promise<EngineSelection> {
    this.settingsService.setPreference(ACTIVE_ENGINE_PREFERENCE_KEY, name);

    const engine = this.getEngineByName(name);
    const status = engine
      ? await engine.getStatus()
      : {
          name,
          displayName: name,
          binaryPath: null,
          installState: "not-installed" as const,
          version: null,
          subscriptionLabel: "",
          installCommand: "",
          loginCommand: ""
        };

    return { engine: name, status };
  }

  getEngineByName(name: string): CliEngine | undefined {
    return this.engines.find((e) => e.name === name);
  }
}

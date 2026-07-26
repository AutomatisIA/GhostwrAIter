import type { CliEngineName, CliEngineStatus, EngineSelection } from "../../../shared/types/settings";
import type { SettingsService } from "../settings/settings.service";
import type { CliEngine } from "./cli-engine";

const ACTIVE_ENGINE_PREFERENCE_KEY = "active_engine";
const ENGINE_PRIORITY: CliEngineName[] = ["codex", "claude", "antigravity"];

/**
 * Noms de moteur retires, et ce par quoi ils sont remplaces.
 *
 * `gemini` a disparu le 25 juillet 2026 : Google a retire Gemini CLI aux
 * particuliers au profit de la suite Antigravity, et la CLI installee ne
 * repondait plus que par une erreur d eligibilite.
 *
 * Sans cette table, un utilisateur ayant choisi Gemini garde la chaine
 * « gemini » dans `app_settings`. Deux consequences, toutes deux mauvaises :
 * `cliEngineNameSchema` la rejette, ce qui fait echouer la validation du canal
 * IPC ; et `getEngineByName` ne trouve rien, ce qui fait retomber la resolution
 * sur l ordre de priorite. L application basculerait donc en silence sur un
 * autre moteur, exactement le comportement corrige plus tot ce jour-la, ou le
 * reglage des Parametres n etait qu un decor.
 */
const MOTEURS_RETIRES: Record<string, CliEngineName> = {
  gemini: "antigravity"
};

/**
 * Traduit un nom de moteur enregistre vers un nom encore valide.
 *
 * `onMigrated` est appele uniquement lorsqu une traduction a eu lieu, pour que
 * l appelant puisse reecrire la valeur en base une bonne fois.
 */
export function migrateStoredEngineName(
  stored: string | null,
  onMigrated?: (name: CliEngineName) => void
): CliEngineName | null {
  if (!stored) return null;

  const remplacant = MOTEURS_RETIRES[stored];
  if (remplacant) {
    onMigrated?.(remplacant);
    return remplacant;
  }

  return stored as CliEngineName;
}

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

  /**
   * Resout le moteur actif.
   *
   * Un choix explicite de l utilisateur est CONTRAIGNANT : on renvoie ce moteur
   * avec son etat reel, meme non authentifie, au lieu de basculer en silence sur
   * un autre. C est ce basculement qui faisait afficher un moteur aux Parametres
   * pendant qu un autre travaillait (cf. docs/audit-2026-07-fonctionnel.md).
   *
   * La selection par ordre de priorite ne s applique qu en l absence de tout
   * choix enregistre, c est-a-dire au premier lancement.
   */
  async getActiveEngine(): Promise<EngineSelection> {
    const preference = this.settingsService.getPreference(ACTIVE_ENGINE_PREFERENCE_KEY);
    const storedName = migrateStoredEngineName(preference.value, (name) => {
      // Reecriture unique : sans elle, la traduction serait refaite a chaque
      // lecture et la valeur perimee resterait en base indefiniment, prete a
      // faire echouer la validation zod du canal IPC des qu un autre chemin
      // lirait la preference sans passer par ici.
      try {
        this.settingsService.setPreference(ACTIVE_ENGINE_PREFERENCE_KEY, name);
      } catch {
        // La traduction en memoire suffit pour cette session. Une base en
        // lecture seule ne doit pas empecher l application de demarrer.
      }
    });

    if (storedName) {
      const engine = this.getEngineByName(storedName);
      if (engine) {
        return { engine: storedName, status: await engine.getStatus() };
      }
    }

    // Aucun choix enregistre : premier moteur authentifie par ordre de priorite.
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

  /**
   * Choix explicite de l utilisateur, ou null s il n a jamais choisi. Lecture
   * seule en base, sans appel systeme : utilisable sur un chemin chaud.
   */
  getSelectedEngineName(): CliEngineName | null {
    const preference = this.settingsService.getPreference(ACTIVE_ENGINE_PREFERENCE_KEY);
    // Meme traduction que dans `getActiveEngine`. C est la SECONDE lecture de
    // cette preference, et l oublier suffirait a laisser fuir « gemini » vers
    // l interface, ou la validation du canal le rejetterait. Une migration ne
    // vaut que si elle couvre toutes les surfaces de lecture, pas la premiere
    // trouvee.
    return migrateStoredEngineName(preference.value);
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

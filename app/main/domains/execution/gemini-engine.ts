import { spawnSync } from "node:child_process";
import { spawnCli } from "./spawn-cli";
import type { CliEngineStatus } from "../../../shared/types/settings";
import type { CliEngine } from "./cli-engine";
import { findCliBinary } from "./find-cli-binary";

const DEFAULT_TIMEOUT_MS = 120_000;

function resolveCommand(): string {
  return findCliBinary("gemini") ?? "gemini";
}

export class GeminiEngine implements CliEngine {
  readonly name = "gemini" as const;

  async isInstalled(): Promise<boolean> {
    return findCliBinary("gemini") !== null;
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const command = resolveCommand();
      const result = spawnSync(command, ["auth", "status"], {
        encoding: "utf8",
        timeout: 10_000
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<CliEngineStatus> {
    const binaryPath = findCliBinary("gemini");
    const installed = binaryPath !== null;
    let authenticated = false;

    if (installed) {
      authenticated = await this.isAuthenticated();
    }

    return {
      name: "gemini",
      displayName: "Gemini CLI",
      binaryPath,
      installState: authenticated ? "authenticated" : installed ? "installed" : "not-installed",
      version: null,
      subscriptionLabel: "Abonnement Google AI Premium",
      // Le paquet est publie par Google, pas par Anthropic. `@anthropic-ai/gemini-cli`
      // n existe pas (404 sur le registre npm, verifie le 2026-07-25) : la commande
      // affichee dans les Parametres, bouton Copier compris, ne pouvait pas aboutir.
      installCommand: "npm install -g @google/gemini-cli",
      loginCommand: "gemini login"
    };
  }

  async executeSkill(prompt: string, timeoutMs?: number): Promise<string> {
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const command = resolveCommand();

    const result = await spawnCli(command, ["--json"], {
      input: prompt,
      timeoutMs: timeout
    });

    if (result.timedOut) {
      throw new Error(
        `Gemini CLI did not respond within ${timeout} ms.`
      );
    }

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "Unknown Gemini CLI error");
    }

    return (result.stdout ?? "").trim();
  }
}

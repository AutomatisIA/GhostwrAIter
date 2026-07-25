import { spawnSync } from "node:child_process";
import { spawnCli } from "./spawn-cli";
import type { CliEngineStatus } from "../../../shared/types/settings";
import type { CliEngine } from "./cli-engine";
import { findCliBinary } from "./find-cli-binary";

const DEFAULT_TIMEOUT_MS = 120_000;

function resolveCommand(): string {
  return findCliBinary("claude") ?? "claude";
}

export class ClaudeEngine implements CliEngine {
  readonly name = "claude" as const;

  async isInstalled(): Promise<boolean> {
    return findCliBinary("claude") !== null;
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
    const binaryPath = findCliBinary("claude");
    const installed = binaryPath !== null;
    let authenticated = false;

    if (installed) {
      authenticated = await this.isAuthenticated();
    }

    return {
      name: "claude",
      displayName: "Claude Code",
      binaryPath,
      installState: authenticated ? "authenticated" : installed ? "installed" : "not-installed",
      version: null,
      subscriptionLabel: "Abonnement Claude Pro ou Team",
      installCommand: "npm install -g @anthropic-ai/claude-code",
      // `claude auth login`, verifie contre `claude auth --help`. `claude
      // login` seul n est pas une commande.
      loginCommand: "claude auth login"
    };
  }

  async executeSkill(prompt: string, timeoutMs?: number): Promise<string> {
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const command = resolveCommand();

    const result = await spawnCli(command, ["--print", "--output-format", "json"], {
      input: prompt,
      timeoutMs: timeout
    });

    if (result.timedOut) {
      throw new Error(
        `Claude Code did not respond within ${timeout} ms.`
      );
    }

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "Unknown Claude Code error");
    }

    return (result.stdout ?? "").trim();
  }
}

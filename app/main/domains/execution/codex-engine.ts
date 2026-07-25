import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { spawnCli } from "./spawn-cli";
import type { CliEngineStatus } from "../../../shared/types/settings";
import type { CliEngine } from "./cli-engine";
import { findCodexBinary } from "./find-codex-binary";

const DEFAULT_TIMEOUT_MS = 120_000;

function resolveCommand(): string {
  return findCodexBinary() ?? "codex";
}

export class CodexEngine implements CliEngine {
  readonly name = "codex" as const;

  async isInstalled(): Promise<boolean> {
    return findCodexBinary() !== null;
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const command = resolveCommand();
      const result = spawnSync(command, ["login", "status"], {
        encoding: "utf8",
        timeout: 10_000
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<CliEngineStatus> {
    const binaryPath = findCodexBinary();
    const installed = binaryPath !== null;
    let authenticated = false;

    if (installed) {
      authenticated = await this.isAuthenticated();
    }

    return {
      name: "codex",
      displayName: "Codex (ChatGPT)",
      binaryPath,
      installState: authenticated ? "authenticated" : installed ? "installed" : "not-installed",
      version: null,
      subscriptionLabel: "Abonnement ChatGPT Plus ou Team",
      installCommand: "npm install -g @openai/codex",
      loginCommand: "codex login"
    };
  }

  async executeSkill(prompt: string, timeoutMs?: number): Promise<string> {
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const command = resolveCommand();

    const tempDirectory = mkdtempSync(join(tmpdir(), "ghostwraiter-codex-"));
    const outputPath = join(tempDirectory, "last-message.json");

    try {
      const result = await spawnCli(
        command,
        [
          "exec",
          "--skip-git-repo-check",
          "--ephemeral",
          "--output-last-message",
          outputPath,
          "-"
        ],
        { input: prompt, timeoutMs: timeout }
      );

      if (result.timedOut) {
        throw new Error(
          `Codex CLI did not respond within ${timeout} ms. Increase CODEX_CLI_TIMEOUT_MS or verify Codex availability.`
        );
      }

      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || "Unknown Codex CLI error");
      }

      return readFileSync(outputPath, "utf8").trim();
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  }
}

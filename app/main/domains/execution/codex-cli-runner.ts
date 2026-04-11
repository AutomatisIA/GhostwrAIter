import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type {
  SkillRunnerInvocation,
  SkillRunnerResult
} from "./skill-runner.service";
import { findCodexBinary } from "./find-codex-binary";
import {
  SkillPromptNotFoundError,
  createDefaultSkillPromptLoader,
  type SkillPromptLoader
} from "./skill-prompt-loader";

export type CodexCliCommandExecutor = (
  args: string[],
  input: string
) => {
  status: number | null;
  stdout: string;
  stderr: string;
  signal?: NodeJS.Signals | null;
};

const DEFAULT_CODEX_CLI_TIMEOUT_MS = 120_000;

/**
 * Reads the Codex CLI timeout from the environment variable
 * `CODEX_CLI_TIMEOUT_MS`. Accepts only a finite positive integer; any other
 * value (missing, empty, non-numeric, zero, negative) resolves to the default
 * of 120 000 ms (2 minutes). Read lazily per invocation so tests can override
 * by mutating `process.env` between calls.
 */
export function resolveCodexCliTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.CODEX_CLI_TIMEOUT_MS;
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_CODEX_CLI_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CODEX_CLI_TIMEOUT_MS;
  }
  return parsed;
}

export type CodexCliFilesystem = {
  makeTempDir: () => string;
  readFile: (path: string) => string;
  removeDir: (path: string) => void;
};

/**
 * Resolves the Codex CLI command to invoke for the current host. Uses
 * `findCodexBinary()` to locate an absolute path when possible, and falls
 * back to the bare name `codex` so the shell PATH resolution handles the
 * lookup as a last resort. Exported so the runner's tests can verify the
 * host-platform branch without spawning a real process.
 */
export function resolveCodexCommand(): string {
  return findCodexBinary() ?? "codex";
}

function defaultExecutor(args: string[], input: string) {
  const timeoutMs = resolveCodexCliTimeoutMs();
  const command = resolveCodexCommand();
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    cwd: process.cwd(),
    env: process.env,
    timeout: timeoutMs
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    signal: result.signal
  };
}

function defaultFilesystem(): CodexCliFilesystem {
  return {
    makeTempDir: () => mkdtempSync(join(tmpdir(), "linkedin-poster-codex-")),
    readFile: (path) => readFileSync(path, "utf8"),
    removeDir: (path) => rmSync(path, { recursive: true, force: true })
  };
}

export class CodexCliRunner {
  constructor(
    private readonly executor: CodexCliCommandExecutor = defaultExecutor,
    private readonly filesystem: CodexCliFilesystem = defaultFilesystem(),
    private readonly promptLoader: SkillPromptLoader = createDefaultSkillPromptLoader()
  ) {}

  isAvailable() {
    const result = this.executor(["login", "status"], "");
    return result.status === 0;
  }

  execute(invocation: SkillRunnerInvocation): SkillRunnerResult {
    let skillPrompt: string;
    try {
      skillPrompt = this.promptLoader.loadPrompt(invocation.skillName);
    } catch (err) {
      if (err instanceof SkillPromptNotFoundError) {
        return {
          status: "failed",
          summary: "Skill prompt missing",
          error: {
            code: "SKILL_PROMPT_NOT_FOUND",
            message: err.message
          }
        };
      }
      throw err;
    }

    const tempDirectory = this.filesystem.makeTempDir();
    const outputPath = join(tempDirectory, "last-message.json");

    try {
      const result = this.executor(
        [
          "exec",
          "--skip-git-repo-check",
          "--ephemeral",
          "--output-last-message",
          outputPath,
          "-"
        ],
        this.buildPrompt(invocation, skillPrompt)
      );

      if (result.signal === "SIGTERM" && result.status === null) {
        const timeoutMs = resolveCodexCliTimeoutMs();
        return {
          status: "failed",
          summary: "Codex CLI execution timed out",
          error: {
            code: "CODEX_CLI_TIMEOUT",
            message: `Codex CLI did not respond within ${timeoutMs} ms. Increase CODEX_CLI_TIMEOUT_MS or verify Codex availability.`
          }
        };
      }

      if (result.status !== 0) {
        return {
          status: "failed",
          summary: "Codex CLI execution failed",
          error: {
            code: "CODEX_CLI_FAILED",
            message: result.stderr || result.stdout || "Unknown Codex CLI error"
          }
        };
      }

      const message = this.filesystem.readFile(outputPath).trim();

      try {
        return JSON.parse(message) as SkillRunnerResult;
      } catch {
        return {
          status: "failed",
          summary: "Codex CLI returned non-JSON output",
          error: {
            code: "CODEX_CLI_INVALID_JSON",
            message
          }
        };
      }
    } finally {
      this.filesystem.removeDir(tempDirectory);
    }
  }

  private buildPrompt(invocation: SkillRunnerInvocation, skillPrompt: string) {
    return [
      "You are a premium LinkedIn editorial skill runner for a consultant in generative AI for SMEs.",
      "You are not allowed to degrade gracefully, simulate missing data, or invent placeholders.",
      "If the requested output cannot be produced with high confidence from the provided context, return a failed JSON response.",
      "Return only valid JSON matching the requested contract.",
      "Do not wrap the JSON in markdown fences.",
      "Never expose internal reasoning, validation grids, or hidden control logic in the final editorial output.",
      "Never invent numbers, proofs, clients, results, links, or examples that are not explicitly present in the input.",
      'Do not use "partial". If the contract cannot be fully satisfied, return "failed".',
      "",
      "Required top-level JSON fields:",
      '- "status" in ["succeeded","failed","partial"]',
      '- "summary" as a string',
      '- "data" object for successful runs',
      '- "error" object for failed runs',
      "",
      "Quality doctrine:",
      "- Exact voice over generic correctness.",
      "- Concrete over abstract.",
      "- One strong idea per output.",
      "- Anti-hype, anti-corporate, anti-generic AI phrasing.",
      "- Hooks must create tension, curiosity, or a sharp business contrast.",
      "- Structures must be compatible with the requested typology and objective.",
      "- Correction must be silent: return the corrected content, not an explanation of the correction process.",
      "",
      "Contract-specific instructions:",
      skillPrompt,
      "",
      "Invocation:",
      JSON.stringify(invocation, null, 2)
    ].join("\n");
  }

}

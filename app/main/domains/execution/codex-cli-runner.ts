import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type {
  SkillRunnerInvocation,
  SkillRunnerResult
} from "./skill-runner.service";

export type CodexCliCommandExecutor = (
  args: string[],
  input: string
) => {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type CodexCliFilesystem = {
  makeTempDir: () => string;
  readFile: (path: string) => string;
  removeDir: (path: string) => void;
};

function defaultExecutor(args: string[], input: string) {
  const result = spawnSync("codex", args, {
    input,
    encoding: "utf8",
    cwd: process.cwd()
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
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
    private readonly filesystem: CodexCliFilesystem = defaultFilesystem()
  ) {}

  isAvailable() {
    const result = this.executor(["login", "status"], "");
    return result.status === 0;
  }

  execute(invocation: SkillRunnerInvocation): SkillRunnerResult {
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
        this.buildPrompt(invocation)
      );

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

  private buildPrompt(invocation: SkillRunnerInvocation) {
    return [
      "You are a LinkedIn editorial skill runner.",
      "Return only valid JSON matching the requested contract.",
      "Do not wrap the JSON in markdown fences.",
      "",
      "Required top-level fields:",
      '- "status" in ["succeeded","failed","partial"]',
      '- "summary" as a string',
      '- "data" object for successful runs',
      "",
      "Invocation:",
      JSON.stringify(invocation, null, 2)
    ].join("\n");
  }
}

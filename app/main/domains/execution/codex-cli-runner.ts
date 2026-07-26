import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type {
  SkillRunnerInvocation,
  SkillRunnerResult
} from "./skill-runner.service";
import { findCodexBinary } from "./find-codex-binary";
import { CODEX_ENV_KEYS, CODEX_POLICY_ARGS } from "./codex-engine";
import { buildChildEnv } from "./spawn-cli";
import {
  FrameworkPromptNotFoundError,
  SkillPromptNotFoundError,
  assembleSkillPrompt,
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

/**
 * Racine de travail demandee a Codex, relue depuis l argument `-C` de l argv.
 *
 * L executeur ne recoit que `args` et `input` : il n a pas de reference au
 * dossier temporaire cree plus haut. Plutot que d elargir la signature, donc
 * tous les doubles de test avec elle, la valeur est relue depuis l argv, ou
 * elle est deja. Ainsi le repertoire de travail du processus ne peut pas
 * diverger de la racine annoncee a l agent.
 */
function workingDirectoryFromArgs(args: string[]): string | undefined {
  const index = args.indexOf("-C");
  return index >= 0 ? args[index + 1] : undefined;
}

function defaultExecutor(args: string[], input: string) {
  const timeoutMs = resolveCodexCliTimeoutMs();
  const command = resolveCodexCommand();
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    cwd: workingDirectoryFromArgs(args) ?? process.cwd(),
    // Meme liste blanche que le moteur asynchrone. `process.env` en entier
    // laissait passer les jetons de tous les autres projets du poste.
    env: buildChildEnv(CODEX_ENV_KEYS),
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
    makeTempDir: () => mkdtempSync(join(tmpdir(), "ghostwraiter-codex-")),
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
    let frameworkPreamble: string;
    try {
      frameworkPreamble = this.promptLoader.loadFrameworkPreamble();
      skillPrompt = this.promptLoader.loadPrompt(invocation.skillName);
    } catch (err) {
      if (err instanceof FrameworkPromptNotFoundError) {
        return {
          status: "failed",
          summary: "Framework preamble missing",
          error: {
            code: "FRAMEWORK_PROMPT_NOT_FOUND",
            message: err.message
          }
        };
      }
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
          // POLITIQUE D EXECUTION EPINGLEE, identique a celle du moteur
          // asynchrone : les drapeaux viennent de la meme constante partagee,
          // ils ne peuvent donc pas diverger. Voir le bloc de documentation
          // au-dessus de `CodexEngine`.
          //
          // Ce chemin-ci n est pas celui qu emprunte l application aujourd hui
          // (`executeAsync` passe par le registre de moteurs), mais il lance la
          // meme commande avec le meme prompt, donc avec le meme texte
          // d origine incontrolee. « Ce n est pas le chemin actif » n est pas
          // une propriete qui se garantit dans le temps : un montage sans
          // registre le rallume en silence.
          ...CODEX_POLICY_ARGS,
          "-C",
          tempDirectory,
          "--skip-git-repo-check",
          "--ephemeral",
          "--output-last-message",
          outputPath,
          "-"
        ],
        // Assemblage partage (source unique) : preambule cadre + contrat
        // par-skill + invocation. Voir assembleSkillPrompt / skill-prompt-loader.
        assembleSkillPrompt(invocation, skillPrompt, frameworkPreamble)
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


}

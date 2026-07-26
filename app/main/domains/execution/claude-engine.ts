import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildChildEnv, spawnCli } from "./spawn-cli";
import type { CliEngineStatus } from "../../../shared/types/settings";
import type { CliEngine } from "./cli-engine";
import { findCliBinary } from "./find-cli-binary";

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Variables d environnement propres a Claude Code.
 *
 * `CLAUDE_CONFIG_DIR` situe le dossier de configuration, donc les jetons de
 * l abonnement. Les variables `ANTHROPIC_*` couvrent l usage par cle d API et
 * les passerelles d entreprise.
 *
 * Bedrock et Vertex ne sont volontairement PAS couverts : ils demanderaient de
 * laisser passer les identifiants AWS et Google du poste, alors que
 * l application s adresse a un abonnement Claude Pro ou Team (voir
 * `subscriptionLabel` plus bas). Si ce besoin apparait, c est ici qu il
 * s ajoute, en le nommant.
 */
const CLAUDE_ENV_KEYS = [
  "CLAUDE_CONFIG_DIR",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_CUSTOM_HEADERS"
] as const;

function resolveCommand(): string {
  return findCliBinary("claude") ?? "claude";
}

/**
 * POLITIQUE D EXECUTION EPINGLEE POUR CLAUDE CODE.
 *
 * Meme raison que pour Codex : le prompt transporte du texte que l application
 * ne controle pas, et Claude Code est un agent outille. On lui demande du texte,
 * la ligne de commande doit le dire.
 *
 * Les cinq drapeaux, verifies contre `claude --help` de la version 2.1.220 :
 *
 *   `--tools ""`                 « Use "" to disable all tools ». C est la
 *                                garantie de fond : sans outil, il ne reste que
 *                                de la generation de texte. Place avant un autre
 *                                drapeau et jamais en fin de ligne, car l option
 *                                est variadique et avalerait ce qui suit.
 *   `--permission-mode manual`   Ceinture par-dessus la bretelle : meme si un
 *                                outil revenait, il faudrait une approbation
 *                                qui ne peut pas arriver en mode non
 *                                interactif. Surtout, cette valeur est EPINGLEE
 *                                au lieu d etre heritee : un poste dont les
 *                                reglages portent `bypassPermissions` ou `auto`
 *                                ne dicte plus la politique.
 *   `--safe-mode`                Desactive CLAUDE.md, skills, plugins, hooks,
 *                                serveurs MCP, commandes et agents
 *                                personnalises. C est l equivalent Claude de
 *                                `--ignore-user-config`, en plus sur : son aide
 *                                precise que « Auth, model selection, built-in
 *                                tools, and permissions work normally ». Le
 *                                choix de modele de l utilisateur survit donc,
 *                                la ou Codex le perd.
 *   `--strict-mcp-config`        « Only use MCP servers from --mcp-config » ;
 *                                aucun `--mcp-config` n etant fourni, l ensemble
 *                                devrait etre vide. CEINTURE NON MESUREE : le
 *                                26 juillet 2026, ni `claude mcp list` ni
 *                                `--debug mcp` n ont permis d observer une
 *                                difference en session, faute de trace
 *                                exploitable. La garantie effective vient de
 *                                `--safe-mode` et de `--tools ""` ; ce drapeau
 *                                est conserve parce qu il ne coute rien, pas
 *                                parce qu il a ete prouve.
 *   `--no-session-persistence`   Rien n est ecrit sur le disque : la generation
 *                                ne laisse pas de trace reprenable.
 *
 * `--bare` a ete EXAMINE ET REJETE, il aurait ete le choix evident. Son aide
 * indique que sous ce drapeau « Anthropic auth is strictly ANTHROPIC_API_KEY or
 * apiKeyHelper [...] OAuth and keychain are never read ». Il casserait donc
 * l authentification par abonnement, qui est le mode nominal de l application.
 */
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
        timeout: 10_000,
        env: buildChildEnv(CLAUDE_ENV_KEYS)
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

    // Repertoire de travail temporaire et vide. `--safe-mode` neutralise deja
    // la decouverte automatique des CLAUDE.md, mais un dossier vide retire aussi
    // les fichiers du poste du champ de lecture.
    const tempDirectory = mkdtempSync(join(tmpdir(), "ghostwraiter-claude-"));

    try {
      const result = await spawnCli(
        command,
        [
          "--print",
          "--output-format",
          "json",
          // POLITIQUE D EXECUTION EPINGLEE. Voir le bloc au-dessus de la classe.
          "--tools",
          "",
          "--permission-mode",
          "manual",
          "--safe-mode",
          "--strict-mcp-config",
          "--no-session-persistence"
        ],
        {
          input: prompt,
          timeoutMs: timeout,
          cwd: tempDirectory,
          envKeys: CLAUDE_ENV_KEYS
        }
      );

      if (result.timedOut) {
        throw new Error(
          `Claude Code did not respond within ${timeout} ms.`
        );
      }

      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || "Unknown Claude Code error");
      }

      return (result.stdout ?? "").trim();
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  }
}

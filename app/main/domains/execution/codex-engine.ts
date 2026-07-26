import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildChildEnv, spawnCli } from "./spawn-cli";
import type { CliEngineStatus } from "../../../shared/types/settings";
import type { CliEngine } from "./cli-engine";
import { findCodexBinary } from "./find-codex-binary";

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Variables d environnement propres a Codex, en plus de la liste blanche
 * commune de `spawn-cli`.
 *
 * `CODEX_HOME` est obligatoire ET suffisant pour l authentification, y compris
 * sous `--ignore-user-config` : l aide de la CLI le dit mot pour mot, « Do not
 * load `$CODEX_HOME/config.toml`; auth still uses `CODEX_HOME` ». Sans cette
 * variable, un utilisateur ayant deplace son dossier Codex serait rapporte comme
 * jamais connecte.
 */
export const CODEX_ENV_KEYS = [
  "CODEX_HOME",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_ORGANIZATION"
] as const;

/**
 * Drapeaux de politique communs a TOUS les lancements de `codex exec` du
 * depot. Exportes, et non recopies, parce que le depot a deux chemins
 * d execution Codex : ce moteur, et `codex-cli-runner.ts` (voie synchrone de
 * repli). Deux copies auraient diverge, et c est precisement le chemin le moins
 * frequente qui serait reste sans politique.
 *
 * `-C` n en fait pas partie : sa valeur est un dossier temporaire different a
 * chaque invocation, donc propre a l appelant.
 */
export const CODEX_POLICY_ARGS = [
  "-s",
  "read-only",
  "--ignore-user-config",
  "--ignore-rules"
] as const;

function resolveCommand(): string {
  return findCodexBinary() ?? "codex";
}

/**
 * POLITIQUE D EXECUTION EPINGLEE POUR CODEX.
 *
 * Ce que l application demande a Codex, c est du TEXTE. Elle ne lui demande
 * jamais d ecrire un fichier ni de lancer une commande. La ligne de commande
 * doit le dire, parce que le prompt transporte du contenu que l application ne
 * controle pas : un article colle par l utilisateur dans « Creer depuis une
 * veille » part tel quel dans `sourceSummary`. C est le seul endroit de
 * l application ou du texte hostile peut produire une ACTION plutot qu une
 * reponse.
 *
 * Sans drapeau, la politique appliquee est celle du `~/.codex/config.toml` du
 * poste. Sur une machine de developpement reelle, releve le 26 juillet 2026, ce
 * fichier portait `approvals_reviewer = "user"`, quatorze `trust_level =
 * "trusted"`, quatre plugins actifs (gmail, canva, github, documents) et quatre
 * serveurs MCP actifs, dont un REPL Node et un acces GitHub authentifie par
 * jeton. Des instructions injectees dans un article heritaient de tout cela.
 *
 * Les quatre drapeaux, verifies contre `codex exec --help` de codex-cli 0.145.0 :
 *
 *   `-s read-only`         Bac a sable : le modele ne peut ecrire nulle part.
 *                          Valeurs offertes : read-only, workspace-write,
 *                          danger-full-access. On prend la plus stricte.
 *   `--ignore-user-config` Ne charge pas `$CODEX_HOME/config.toml`. C EST LE
 *                          DRAPEAU CENTRAL, et pas pour la raison evidente : le
 *                          bac a sable borne les commandes SHELL, il ne borne
 *                          pas les outils MCP. Un serveur MCP declare dans la
 *                          config du poste resterait joignable sous
 *                          `-s read-only`. Seul ce drapeau les retire.
 *                          MESURE, PAS DEDUITE : le 26 juillet 2026, un serveur
 *                          MCP temoin declare dans un `CODEX_HOME` de test
 *                          ecrivait un fichier au demarrage. Sans le drapeau, le
 *                          fichier apparait, donc le serveur est reellement
 *                          lance ; avec le drapeau, il n apparait pas, et la
 *                          generation aboutit quand meme.
 *   `--ignore-rules`       Ne charge pas les fichiers `.rules` d execpolicy de
 *                          l utilisateur ou du projet.
 *   `-C <dossier>`         Racine de travail forcee sur un dossier temporaire
 *                          vide, donc sans AGENTS.md ni fichier du poste a lire.
 *
 * `-a/--ask-for-approval` n existe PAS sur `codex exec` : il n est offert que
 * par la commande interactive. Ne pas l ajouter en croyant a un oubli.
 *
 * Ce que cette politique coute : `--ignore-user-config` fait aussi tomber le
 * `model` choisi dans la config du poste, donc Codex retient son modele par
 * defaut. C est un arbitrage assume, et il joue plutot en faveur d un produit
 * distribue : le comportement cesse de dependre du poste. Sur la machine de
 * reference les deux coincidaient de toute facon (`gpt-5.6-sol`, en tete du
 * catalogue rendu par `codex debug models`).
 *
 * L authentification, elle, survit : `--ignore-user-config` ne touche pas
 * `CODEX_HOME`, ou vivent les jetons.
 */
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
        timeout: 10_000,
        // Meme liste blanche que la generation : un controle d etat n a pas
        // besoin de plus que la generation elle-meme.
        env: buildChildEnv(CODEX_ENV_KEYS)
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
          // POLITIQUE D EXECUTION EPINGLEE. Voir le bloc au-dessus de la classe.
          // Ces quatre drapeaux ne sont pas du confort : le prompt contient du
          // texte que l utilisateur a colle depuis le web, et sans eux la
          // politique appliquee est celle du poste, que l application ne lit ni
          // ne contraint.
          ...CODEX_POLICY_ARGS,
          "-C",
          tempDirectory,
          "--skip-git-repo-check",
          "--ephemeral",
          "--output-last-message",
          outputPath,
          "-"
        ],
        {
          input: prompt,
          timeoutMs: timeout,
          // Le repertoire de travail est le dossier temporaire vide, pas celui
          // de l application : ce qui n est pas dans le champ de vision de
          // l agent ne peut pas etre lu, meme en lecture seule.
          cwd: tempDirectory,
          envKeys: CODEX_ENV_KEYS
        }
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

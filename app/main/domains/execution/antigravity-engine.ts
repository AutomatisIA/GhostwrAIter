import { spawnCli } from "./spawn-cli";
import type { CliEngineStatus } from "../../../shared/types/settings";
import type { CliEngine } from "./cli-engine";
import { findCliBinary } from "./find-cli-binary";

/**
 * Moteur Antigravity (`agy`), en remplacement de Gemini CLI.
 *
 * Google a retire Gemini CLI aux particuliers. La CLI installee repond
 * desormais : « This client is no longer supported for Gemini Code Assist for
 * individuals. To continue using Gemini, please migrate to the Antigravity
 * suite of products ». Le moteur precedent ne pouvait donc plus produire un
 * seul post.
 *
 * Trois differences avec les deux autres moteurs, toutes verifiees en lancant
 * la CLI le 25 juillet 2026 :
 *
 *   1. Le prompt se passe en ARGUMENT (`agy -p <prompt>`), pas sur l entree
 *      standard. `echo prompt | agy -p` echoue avec « flag needs an argument ».
 *      Codex et Claude, eux, lisent leur entree standard.
 *   2. La sortie est la reponse brute du modele, SANS enveloppe JSON. Gemini
 *      encadrait dans `response`, Claude encadre dans `result` ; Antigravity
 *      n encadre rien. `extractSkillPayload` n a donc rien a deballer ici.
 *   3. Il n existe aucune sous-commande d authentification ni d installation.
 *      Le binaire est natif, depose dans le PATH par la suite Antigravity.
 */

// La CLI attend elle-meme cinq minutes par defaut (`--print-timeout 5m0s`).
// Borner en dessous ferait tuer le processus par l appelant alors que la
// generation aboutissait, ce qui se lirait comme une panne du moteur.
const DEFAULT_TIMEOUT_MS = 300_000;

function resolveCommand(): string {
  return findCliBinary("agy") ?? "agy";
}

export class AntigravityEngine implements CliEngine {
  readonly name = "antigravity" as const;

  async isInstalled(): Promise<boolean> {
    return findCliBinary("agy") !== null;
  }

  /**
   * `agy models` interroge le compte, liste les modeles disponibles et sort a
   * zero. C est le seul controle non interactif disponible, et il ne declenche
   * aucune generation.
   *
   * Le piege est documente ici parce qu il a deja coute : le moteur Gemini
   * lancait `gemini auth status`, or `auth` n etait pas une sous-commande. La
   * CLI traitait ces deux mots comme une REQUETE, demarrait une vraie
   * generation, echouait, et le moteur etait rapporte comme jamais
   * authentifie quoi que fasse l utilisateur, chaque detection consommant un
   * appel modele. Toute commande de controle doit etre une sous-commande
   * REELLE, verifiee contre l aide de la CLI.
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const result = await spawnCli(resolveCommand(), ["models"], {
        input: "",
        timeoutMs: 15_000
      });
      return result.status === 0 && !result.timedOut;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<CliEngineStatus> {
    const binaryPath = findCliBinary("agy");
    const installed = binaryPath !== null;
    let authenticated = false;

    if (installed) {
      authenticated = await this.isAuthenticated();
    }

    return {
      name: "antigravity",
      displayName: "Antigravity",
      binaryPath,
      installState: authenticated ? "authenticated" : installed ? "installed" : "not-installed",
      version: null,
      subscriptionLabel: "Abonnement Google Antigravity",
      // `agy` n est pas un paquet npm : c est un binaire natif que la suite
      // Antigravity depose dans le PATH. Aucune commande d installation ni de
      // connexion en une ligne n existe.
      //
      // Ces deux champs sont affiches AVEC UN BOUTON COPIER. Trois commandes
      // fausses ont deja ete corrigees sur cet ecran le meme jour :
      // `@anthropic-ai/gemini-cli` rendait 404 sur le registre npm, `claude
      // login` et `gemini login` n existent pas. Une commande inexistante dans
      // un panneau de diagnostic produit exactement l inverse de ce qu on en
      // attend. On rend donc une chaine vide, et l interface renvoie vers la
      // source plutot que de proposer a copier une commande qui echouera.
      installCommand: "",
      loginCommand: "",
      setupHint:
        "Antigravity fournit la commande agy. Installez la suite depuis antigravity.google, puis relancez la detection."
    };
  }

  async executeSkill(prompt: string, timeoutMs?: number): Promise<string> {
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const command = resolveCommand();

    // Le prompt est un element du tableau d arguments, jamais interpole dans
    // une chaine de shell : `spawnCli` n ouvre pas de shell, l argument est
    // transmis tel quel au processus, quels que soient les guillemets, retours
    // a la ligne et apostrophes qu il contient.
    const result = await spawnCli(command, ["-p", prompt], {
      input: "",
      timeoutMs: timeout
    });

    if (result.timedOut) {
      throw new Error(`Antigravity CLI did not respond within ${timeout} ms.`);
    }

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "Unknown Antigravity CLI error");
    }

    return (result.stdout ?? "").trim();
  }
}

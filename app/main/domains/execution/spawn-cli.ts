import { spawn } from "node:child_process";

/**
 * Lancement d un CLI SANS bloquer le processus principal.
 *
 * Les moteurs utilisaient `spawnSync`, qui gele le processus principal pendant
 * toute la duree de l invocation, soit quarante a cent secondes par generation.
 * macOS considere alors l application comme ne repondant plus : la fenetre se
 * fige, le curseur tourne, l utilisateur croit a un plantage.
 *
 * Cette version rend la main immediatement et resout une promesse a la fin, ce
 * qui laisse la boucle d evenements libre : l interface continue de repondre,
 * les animations tournent, le compteur de temps ecoule avance reellement.
 */

export type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export function spawnCli(
  command: string,
  args: readonly string[],
  options: { input: string; timeoutMs: number; cwd?: string }
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd ?? process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

    const finish = (result: CliResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (status) => {
      finish({ status, stdout, stderr, timedOut });
    });

    // L ecriture peut echouer si le processus meurt avant de lire son entree.
    // Ce n est pas une erreur du point de vue de l appelant : la fermeture qui
    // suit portera le vrai diagnostic.
    child.stdin.on("error", () => undefined);
    child.stdin.end(options.input);
  });
}

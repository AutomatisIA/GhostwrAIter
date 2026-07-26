import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnCli } from "../../app/main/domains/execution/spawn-cli";

/**
 * Le delai de `spawnCli` doit BORNER l execution, pas seulement l annoncer.
 *
 * La version precedente envoyait SIGTERM puis attendait `close`. Les deux
 * scenarios ci-dessous sont ceux ou cet evenement n arrive jamais : une CLI qui
 * intercepte SIGTERM sans en tenir compte, et un descendant qui garde les flux
 * ouverts apres la mort de son parent. Dans les deux cas la promesse restait
 * suspendue sans fin, la generation avec elle, et le dossier temporaire du
 * moteur n etait jamais efface.
 *
 * Les processus sont de VRAIS processus, lances avec l interpreteur qui execute
 * ces tests. De faux minuteurs ne prouveraient rien ici : ce qui est en cause
 * est le comportement du systeme face a un signal, pas une arithmetique de
 * delais.
 */
describe("spawnCli : borne d execution", () => {
  let dossier: string;

  beforeEach(() => {
    dossier = mkdtempSync(join(tmpdir(), "ghostwraiter-spawn-cli-"));
  });

  afterEach(() => {
    rmSync(dossier, { recursive: true, force: true });
  });

  /** Un identifiant de processus encore present dans la table du systeme. */
  function vivant(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Scrute jusqu a la limite. La livraison d un signal est asynchrone : lire
   * l etat une seule fois juste apres le reglage de la promesse mesurerait la
   * vitesse du systeme, pas l escalade.
   */
  async function scruter(predicat: () => boolean, limiteMs: number): Promise<boolean> {
    const echeance = Date.now() + limiteMs;
    while (Date.now() < echeance) {
      if (predicat()) return true;
      await new Promise((suite) => setTimeout(suite, 20));
    }
    return predicat();
  }

  it(
    "tue par SIGKILL une CLI qui ignore SIGTERM, et regle quand meme la promesse",
    async () => {
      const fichierPid = join(dossier, "pid");
      const script = [
        `require("node:fs").writeFileSync(${JSON.stringify(fichierPid)}, String(process.pid));`,
        // Le signal doux est intercepte et ignore : c est un droit du processus,
        // et c est le cas exact que l ancienne version ne bornait pas.
        `process.on("SIGTERM", () => {});`,
        // Garde la boucle d evenements vivante ET les deux flux ouverts.
        `setInterval(() => {}, 1000);`
      ].join("\n");

      const debut = Date.now();
      const resultat = await spawnCli(process.execPath, ["-e", script], {
        input: "",
        timeoutMs: 400,
        killGraceMs: 150
      });
      const ecoule = Date.now() - debut;

      expect(resultat.timedOut).toBe(true);
      // Le delai annonce est de 400 ms, plus 150 ms de sursis. Trois secondes
      // laissent de la marge au systeme sans laisser passer une attente infinie.
      expect(ecoule).toBeLessThan(3_000);

      const pid = Number(readFileSync(fichierPid, "utf8"));
      expect(Number.isInteger(pid)).toBe(true);
      // Sans l escalade, ce processus survit a la promesse : le reglage seul ne
      // suffirait pas a dire que l execution est bornee.
      expect(await scruter(() => !vivant(pid), 3_000)).toBe(true);
    },
    15_000
  );

  it(
    "regle des la sortie de la CLI, meme si un descendant garde les flux ouverts",
    async () => {
      const script = [
        `const { spawn } = require("node:child_process");`,
        // Le petit-fils herite des flux du fils. `close` attend la fermeture de
        // TOUS les flux : il n arrivera donc qu a la mort du petit-fils, bien
        // apres celle de son parent.
        `spawn(process.execPath, ["-e", "setTimeout(() => {}, 4000)"], { stdio: "inherit" });`,
        `process.stdout.write("sortie-complete");`,
        `process.exit(0);`
      ].join("\n");

      const debut = Date.now();
      const resultat = await spawnCli(process.execPath, ["-e", script], {
        input: "",
        timeoutMs: 30_000,
        killGraceMs: 100
      });
      const ecoule = Date.now() - debut;

      expect(resultat.status).toBe(0);
      expect(resultat.timedOut).toBe(false);
      // La sortie doit etre COMPLETE : regler plus tot ne vaut rien si cela
      // tronque ce que la CLI a ecrit.
      expect(resultat.stdout).toContain("sortie-complete");
      // Le petit-fils vit quatre secondes. Passer sous ce seuil prouve que le
      // reglage ne l attend pas.
      expect(ecoule).toBeLessThan(2_500);
    },
    20_000
  );

  it("ne retarde pas un lancement normal", async () => {
    const debut = Date.now();
    const resultat = await spawnCli(
      process.execPath,
      ["-e", `process.stdout.write("ok")`],
      { input: "", timeoutMs: 5_000 }
    );

    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toBe("ok");
    expect(resultat.timedOut).toBe(false);
    // Le reglage par silence ne doit JAMAIS s appliquer quand `close` arrive :
    // sinon chaque generation paierait une seconde de plus.
    expect(Date.now() - debut).toBeLessThan(1_000);
  });
});

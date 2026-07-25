/* global window, document, getComputedStyle */
/**
 * Captures des ecrans, en theme clair ET en theme sombre.
 *
 * Ce script ne rend aucun verdict. Il produit ce qu aucune porte automatique ne
 * remplace : une image a regarder. Sur ce projet, trois correctifs de mise en
 * page ont ete annonces comme faits alors qu ils ne l etaient pas, parce que le
 * verdict avait ete rendu par lecture du CSS ; et les tests de rendu ne peuvent
 * pas combler ce trou, jsdom n applique aucune feuille de style et n evalue pas
 * `:focus-within`.
 *
 * Les deux themes sont captures parce que les consignes l exigent et parce que
 * la palette porte deux roles par accent : `--primary-fill` est une surface,
 * `--primary-ink` est une encre. Les intervertir ne casse qu UN des deux
 * themes, donc deduire l un de l autre ne prouve rien.
 *
 * Sortie : `dist-captures/<ecran>-<theme>.png`.
 *
 * Usage : npm run captures
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron } from "playwright";

const LARGEUR = 1400;
const HAUTEUR = 900;
const SORTIE = join(process.cwd(), "dist-captures");

/**
 * Ecrans captures, dans l ordre de la barre laterale.
 *
 * `onglet` nomme un onglet a ouvrir apres la navigation. Sans lui, ce script ne
 * pouvait STRUCTURELLEMENT montrer que le premier onglet de chaque ecran :
 * l ecran Creer en a trois, et deux d entre eux n avaient jamais ete regardes,
 * alors que le rapport annoncait « cinq ecrans dans les deux themes ». Une
 * couverture surestimee est la meme maladie que les portes qui ne mesurent rien.
 */
const ECRANS = [
  { nom: "cockpit", route: "#/" },
  { nom: "creer", route: "#/creer" },
  { nom: "creer-veille", route: "#/creer", onglet: "Transformer une veille" },
  { nom: "creer-strategie", route: "#/creer", onglet: "Depuis la stratégie" },
  { nom: "strategie", route: "#/strategie" },
  { nom: "bibliotheque", route: "#/bibliotheque" },
  { nom: "parametres", route: "#/parametres" }
];

const maison = mkdtempSync(join(tmpdir(), "ghostwraiter-captures-"));
const espace = join(maison, "workspace");

/*
 * Copie de l espace reel quand il existe : un ecran vide ne montre pas ce qu il
 * y a a voir. L original n est jamais ouvert, Electron ecrit dans la copie.
 */
const espaceReel = join(homedir(), "Library", "Application Support", "ghostwraiter", "workspace");
const surDonneesReelles = existsSync(espaceReel);
if (surDonneesReelles) {
  cpSync(espaceReel, espace, { recursive: true });
}

mkdirSync(SORTIE, { recursive: true });

const app = await electron.launch({
  args: ["dist-electron/main/index.js"],
  env: {
    ...process.env,
    LINKEDIN_POSTER_WORKSPACE_ROOT: espace
  }
});

const page = await app.firstWindow();
page.setDefaultTimeout(30000);
await page.setViewportSize({ width: LARGEUR, height: HAUTEUR });
await page.waitForTimeout(2500);

const produites = [];

try {
  // La visite guidee s ouvre sur un espace vierge et son voile couvre l ecran.
  const fermer = page.getByRole("button", { name: /Fermer|Terminer|Passer/i });
  if (await fermer.first().isVisible().catch(() => false)) {
    await fermer.first().click();
    await page.waitForTimeout(500);
  }

  const fonds = {};

  for (const theme of ["light", "dark"]) {
    /*
     * Le theme est pose sur `documentElement`, comme le fait `theme.ts`. On ne
     * passe pas par la bascule de l interface : elle persiste la preference
     * dans la base, et une capture ne doit pas laisser de trace derriere elle,
     * meme dans une copie. Ce que la capture montre reste le rendu reel, c est
     * le meme attribut qui pilote la palette.
     */
    await page.evaluate((valeur) => {
      document.documentElement.setAttribute("data-theme", valeur);
    }, theme);

    /*
     * Le fond est releve DANS la boucle, pas apres les deux.
     *
     * La version precedente lisait le temoin une seule fois, a la fin : il ne
     * pouvait donc decrire que la derniere passe, et le rapport aurait affiche
     * exactement la meme chose si les cinq captures « clair » avaient ete
     * rendues en sombre. Un temoin qui ne peut designer qu un seul des deux
     * etats qu il pretend distinguer ne distingue rien.
     */
    fonds[theme] = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      fond: getComputedStyle(document.body).backgroundColor
    }));

    for (const ecran of ECRANS) {
      await page.evaluate((route) => {
        window.location.hash = route;
      }, ecran.route);
      await page.waitForTimeout(900);

      if (ecran.onglet) {
        const onglet = page.getByRole("tab", { name: ecran.onglet });
        if ((await onglet.count()) === 0) {
          throw new Error(`Onglet introuvable : ${ecran.onglet}`);
        }
        await onglet.first().click();
        await page.waitForTimeout(500);
      }

      const chemin = join(SORTIE, `${ecran.nom}-${theme}.png`);
      await page.screenshot({ path: chemin });
      produites.push(chemin);
    }
  }

  // Deux themes qui rendent le meme fond signifient qu un des deux n a pas
  // pris. Les images se ressembleraient sans que rien ne le dise.
  if (fonds.light.fond === fonds.dark.fond) {
    throw new Error(
      `Les deux themes rendent le meme fond (${fonds.light.fond}) : la bascule n a pas pris.`
    );
  }

  const rapport = {
    donnees: surDonneesReelles ? "copie de l espace reel" : "espace vierge",
    viewport: `${LARGEUR}x${HAUTEUR}`,
    fonds,
    captures: produites
  };
  writeFileSync(join(SORTIE, "rapport.json"), `${JSON.stringify(rapport, null, 2)}\n`);

  console.log(`${produites.length} captures dans ${SORTIE}`);
  console.log(`donnees : ${rapport.donnees}`);
  console.log(`fond clair ${fonds.light.fond}, fond sombre ${fonds.dark.fond}`);
} finally {
  await app.close();
  // La copie porte l espace de travail REEL. La laisser derriere soi depose les
  // donnees personnelles du proprietaire dans un repertoire temporaire du
  // systeme, a chaque execution.
  rmSync(maison, { recursive: true, force: true });
}

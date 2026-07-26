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

/*
 * Le dossier de sortie est PURGE avant d ecrire.
 *
 * `mkdirSync` seul laissait les images du run precedent. Le garde de bascule de
 * theme, plus bas, leve APRES l ecriture des captures et AVANT celle du
 * rapport : un run rate laissait donc quatorze images fraiches d une passe
 * cassee a cote d un `rapport.json` perime, qui annonce les deux fonds d une
 * execution qui n existe plus. Quelqu un ouvre le dossier et juge des images
 * sur un temoin qui decrit autre chose. Le meme piege vaut pour une liste
 * d ecrans qui se reduit : les PNG de l ancien ecran survivaient.
 */
rmSync(SORTIE, { recursive: true, force: true });
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

    /*
     * Le fond est releve APRES les captures de la passe, jamais avant.
     *
     * Premiere version : un seul releve, apres les deux boucles. Il ne pouvait
     * decrire que la derniere passe. Deuxieme version : un releve par passe,
     * mais pose dans le meme tick que le `setAttribute`, donc AVANT les sept
     * navigations qu il est cense certifier. Il attestait l instant qui precede
     * tout ce qu il couvre.
     *
     * Le mecanisme qui rendait cela concret existe : `app/renderer/src/app/
     * theme.ts` arme un ecouteur `matchMedia` persistant quand la preference
     * vaut `system`, qui est le defaut, et `App.tsx` appelle `applyTheme` dans
     * un `.then()`. Une resolution de cette promesse posterieure au
     * `setAttribute` de ce script reecrit l attribut, et les sept captures
     * sortent dans l autre theme. Releve apres coup, le temoin voit ce que les
     * images ont vu.
     */
    fonds[theme] = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      fond: getComputedStyle(document.body).backgroundColor
    }));

    // Le theme demande doit etre celui qui a survecu aux navigations.
    if (fonds[theme].theme !== theme) {
      throw new Error(
        `Theme demande « ${theme} », theme rendu « ${fonds[theme].theme} » apres les captures : l attribut n a pas tenu.`
      );
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

/* global window, document, getComputedStyle */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron } from "playwright";

/**
 * Portes de recette geometriques de la direction visuelle.
 *
 * Sur ce projet, trois correctifs de mise en page ont ete annonces comme faits
 * alors qu ils ne l etaient pas, parce que le verdict avait ete rendu en lisant
 * le CSS. Une regle peut etre presente, syntaxiquement correcte, et pourtant
 * sans effet : `grid-row: 1 / -1` est inerte dans une grille implicite, un fond
 * translucide masque un cadre de focus, une specificite plus forte gagne
 * ailleurs dans la feuille. Rien de tout cela ne se voit a la lecture.
 *
 * Ce script mesure. Chaque porte est une assertion sur une valeur relevee dans
 * le rendu reel, pas sur une intention.
 *
 * Usage : npm run build puis node scripts/audit-geometrie.mjs
 */

const LARGEUR = 1400;
const HAUTEUR = 900;

const resultats = [];

function porte(nom, attendu, obtenu, passe) {
  resultats.push({ nom, attendu, obtenu, passe });
}

const maison = mkdtempSync(join(tmpdir(), "ghostwraiter-geometrie-"));

const app = await electron.launch({
  args: ["dist-electron/main/index.js"],
  env: {
    ...process.env,
    LINKEDIN_POSTER_WORKSPACE_ROOT: join(maison, "workspace")
  }
});

const page = await app.firstWindow();
page.setDefaultTimeout(30000);
await page.setViewportSize({ width: LARGEUR, height: HAUTEUR });
await page.waitForTimeout(2500);

try {
  // La visite guidee s ouvre automatiquement sur un espace vierge et son voile
  // intercepte tous les clics. On la ferme avant de mesurer.
  const fermer = page.getByRole("button", { name: /Fermer|Terminer|Passer/i });
  if (await fermer.first().isVisible().catch(() => false)) {
    await fermer.first().click();
    await page.waitForTimeout(400);
  }

  // ---- Porte 1 : la fenetre ne defile jamais.
  // C est la propriete structurelle dont decoule tout le reste. Si le document
  // peut defiler, l en-tete peut sortir de l ecran, quelle que soit la regle
  // qui pretend l en empecher.
  const defilementDocument = await page.evaluate(() => ({
    hauteurDocument: document.documentElement.scrollHeight,
    hauteurFenetre: window.innerHeight,
    hauteurCorps: document.body.scrollHeight
  }));
  porte(
    "La fenetre ne defile pas",
    "scrollHeight du document <= innerHeight",
    `${defilementDocument.hauteurDocument} contre ${defilementDocument.hauteurFenetre}`,
    defilementDocument.hauteurDocument <= defilementDocument.hauteurFenetre + 1
  );

  // ---- Porte 2 : la barre laterale fait 232px.
  const largeurBarre = await page
    .locator(".sidebar")
    .evaluate((n) => n.getBoundingClientRect().width);
  porte("Largeur de la barre laterale", "232 px", `${largeurBarre} px`, Math.round(largeurBarre) === 232);

  // ---- Porte 3 : l en-tete de page reste en haut apres defilement du corps.
  // Le defaut a ete signale trois fois : « le haut de l app n est plus visible
  // quand on change d ecran ». On defile le corps au maximum, puis on verifie
  // que la barre n a pas bouge d un pixel.
  async function enTeteFixe(chemin, nom) {
    await page.evaluate((c) => {
      window.location.hash = c;
    }, chemin);
    await page.waitForTimeout(900);

    const barre = page.locator(".page__bar");
    if ((await barre.count()) === 0) {
      porte(`En-tete fixe sur ${nom}`, "une barre .page__bar", "aucune barre trouvee", false);
      return;
    }

    const avant = await barre.evaluate((n) => n.getBoundingClientRect().top);
    const releve = await page.evaluate(() => {
      const corps = document.querySelector(".page__body");
      if (!corps) return null;
      corps.scrollTop = 0;
      corps.scrollTop = 999_999;
      const atteint = corps.scrollTop;
      return {
        atteint,
        debordant: corps.scrollHeight > corps.clientHeight + 1,
        hauteurPage: Math.round(
          document.querySelector(".page")?.getBoundingClientRect().height ?? 0
        ),
        hauteurFenetre: window.innerHeight
      };
    });
    await page.waitForTimeout(200);
    const apres = await barre.evaluate((n) => n.getBoundingClientRect().top);

    porte(
      `En-tete fixe sur ${nom}`,
      "position inchangee apres defilement",
      `${avant} px puis ${apres} px`,
      Math.abs(avant - apres) < 1
    );

    // Porte anti-tautologie. La verification ci-dessus poussait `scrollTop` au
    // maximum puis constatait que l en-tete n avait pas bouge. Quand RIEN ne
    // defile, `scrollTop` reste a zero et l en-tete aussi : elle passait sans
    // rien prouver. Elle a effectivement laisse passer un ecran Parametres dont
    // le bas etait inatteignable, signale par le proprietaire.
    //
    // La cause etait `min-height: auto` sur `.page` : un enfant de conteneur
    // flex refuse de se reduire sous la hauteur de son contenu, donc `flex: 1`
    // ne le borne pas. `.page` faisait 2 538 px dans un parent de 900, et le
    // corps heritait de toute la hauteur du contenu. On mesure donc les deux
    // faits qui l auraient revele.
    if (releve) {
      porte(
        `Hauteur de page bornee sur ${nom}`,
        "<= hauteur de la fenetre",
        `${releve.hauteurPage} px sur ${releve.hauteurFenetre} px`,
        releve.hauteurPage <= releve.hauteurFenetre + 1
      );

      if (releve.debordant) {
        porte(
          `Defilement effectif sur ${nom}`,
          "contenu debordant, donc scrollTop > 0",
          `${Math.round(releve.atteint)} px atteints`,
          releve.atteint > 0
        );
      }
    }
  }

  await enTeteFixe("#/", "Cockpit");
  await enTeteFixe("#/strategie", "Strategie");
  await enTeteFixe("#/creer", "Creer");
  await enTeteFixe("#/bibliotheque", "Bibliotheque");
  await enTeteFixe("#/parametres", "Parametres");

  // ---- Porte 4 : densite de l onglet Profil de la Strategie, aides repliees.
  //
  // Attention au perimetre de la mesure, il a deja fait rendre un faux verdict.
  // La maquette annonce « 304 px replie, contre 1 040 px aujourd hui, seuil de
  // recette 340 px » en decrivant ce bloc comme « quatre champs », et elle
  // place l indicateur de completude EN DEHORS, sous la surface. Le seuil de
  // 340 porte donc sur la seule surface des champs.
  //
  // Sa propre geometrie le confirme : quatre rangees de 60, 60, 96 et 96 px
  // plus trois filets font 315 px, pas 304. Le chiffre annonce etait un peu
  // optimiste. Mesurer l onglet entier contre ce seuil revient a comparer le
  // tout a une valeur etablie sur la partie, et fait echouer une composition
  // pourtant conforme au dessin.
  //
  // On mesure donc les deux, chacun contre le bon repere.
  await page.evaluate(() => {
    window.location.hash = "#/strategie";
  });
  await page.waitForTimeout(900);
  const profil = await page.evaluate(() => {
    const section = document.querySelector(".strategy-section");
    if (!section) return null;
    const surface = section.querySelector(".strategy-surface");
    return {
      section: Math.round(section.getBoundingClientRect().height),
      surface: surface ? Math.round(surface.getBoundingClientRect().height) : null
    };
  });
  if (profil && profil.surface !== null) {
    porte(
      "Densite des champs du Profil, aides repliees",
      "<= 340 px, seuil de recette de la maquette",
      `${profil.surface} px`,
      profil.surface <= 340
    );
    // Garde-fou de non-regression sur l onglet complet. La maquette, indicateur
    // de completude compris, tient dans 401 px ; on s autorise la meme chose a
    // vingt pixels pres. Depart de 1 040 px.
    porte(
      "Onglet Profil complet, indicateur compris",
      "<= 420 px",
      `${profil.section} px`,
      profil.section <= 420
    );
  } else {
    porte("Densite des champs du Profil", "<= 340 px", "conteneur introuvable", false);
  }

  // ---- Porte 5 : sur Creer, l action primaire est atteignable sans defiler.
  await page.evaluate(() => {
    window.location.hash = "#/creer";
  });
  await page.waitForTimeout(900);
  const actionVisible = await page.evaluate((hauteur) => {
    const boutons = Array.from(
      document.querySelectorAll('.ds-button[data-variant="primary"]')
    );
    if (boutons.length === 0) return null;
    const rects = boutons.map((b) => b.getBoundingClientRect());
    const dansLePli = rects.filter((r) => r.bottom <= hauteur && r.top >= 0);
    return {
      total: boutons.length,
      dansLePli: dansLePli.length,
      basLePlusHaut: Math.round(Math.min(...rects.map((r) => r.bottom)))
    };
  }, HAUTEUR);
  if (actionVisible) {
    porte(
      "Action primaire de Creer sous le pli",
      "au moins une action primaire visible sans defiler",
      `${actionVisible.dansLePli} sur ${actionVisible.total}, bas a ${actionVisible.basLePlusHaut} px`,
      actionVisible.dansLePli >= 1
    );
  } else {
    porte("Action primaire de Creer", "au moins une", "aucun bouton primaire", false);
  }

  // ---- Porte 6 : aucune ombre portee sur les cartes.
  // La direction delimite par un trait. Une ombre residuelle signale une regle
  // heritee qui a survecu au remplacement des jetons.
  const ombres = await page.evaluate(() => {
    const noeuds = Array.from(document.querySelectorAll(".ds-card, .panel"));
    return noeuds
      .map((n) => getComputedStyle(n).boxShadow)
      .filter((v) => v && v !== "none").length;
  });
  porte("Cartes sans ombre portee", "0 carte avec box-shadow", `${ombres} carte(s)`, ombres === 0);

  // ---- Porte 7 : le theme sombre rend une surface reellement sombre.
  // Verifie que la bascule agit sur les jetons de palette et pas seulement sur
  // un sous-ensemble de regles.
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await page.waitForTimeout(300);
  const sombre = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      app: style.getPropertyValue("--surface-app").trim(),
      encre: style.getPropertyValue("--ink").trim(),
      fondBarre: getComputedStyle(document.querySelector(".sidebar")).backgroundColor
    };
  });
  porte(
    "Le theme sombre atteint la barre laterale",
    "fond sombre",
    `--surface-app ${sombre.app}, barre ${sombre.fondBarre}`,
    sombre.app === "#0d1117" && !sombre.fondBarre.includes("255, 255, 255")
  );
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });
} finally {
  await app.close();
}

let echecs = 0;
const large = Math.max(...resultats.map((r) => r.nom.length));
for (const r of resultats) {
  if (!r.passe) echecs += 1;
  console.log(
    `${r.passe ? "  ok" : "ECHEC"}  ${r.nom.padEnd(large)}  attendu ${r.attendu}  obtenu ${r.obtenu}`
  );
}
console.log(`\n${resultats.length - echecs} portes tenues sur ${resultats.length}.`);
process.exit(echecs > 0 ? 1 : 0);

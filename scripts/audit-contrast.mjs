#!/usr/bin/env node
/**
 * Verificateur de contraste WCAG AA sur la palette de la direction visuelle.
 *
 * Le brief pose le contraste AA comme contrainte ferme sur les DEUX themes. Une
 * maquette produite par un outil de conception n offre aucune garantie de ce
 * cote : elle est dessinee, pas mesuree. Ce script enumere les paires
 * reellement employees par l application et calcule leur ratio, pour que la
 * contrainte soit tenue par une mesure plutot que par une intention.
 *
 * CE QUI A CHANGE, ET POURQUOI.
 *
 * Ce script portait une COPIE en dur des jetons de palette. `palette.css` le
 * designe nommement comme l autorite du contraste, et il certifiait sa propre
 * copie. La mutation qui l a revele : `--ink-subtle` passe de `#616a76` a
 * `#9aa3ad`, soit 2,4:1 sur blanc, tres au-dessous des 4,5:1 exiges. Le script
 * imprimait toujours « 54 paires conformes sur 54, 0 en echec » et sortait
 * en 0. Une porte qui mesure une copie ne mesure rien : elle atteste de l etat
 * du fichier au jour ou quelqu un l a recopie.
 *
 * Les jetons sont desormais LUS dans `palette.css`, et les paires nomment les
 * proprietes CSS reelles plutot que des abreviations locales : un jeton renomme
 * n est plus silencieusement absent, il fait tomber la porte.
 *
 * Usage : node scripts/audit-contrast.mjs
 * Sortie : tableau des paires, code de sortie 1 si une paire obligatoire echoue.
 */

import { readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";

const repoRoot = resolvePath(new URL("..", import.meta.url).pathname);
const designSystem = join(repoRoot, "app", "renderer", "src", "design-system");
const cheminPalette = join(designSystem, "palette.css");
const cheminTokens = join(designSystem, "tokens.css");

/**
 * Extrait les declarations `--jeton: #hex;` d un bloc de `palette.css`.
 *
 * Le bloc est delimite par son selecteur et la premiere accolade fermante en
 * debut de ligne : la feuille n imbrique aucune regle dans ces deux blocs.
 */
function lireBloc(source, selecteur) {
  const debut = source.indexOf(selecteur);

  if (debut === -1) {
    return null;
  }

  const ouvrante = source.indexOf("{", debut);
  const fermante = source.indexOf("\n}", ouvrante);

  if (ouvrante === -1 || fermante === -1) {
    return null;
  }

  const corps = source.slice(ouvrante + 1, fermante);
  const jetons = {};

  for (const [, nom, valeur] of corps.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    jetons[nom] = valeur.toLowerCase();
  }

  return jetons;
}

/**
 * Jetons de palette que compose l anneau de focus, lus dans `tokens.css`.
 *
 * POURQUOI CE SCRIPT LIT UN SECOND FICHIER. L anneau de focus vit dans
 * `tokens.css`, pas dans `palette.css` : il COMPOSE un jeton de palette
 * (`--focus-ring: 0 0 0 3px var(--primary-ink)`). Une paire qui nommerait
 * `primary-ink` en dur serait exactement le defaut que ce script vient de
 * corriger, un cran plus loin : rebasculer l anneau sur `--primary-tint` dans
 * `tokens.css` ne la ferait pas tomber, puisqu elle ne regarde pas ce fichier.
 * Elle mesurerait un jeton que l anneau n emploie plus.
 *
 * On resout donc la reference : le script decouvre QUEL jeton l anneau emploie,
 * puis mesure celui-la. Changer l anneau change ce que la porte mesure.
 *
 * L enjeu n est pas theorique. `--focus-ring` a porte `--primary-tint`, soit
 * 1,14:1 dans les deux themes, pendant que `styles.css` posait `outline: none`
 * sur tous les interactifs : tabuler ne produisait aucun signal perceptible
 * nulle part dans l application, et ce script annoncait 54 paires conformes
 * sur 54. Il n avait pas menti, il n avait pas regarde.
 */
function jetonsDeLAnneau(source) {
  const references = new Set();

  for (const [, declaration] of source.matchAll(/--focus-ring\s*:\s*([^;]+);/g)) {
    for (const [, jeton] of declaration.matchAll(/var\(\s*--([a-z0-9-]+)\s*\)/g)) {
      references.add(jeton);
    }
  }

  return [...references];
}

const sourcePalette = readFileSync(cheminPalette, "utf8");
const sourceTokens = readFileSync(cheminTokens, "utf8");
const CLAIR = lireBloc(sourcePalette, ":root {");
const SOMBRE = lireBloc(sourcePalette, ':root[data-theme="dark"]');
const ANNEAU = jetonsDeLAnneau(sourceTokens);

/**
 * Paires reellement employees par l application, nommees par leurs jetons CSS.
 *
 * `grand` marque le texte >= 18.66px gras ou >= 24px, seuil AA 3:1 au lieu de
 * 4.5:1. `role` distingue le texte de l element d interface non textuel, dont
 * le seuil AA est 3:1 (bordures de champ, barres de progression).
 */
const PAIRES = [
  // Texte courant
  { avant: "ink", arriere: "surface-app", quoi: "Texte principal sur fond d application" },
  { avant: "ink", arriere: "surface-raised", quoi: "Texte principal sur surface" },
  { avant: "ink", arriere: "surface-sunken", quoi: "Texte principal sur surface creusee" },
  { avant: "ink-muted", arriere: "surface-app", quoi: "Texte secondaire sur fond" },
  { avant: "ink-muted", arriere: "surface-raised", quoi: "Texte secondaire sur surface" },
  { avant: "ink-muted", arriere: "surface-sunken", quoi: "Texte secondaire sur surface creusee" },
  { avant: "ink-subtle", arriere: "surface-raised", quoi: "Texte tertiaire sur surface, 11 px" },
  { avant: "ink-subtle", arriere: "surface-sunken", quoi: "Texte tertiaire sur surface creusee" },
  { avant: "ink-subtle", arriere: "surface-app", quoi: "Texte tertiaire sur fond" },

  // Primaire
  { avant: "on-fill", arriere: "primary-fill", quoi: "Libelle de bouton primaire" },
  { avant: "primary-ink", arriere: "surface-raised", quoi: "Lien et mot-symbole sur surface" },
  { avant: "primary-ink", arriere: "primary-tint", quoi: "Texte primaire sur teinte primaire" },
  { avant: "ink", arriere: "primary-tint", quoi: "Titre du bloc Prochaine action" },
  { avant: "ink-muted", arriere: "primary-tint", quoi: "Corps du bloc Prochaine action" },
  { avant: "primary-fill", arriere: "surface-raised", quoi: "Bordure active de champ", role: "ui" },

  // Ambre
  { avant: "amber-ink", arriere: "amber-tint", quoi: "Texte d alerte sur teinte ambre" },
  { avant: "amber-ink", arriere: "surface-raised", quoi: "Mention jamais relu sur surface" },
  { avant: "amber-ink", arriere: "surface-app", quoi: "Mention ambre sur fond" },
  { avant: "ink", arriere: "amber-tint", quoi: "Titre de phase en cours" },
  { avant: "amber-fill", arriere: "surface-raised", quoi: "Soulignement de marqueur IA", role: "ui" },
  { avant: "amber-fill", arriere: "amber-tint", quoi: "Reglette de progression", role: "ui" },

  // Etats
  { avant: "state-ok", arriere: "surface-raised", quoi: "Coche d onglet complete", role: "ui" },
  { avant: "state-ko", arriere: "surface-raised", quoi: "Libelle Interrompre" },

  /*
   * Texte blanc sur la SURFACE pleine d erreur.
   *
   * `palette.css` distingue `--state-ko`, qui est une ENCRE lisible sur fond
   * clair, de `--state-ko-fill`, qui est une SURFACE portant du texte blanc, et
   * son commentaire precise que les confondre « donne un bouton de suppression
   * rouge pale au libelle blanc illisible, ce qui est arrive une fois deja ».
   * Cette paire manquait a l enumeration : le seul couple dont la feuille dit
   * qu il a DEJA casse etait le seul que la porte ne mesurait pas. En sombre,
   * `--state-ko` vaut #f0796f et ne donne que 1,8:1 avec du blanc, d ou la
   * surface dediee.
   */
  { avant: "on-fill", arriere: "state-ko-fill", quoi: "Libelle blanc sur bouton de suppression" },

  // Bordures de composants interactifs : seul element identifiant le composant,
  // donc soumises au seuil 3:1 de WCAG 1.4.11.
  { avant: "line-field", arriere: "surface-raised", quoi: "Bordure de champ sur surface", role: "ui" },
  { avant: "line-field", arriere: "surface-app", quoi: "Bordure de champ sur fond", role: "ui" },

  // Elements ambre porteurs d information ou de contour interactif. Ajoutes
  // apres coup : le chantier Atelier a mesure ces paires a part et en a trouve
  // deux en echec avec les valeurs de la maquette, hors du champ de ce script.
  // Une porte qui annonce « 50 sur 50 » alors que des paires reelles echouent
  // en dehors de son enumeration ment par omission ; elle doit couvrir ce que
  // l application emploie, pas ce que la maquette dessinait.
  //
  // Sur le contour de bouton, la nuance importe. Ce script exclut plus bas
  // `amber-line sur amber-tint` en tant que bordure de bloc de CONTENU, dont le
  // sens est porte par le texte. Le meme couple employe comme contour de BOUTON
  // est un tout autre cas : le contour y delimite un composant interactif, et
  // rien d autre ne le delimite. D ou le passage a `amber-fill`.
  {
    avant: "amber-fill",
    arriere: "surface-raised",
    quoi: "Barre de reglette sur sa piste",
    role: "ui"
  },
  {
    avant: "amber-fill",
    arriere: "amber-tint",
    quoi: "Contour de bouton sur bandeau ambre",
    role: "ui"
  }

  // Volontairement absentes : les bordures des blocs teintes (primary-line sur
  // primary-tint, amber-line sur amber-tint). Ce sont des conteneurs de
  // contenu, pas des composants d interface, et leur sens est porte par le
  // texte qu ils contiennent, non par leur trait. WCAG 1.4.11 ne les vise pas.
  // Les mesurer au seuil 3:1 ferait echouer la direction sur une exigence qui
  // ne s y applique pas, et conduirait a alourdir un trait volontairement
  // discret.
];

function canal(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = hex.replace("#", "");
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/*
 * Gardes de la MESURE, avant toute conclusion sur les ratios.
 *
 * Lire un fichier deplace le point de defaillance silencieuse : un selecteur
 * change, une expression rationnelle qui ne rend plus rien, et le script
 * mesurerait zero paire en annoncant « 0 paires conformes sur 0 » avec un code
 * de sortie 0. Ces gardes echouent bruyamment plutot que de laisser passer un
 * vert vide.
 */
/*
 * Paires de l anneau de focus, construites depuis la reference resolue.
 *
 * Role `ui`, seuil 3:1 : `styles.css` remplace le contour natif par cette
 * ombre, elle est donc le SEUL indicateur de focus de l application et tombe
 * sous WCAG 1.4.11. Les deux surfaces sur lesquelles un element focusable peut
 * se poser sont mesurees.
 */
for (const jeton of ANNEAU) {
  PAIRES.push(
    {
      avant: jeton,
      arriere: "surface-raised",
      quoi: "Anneau de focus sur surface",
      role: "ui"
    },
    {
      avant: jeton,
      arriere: "surface-app",
      quoi: "Anneau de focus sur fond d application",
      role: "ui"
    }
  );
}

const problemes = [];

// Les deux feuilles doivent avoir ete LUES. Sans cette garde, remplacer une
// copie en dur par une lecture de fichier deplace simplement le vert vide :
// un chemin qui rend une chaine vide donnerait zero jeton, zero paire, et un
// « 0 conforme sur 0 » avec un code de sortie 0.
if (sourcePalette.trim().length === 0) {
  problemes.push(`${cheminPalette} est vide`);
}

if (sourceTokens.trim().length === 0) {
  problemes.push(`${cheminTokens} est vide`);
}

if (ANNEAU.length === 0) {
  problemes.push(
    `aucune declaration \`--focus-ring: ... var(--jeton)\` trouvee dans ${cheminTokens} : l anneau de focus ne serait plus mesure`
  );
}

if (!CLAIR || Object.keys(CLAIR).length === 0) {
  problemes.push(`bloc :root introuvable ou vide dans ${cheminPalette}`);
}

if (!SOMBRE || Object.keys(SOMBRE).length === 0) {
  problemes.push(`bloc :root[data-theme="dark"] introuvable ou vide dans ${cheminPalette}`);
}

if (problemes.length === 0) {
  const nomsClairs = Object.keys(CLAIR).sort();
  const nomsSombres = Object.keys(SOMBRE).sort();

  if (nomsClairs.length < 20) {
    problemes.push(
      `seulement ${nomsClairs.length} jetons lus en theme clair, 20 au minimum attendus`
    );
  }

  if (nomsClairs.join(",") !== nomsSombres.join(",")) {
    const manquants = nomsClairs.filter((n) => !nomsSombres.includes(n));
    const surplus = nomsSombres.filter((n) => !nomsClairs.includes(n));
    problemes.push(
      `les deux themes ne declarent pas les memes jetons (absents du sombre : ${
        manquants.join(" ") || "aucun"
      } ; absents du clair : ${surplus.join(" ") || "aucun"})`
    );
  }

  for (const paire of PAIRES) {
    for (const [nomTheme, theme] of [
      ["clair", CLAIR],
      ["sombre", SOMBRE]
    ]) {
      for (const jeton of [paire.avant, paire.arriere]) {
        if (!theme[jeton]) {
          problemes.push(`jeton --${jeton} absent du theme ${nomTheme}, paire « ${paire.quoi} »`);
        }
      }
    }
  }
}

if (problemes.length > 0) {
  console.log("La palette n a pas pu etre mesuree :\n");
  for (const probleme of problemes) {
    console.log(`ECHEC  ${probleme}`);
  }
  console.log(`\n0 paire mesuree, ${problemes.length} probleme(s) de lecture.`);
  process.exit(1);
}

let echecs = 0;
const lignes = [];

for (const [nomTheme, theme] of [
  ["clair", CLAIR],
  ["sombre", SOMBRE]
]) {
  for (const paire of PAIRES) {
    const seuil = paire.role === "ui" ? 3 : paire.grand ? 3 : 4.5;
    const r = ratio(theme[paire.avant], theme[paire.arriere]);
    const passe = r >= seuil;
    if (!passe) echecs += 1;
    lignes.push({
      theme: nomTheme,
      paire: `${paire.avant} sur ${paire.arriere}`,
      quoi: paire.quoi,
      ratio: r,
      seuil,
      passe
    });
  }
}

// Le compte attendu est derive de l enumeration, jamais ecrit a la main : une
// paire ajoutee sans mesure correspondante ferait tomber cette garde.
const attendues = PAIRES.length * 2;

if (lignes.length !== attendues) {
  console.log(`ECHEC  ${lignes.length} mesures produites, ${attendues} attendues.`);
  process.exit(1);
}

const large = Math.max(...lignes.map((l) => l.quoi.length));
const largePaire = Math.max(...lignes.map((l) => l.paire.length));

for (const l of lignes) {
  const marque = l.passe ? "  ok" : "ECHEC";
  console.log(
    `${marque}  ${l.theme.padEnd(6)} ${l.quoi.padEnd(large)}  ${l.paire.padEnd(largePaire)} ${l.ratio.toFixed(2)}:1  seuil ${l.seuil}`
  );
}

console.log(
  `\nPalette lue dans ${cheminPalette.replace(`${repoRoot}/`, "")}, ${
    Object.keys(CLAIR).length
  } jetons par theme.`
);
console.log(
  `Anneau de focus resolu depuis ${cheminTokens.replace(`${repoRoot}/`, "")} : ${ANNEAU.map(
    (j) => `--${j}`
  ).join(", ")}.`
);
console.log(`${lignes.length - echecs} paires conformes sur ${lignes.length}, ${echecs} en echec.`);

process.exit(echecs > 0 ? 1 : 0);

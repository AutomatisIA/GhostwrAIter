/*
 * Porte de contraste de l anneau de focus.
 *
 * Elle existe parce que l anneau est le SEUL indicateur de focus de
 * l application : `styles.css` pose `outline: none` sur tous les interactifs et
 * remplace le contour natif par `box-shadow: var(--focus-ring)`. Un anneau qui
 * ne se voit pas ne degrade pas la navigation au clavier, il la supprime.
 *
 * L anneau est passe une fois de `rgba(10, 102, 194, .45)` a `var(--primary-tint)`,
 * soit de 2,03:1 a 1,14:1 en theme clair et de 3,36:1 a 1,14:1 en sombre, sans
 * qu aucune porte ne bronche : `scripts/audit-contrast.mjs` enumere ses paires a
 * la main et celle-ci n y figurait pas. La regression a vecu jusqu a une
 * relecture a l oeil.
 *
 * Elle LIT les deux feuilles au lieu d en recopier les valeurs : une porte qui
 * garde sa propre copie de la palette continue de passer au vert le jour ou la
 * palette change. Le compositage alpha est implemente pour que le verdict reste
 * juste si l anneau redevient un jour translucide ; une couleur a 45 % ne vaut
 * pas sa valeur nominale, elle vaut ce qu elle donne sur le fond qui la porte.
 *
 * POURQUOI ICI ET NON SOUS `app/renderer`. Ce fichier lit des feuilles sur le
 * disque : c est une porte d outillage, pas un test de rendu, et `node:fs` n a
 * rien a faire dans une arborescence compilee pour le navigateur. Une premiere
 * version tentait `import css from "./palette.css?raw"` pour rester cote
 * renderer : vitest neutralise les imports CSS et rend une chaine VIDE, ce qui
 * donnait une porte verte ne mesurant plus rien. D ou l assertion explicite, en
 * tete des cas, que les sources lues ne sont pas vides.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Seuil WCAG 1.4.11 : composant d interface dont c est le seul identifiant. */
const SEUIL = 3;

const DESIGN_SYSTEM = join(__dirname, "..", "..", "app", "renderer", "src", "design-system");

function lire(fichier: string): string {
  return readFileSync(join(DESIGN_SYSTEM, fichier), "utf8");
}

type Jetons = Record<string, string>;

/**
 * Jetons declares dans un bloc de selecteur donne, toutes feuilles confondues.
 * Le theme sombre ne redeclare que ce qu il change, d ou la fusion clair puis
 * sombre plutot qu une lecture du seul bloc sombre.
 */
function jetons(sources: readonly string[], selecteur: string): Jetons {
  const table: Jetons = {};
  for (const source of sources) {
    // Bloc `<selecteur> { ... }`, ferme par le premier `}` en debut de ligne :
    // les deux feuilles sont plates a ce niveau, aucun jeton n imbrique
    // d accolade.
    const debut = source.indexOf(`${selecteur} {`);
    if (debut === -1) continue;
    const fin = source.indexOf("\n}", debut);
    const bloc = source.slice(debut, fin === -1 ? undefined : fin);
    for (const correspondance of bloc.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      const [, nom, valeur] = correspondance;
      if (nom && valeur) table[nom] = valeur.trim();
    }
  }
  return table;
}

type Rgba = { r: number; g: number; b: number; a: number };

function versRgba(valeur: string, table: Jetons, profondeur = 0): Rgba {
  if (profondeur > 8) throw new Error(`Reference circulaire : ${valeur}`);

  const variable = /^var\((--[\w-]+)\)$/.exec(valeur);
  if (variable) {
    const nom = variable[1];
    const cible = nom ? table[nom] : undefined;
    if (!cible) throw new Error(`Jeton introuvable : ${nom ?? valeur}`);
    return versRgba(cible, table, profondeur + 1);
  }

  const hex = /^#([0-9a-f]{6})$/i.exec(valeur);
  if (hex?.[1]) {
    const n = Number.parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }

  const rgba = /^rgba?\(([^)]+)\)$/i.exec(valeur);
  if (rgba?.[1]) {
    const p = rgba[1].split(",").map((x) => Number(x.trim()));
    const [r, g, b, a] = p;
    if (r === undefined || g === undefined || b === undefined) {
      throw new Error(`Couleur rgb incomplete : ${valeur}`);
    }
    return { r, g, b, a: a ?? 1 };
  }

  throw new Error(`Couleur illisible : ${valeur}`);
}

/** Couleur reellement affichee : l anneau est POSE sur la surface qui l entoure. */
function composer(avant: Rgba, arriere: Rgba): Rgba {
  const m = (x: number, y: number) => avant.a * x + (1 - avant.a) * y;
  return { r: m(avant.r, arriere.r), g: m(avant.g, arriere.g), b: m(avant.b, arriere.b), a: 1 };
}

function luminance({ r, g, b }: Rgba): number {
  const canaux = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const [lr, lg, lb] = canaux;
  return 0.2126 * (lr ?? 0) + 0.7152 * (lg ?? 0) + 0.0722 * (lb ?? 0);
}

function contraste(avant: Rgba, arriere: Rgba): number {
  const a = luminance(composer(avant, arriere));
  const b = luminance(arriere);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Couleur de l anneau, extraite de la valeur complete du jeton.
 * `--focus-ring` est une ombre portee (`0 0 0 3px <couleur>`) : seul le dernier
 * fragment porte la couleur, et il peut contenir des espaces entre parentheses.
 */
function couleurAnneau(valeurBrute: string): string {
  const fragments = valeurBrute.trim().split(/\s+(?![^(]*\))/);
  const derniere = fragments[fragments.length - 1];
  if (!derniere) throw new Error(`Valeur d anneau illisible : ${valeurBrute}`);
  return derniere;
}

const sources = [lire("palette.css"), lire("tokens.css")];
const THEMES: Record<string, Jetons> = {
  clair: jetons(sources, ":root"),
  sombre: { ...jetons(sources, ":root"), ...jetons(sources, ':root[data-theme="dark"]') }
};

/** Les deux surfaces sur lesquelles un anneau se pose reellement. */
const SURFACES = ["--surface-raised", "--surface-app"] as const;

function jeton(table: Jetons, nom: string): string {
  const valeur = table[nom];
  if (!valeur) throw new Error(`Jeton absent des feuilles : ${nom}`);
  return valeur;
}

describe("anneau de focus", () => {
  it("lit bien les deux feuilles et y trouve le jeton", () => {
    // Sans cette assertion, une lecture qui rendrait du vide ferait passer les
    // quatre mesures suivantes en ne mesurant plus rien.
    expect(sources.every((source) => source.length > 0)).toBe(true);
    expect(THEMES.clair?.["--focus-ring"]).toBeTruthy();
    // Les deux themes sont bien lus separement, sinon on mesurerait deux fois
    // le meme.
    expect(THEMES.sombre?.["--primary-ink"]).not.toBe(THEMES.clair?.["--primary-ink"]);
  });

  for (const [nomTheme, table] of Object.entries(THEMES)) {
    for (const surface of SURFACES) {
      it(`atteint ${SEUIL}:1 sur ${surface}, theme ${nomTheme}`, () => {
        const anneau = versRgba(couleurAnneau(jeton(table, "--focus-ring")), table);
        const fond = versRgba(jeton(table, surface), table);
        const mesure = contraste(anneau, fond);

        expect(
          mesure,
          `anneau de focus sur ${surface} en ${nomTheme} : ${mesure.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(SEUIL);
      });
    }
  }
});

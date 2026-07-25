#!/usr/bin/env node
/**
 * Verificateur de contraste WCAG AA sur la palette de la direction visuelle.
 *
 * Le brief pose le contraste AA comme contrainte ferme sur les DEUX themes. Une
 * maquette produite par un outil de conception n offre aucune garantie de ce
 * cote : elle est dessinee, pas mesuree. Ce script enumere les paires
 * reellement employees par la maquette et calcule leur ratio, pour que la
 * contrainte soit tenue par une mesure plutot que par une intention.
 *
 * Usage : node scripts/audit-contrast.mjs
 * Sortie : tableau des paires, code de sortie 1 si une paire obligatoire echoue.
 */

const CLAIR = {
  bg: "#f6f7f9",
  sf: "#ffffff",
  sf2: "#f0f2f5",
  bd: "#e3e6ea",
  bd2: "#cfd5dc",
  ink: "#0f141b",
  ink2: "#414b57",
  ink3: "#616a76",
  pri: "#0a66c2",
  priT: "#0a5aab",
  priTint: "#e9f1fb",
  priBd: "#c3daf5",
  amb: "#c07c07",
  ambT: "#7d5000",
  ambTint: "#fbf1de",
  ambBd: "#ecd9ab",
  ok: "#0f6b45",
  ko: "#b42318",
  lineField: "#858f9d",
  blanc: "#ffffff"
};

const SOMBRE = {
  bg: "#0d1117",
  sf: "#151a21",
  sf2: "#1c222b",
  bd: "#2a3240",
  bd2: "#3a4353",
  ink: "#e7ecf2",
  ink2: "#a9b3c0",
  ink3: "#8b95a3",
  pri: "#1a6fc4",
  priT: "#5aa4ea",
  priTint: "#132639",
  priBd: "#274b6d",
  amb: "#e0a744",
  ambT: "#e6b25c",
  ambTint: "#2a2113",
  ambBd: "#4a3a1c",
  ok: "#4ec08c",
  ko: "#f0796f",
  lineField: "#626d80",
  blanc: "#ffffff"
};

/**
 * Paires reellement employees dans Maquettes.dc.html.
 * `grand` marque le texte >= 18.66px gras ou >= 24px, seuil AA 3:1 au lieu de
 * 4.5:1. `role` distingue le texte de l element d interface non textuel, dont
 * le seuil AA est 3:1 (bordures de champ, barres de progression).
 */
const PAIRES = [
  // Texte courant
  { avant: "ink", arriere: "bg", quoi: "Texte principal sur fond d application" },
  { avant: "ink", arriere: "sf", quoi: "Texte principal sur surface" },
  { avant: "ink", arriere: "sf2", quoi: "Texte principal sur surface creusee" },
  { avant: "ink2", arriere: "bg", quoi: "Texte secondaire sur fond" },
  { avant: "ink2", arriere: "sf", quoi: "Texte secondaire sur surface" },
  { avant: "ink2", arriere: "sf2", quoi: "Texte secondaire sur surface creusee" },
  { avant: "ink3", arriere: "sf", quoi: "Texte tertiaire sur surface, 11 px" },
  { avant: "ink3", arriere: "sf2", quoi: "Texte tertiaire sur surface creusee" },
  { avant: "ink3", arriere: "bg", quoi: "Texte tertiaire sur fond" },

  // Primaire
  { avant: "blanc", arriere: "pri", quoi: "Libelle de bouton primaire" },
  { avant: "priT", arriere: "sf", quoi: "Lien et mot-symbole sur surface" },
  { avant: "priT", arriere: "priTint", quoi: "Texte primaire sur teinte primaire" },
  { avant: "ink", arriere: "priTint", quoi: "Titre du bloc Prochaine action" },
  { avant: "ink2", arriere: "priTint", quoi: "Corps du bloc Prochaine action" },
  { avant: "pri", arriere: "sf", quoi: "Bordure active de champ", role: "ui" },

  // Ambre
  { avant: "ambT", arriere: "ambTint", quoi: "Texte d alerte sur teinte ambre" },
  { avant: "ambT", arriere: "sf", quoi: "Mention jamais relu sur surface" },
  { avant: "ambT", arriere: "bg", quoi: "Mention ambre sur fond" },
  { avant: "ink", arriere: "ambTint", quoi: "Titre de phase en cours" },
  { avant: "amb", arriere: "sf", quoi: "Soulignement de marqueur IA", role: "ui" },
  { avant: "amb", arriere: "ambTint", quoi: "Reglette de progression", role: "ui" },

  // Etats
  { avant: "ok", arriere: "sf", quoi: "Coche d onglet complete", role: "ui" },
  { avant: "ko", arriere: "sf", quoi: "Libelle Interrompre" },

  // Bordures de composants interactifs : seul element identifiant le composant,
  // donc soumises au seuil 3:1 de WCAG 1.4.11.
  { avant: "lineField", arriere: "sf", quoi: "Bordure de champ sur surface", role: "ui" },
  { avant: "lineField", arriere: "bg", quoi: "Bordure de champ sur fond", role: "ui" },

  // Elements ambre porteurs d information ou de contour interactif. Ajoutes
  // apres coup : le chantier Atelier a mesure ces paires a part et en a trouve
  // deux en echec avec les valeurs de la maquette, hors du champ de ce script.
  // Une porte qui annonce « 50 sur 50 » alors que des paires reelles echouent
  // en dehors de son enumeration ment par omission ; elle doit couvrir ce que
  // l application emploie, pas ce que la maquette dessinait.
  //
  // Sur le contour de bouton, la nuance importe. Ce script exclut plus haut
  // `ambBd sur ambTint` en tant que bordure de bloc de CONTENU, dont le sens
  // est porte par le texte. Le meme couple employe comme contour de BOUTON est
  // un tout autre cas : le contour y delimite un composant interactif, et rien
  // d autre ne le delimite. D ou le passage a `amb`.
  {
    avant: "amb",
    arriere: "sf",
    quoi: "Barre de reglette sur sa piste",
    role: "ui"
  },
  {
    avant: "amb",
    arriere: "ambTint",
    quoi: "Contour de bouton sur bandeau ambre",
    role: "ui"
  }

  // Volontairement absentes : les bordures des blocs teintes (priBd sur
  // priTint, ambBd sur ambTint). Ce sont des conteneurs de contenu, pas des
  // composants d interface, et leur sens est porte par le texte qu ils
  // contiennent, non par leur trait. WCAG 1.4.11 ne les vise pas. Les mesurer
  // au seuil 3:1 ferait echouer la direction sur une exigence qui ne s y
  // applique pas, et conduirait a alourdir un trait volontairement discret.
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

const large = Math.max(...lignes.map((l) => l.quoi.length));
for (const l of lignes) {
  const marque = l.passe ? "  ok" : "ECHEC";
  console.log(
    `${marque}  ${l.theme.padEnd(6)} ${l.quoi.padEnd(large)}  ${l.paire.padEnd(20)} ${l.ratio.toFixed(2)}:1  seuil ${l.seuil}`
  );
}

console.log(
  `\n${lignes.length - echecs} paires conformes sur ${lignes.length}, ${echecs} en echec.`
);

process.exit(echecs > 0 ? 1 : 0);

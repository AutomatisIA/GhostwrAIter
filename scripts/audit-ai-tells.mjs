#!/usr/bin/env node
/**
 * Detecteur deterministe de marqueurs d'ecriture IA, adapte au francais
 * et au format LinkedIn.
 *
 * Source des categories : Wikipedia:Signs of AI writing.
 * Seuls les motifs detectables mecaniquement en prose francaise sont retenus.
 * Un motif = un compteur. Aucun jugement subjectif, aucun appel LLM.
 *
 * Usage :
 *   node ai-tells.mjs --db <chemin.db>          analyse la table drafts
 *   node ai-tells.mjs --file <post.txt>         analyse un fichier
 *   node ai-tells.mjs --json                    sortie machine
 */

import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

/** Normalise apostrophes typographiques et espaces insecables. */
const normalize = (text) =>
  text
    .replace(/[’ʼ]/g, "'")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/\r\n/g, "\n");

const sentences = (text) =>
  normalize(text)
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

const paragraphs = (text) =>
  normalize(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

const wordCount = (text) => normalize(text).split(/\s+/).filter(Boolean).length;

/**
 * Chaque detecteur retourne un tableau d'extraits fautifs.
 * severity : poids dans le score global (3 = signature forte, 1 = indice faible).
 */
const DETECTORS = [
  {
    id: "neg-parallel-ce-nest-pas",
    label: "Parallelisme negatif « ce n'est pas X, c'est Y »",
    category: "Parallelisme negatif",
    severity: 3,
    run: (text) =>
      matchAll(
        text,
        /\b(?:ce\s+)?n'est\s+pas\s+[^.!?\n]{3,90}?[.,]\s*(?:c'est|mais)\b[^.!?\n]{0,60}/gi
      )
  },
  {
    id: "neg-parallel-le-probleme",
    label: "Parallelisme negatif « le X n'est pas ... le X c'est »",
    category: "Parallelisme negatif",
    severity: 3,
    run: (text) =>
      matchAll(
        text,
        /\b(?:le|la)\s+(?:vrai\s+|vraie\s+)?(?:probleme|problème|sujet|enjeu|question|debat|débat|point|difficulte|difficulté|frein|risque|piege|piège)\s+n'est\s+pas\b[^.!?\n]{0,90}/gi
      )
  },
  {
    id: "neg-parallel-il-ne-sagit-pas",
    label: "Parallelisme negatif « il ne s'agit pas de ... mais de »",
    category: "Parallelisme negatif",
    severity: 3,
    run: (text) =>
      matchAll(text, /\bil\s+ne\s+s'agit\s+pas\s+(?:de|d')\b[^.!?\n]{0,90}/gi)
  },
  {
    id: "neg-parallel-non-seulement",
    label: "Parallelisme negatif « non seulement ... mais aussi »",
    category: "Parallelisme negatif",
    severity: 3,
    run: (text) =>
      matchAll(
        text,
        /\bnon\s+seulement\b[^.!?\n]{0,90}?\bmais\s+(?:aussi|egalement|également)\b/gi
      )
  },
  {
    id: "neg-parallel-pas-seulement",
    label: "Parallelisme negatif « ne ... pas/plus seulement X, mais Y »",
    category: "Parallelisme negatif",
    severity: 3,
    run: (text) =>
      matchAll(
        text,
        /\bne?\s+\w+\s+(?:pas|plus)\s+(?:seulement|uniquement|juste)\b[^.!?\n]{0,90}?\bmais\b[^.!?\n]{0,50}/gi
      )
  },
  {
    id: "neg-parallel-plutot-que",
    label: "Parallelisme negatif « X plutot que Y »",
    category: "Parallelisme negatif",
    severity: 2,
    run: (text) => matchAll(text, /\bplut[oô]t\s+qu[e']\b[^.!?\n]{0,60}/gi)
  },
  {
    id: "neg-parallel-elliptic",
    label: "Negation elliptique en tete de phrase (« Pas un ... »)",
    category: "Parallelisme negatif",
    severity: 2,
    run: (text) =>
      sentences(text)
        .filter((s) => /^Pas\s+(?:un|une|de|d'|le|la|les|pour|encore|besoin)\b/i.test(s))
        .map((s) => s.slice(0, 80))
  },
  {
    id: "neg-parallel-triplet",
    label: "Triplet de negations consecutives (3 phrases « Pas ... »)",
    category: "Parallelisme negatif",
    severity: 3,
    run: (text) => {
      const seq = sentences(text).map((s) => /^(?:Pas|Ni|Non)\b/i.test(s));
      const hits = [];
      for (let i = 0; i + 2 < seq.length; i += 1) {
        if (seq[i] && seq[i + 1] && seq[i + 2]) {
          hits.push(sentences(text).slice(i, i + 3).join(" / ").slice(0, 100));
        }
      }
      return hits;
    }
  },
  {
    id: "pivot-cest-la-que",
    label: "Pivot dramatique « c'est la que »",
    category: "Formule de pivot",
    severity: 3,
    // Un adverbe peut s intercaler : « c est souvent la que », « c est
    // precisement la que ». Sans cette tolerance le detecteur rate la moitie
    // des occurrences reelles.
    run: (text) =>
      matchAll(text, /\bc'est\s+(?:\w+\s+)?l[aà]\s+que\b[^.!?\n]{0,70}/gi)
  },
  {
    id: "pivot-en-realite",
    label: "Transition molle (« en realite », « au fond », « au final »)",
    category: "Formule de pivot",
    severity: 2,
    run: (text) =>
      matchAll(
        text,
        /\b(?:en\s+realite|en\s+réalité|au\s+fond|au\s+final|en\s+somme|en\s+definitive|en\s+définitive|force\s+est\s+de\s+constater)\b/gi
      )
  },
  {
    id: "pivot-concretement",
    label: "Ouverture de paragraphe « Concretement, »",
    category: "Formule de pivot",
    severity: 2,
    run: (text) =>
      paragraphs(text)
        .filter((p) => /^(?:concretement|concrètement|resultat|résultat|verdict|traduction)\s*[,:]/i.test(p))
        .map((p) => p.slice(0, 60))
  },
  {
    id: "pivot-le-vrai",
    label: "Emphase « le vrai X » / « la vraie X »",
    category: "Formule de pivot",
    severity: 2,
    run: (text) => matchAll(text, /\b(?:le\s+vrai|la\s+vraie|les\s+vrais|les\s+vraies)\s+\w+/gi)
  },
  {
    id: "rule-of-three-adj",
    label: "Regle de trois (enumeration ternaire)",
    category: "Regle de trois",
    severity: 2,
    run: (text) =>
      matchAll(
        text,
        /\b[\wéèêàçôûîï']{4,},\s+[\wéèêàçôûîï']{4,}\s+et\s+[\wéèêàçôûîï']{4,}\b/gi
      )
  },
  {
    id: "rule-of-three-anaphora",
    label: "Anaphore ternaire (3 phrases, meme mot d'attaque)",
    category: "Regle de trois",
    severity: 2,
    run: (text) => {
      const heads = sentences(text).map((s) => (s.match(/^([\wéèêàçôûîï']+)/) ?? [])[1]?.toLowerCase());
      const hits = [];
      for (let i = 0; i + 2 < heads.length; i += 1) {
        if (heads[i] && heads[i] === heads[i + 1] && heads[i] === heads[i + 2]) {
          hits.push(`${heads[i]} x3`);
        }
      }
      return hits;
    }
  },
  {
    id: "vocab-ai-fr",
    label: "Vocabulaire IA (crucial, essentiel, cle, veritable...)",
    category: "Vocabulaire",
    severity: 1,
    run: (text) =>
      matchAll(
        text,
        /\b(?:crucial(?:e|es|aux)?|essentiel(?:le|s|les)?|incontournable(?:s)?|indispensable(?:s)?|veritable(?:s)?|véritable(?:s)?|profondement|profondément|revolutionn|révolutionn|a\s+l'ere\s+de|à\s+l'ère\s+de|dans\s+un\s+monde\s+ou|dans\s+un\s+monde\s+où|il\s+est\s+important\s+de|notons\s+que|soulign(?:e|ant|er))\w*/gi
      )
  },
  {
    id: "vague-authority",
    label: "Autorite vague (« beaucoup pensent », « on entend souvent »)",
    category: "Attribution vague",
    severity: 2,
    run: (text) =>
      matchAll(
        text,
        /\b(?:beaucoup\s+(?:pensent|croient|se\s+trompent|confondent)|on\s+(?:entend|lit|voit|parle)\s+(?:souvent|beaucoup)|certains\s+(?:disent|pensent)|les\s+experts?\s+\w+|tout\s+le\s+monde\s+\w+)/gi
      )
  },
  {
    id: "struct-oneline-stack",
    label: "Empilement de paragraphes d'une ligne",
    category: "Structure",
    severity: 2,
    run: (text) => {
      const paras = paragraphs(text);
      if (paras.length < 4) return [];
      const short = paras.filter((p) => wordCount(p) <= 12 && sentences(p).length <= 1);
      const ratio = short.length / paras.length;
      return ratio >= 0.4
        ? [`${short.length}/${paras.length} paragraphes = ${Math.round(ratio * 100)}% de lignes seches`]
        : [];
    }
  },
  {
    id: "struct-bullet-heavy",
    label: "Liste a puces dans un post court",
    category: "Structure",
    severity: 1,
    run: (text) => {
      const bullets = matchAll(text, /^\s*[-*•–]\s+\S/gim);
      return bullets.length >= 3 ? [`${bullets.length} puces`] : [];
    }
  },
  {
    id: "typo-emdash",
    label: "Cadratins (em-dash)",
    category: "Typographie",
    severity: 2,
    run: (text) => matchAll(text, /—/g)
  },
  {
    id: "typo-emoji",
    label: "Emoji",
    category: "Typographie",
    severity: 1,
    run: (text) =>
      matchAll(text, /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/gu)
  },
  {
    id: "typo-bold-headers",
    label: "Puces a en-tete en gras",
    category: "Typographie",
    severity: 2,
    run: (text) => matchAll(text, /^\s*[-*•]\s*\*\*[^*]+\*\*\s*:/gim)
  },
  {
    id: "close-moral",
    label: "Chute sentencieuse (derniere phrase en maxime)",
    category: "Chute",
    severity: 2,
    run: (text) => {
      const paras = paragraphs(text);
      const last = paras[paras.length - 1] ?? "";
      const isMaxim =
        /\b(?:vaut\s+(?:souvent\s+)?(?:plus|mieux)|n'est\s+pas\s+\w+[^.!?\n]{0,40}c'est|ne\s+sera\s+pas\s+\w+|le\s+bon\s+\w+\s+n'est)/i.test(
          last
        );
      return isMaxim ? [last.slice(0, 100)] : [];
    }
  },
  {
    id: "meta-writing",
    label: "Commentaire meta sur l'ecriture",
    category: "Meta",
    severity: 3,
    run: (text) =>
      matchAll(
        text,
        /\b(?:structure\s+retenue|version\s+revue|ce\s+post\s+(?:part|repose)|dans\s+cet\s+article|voici\s+(?:donc\s+)?(?:un|le|les|ce)\s+\w+\s+(?:qui|pour))/gi
      )
  }
];

function matchAll(text, regex) {
  return [...normalize(text).matchAll(regex)].map((m) => m[0].trim());
}

export function analyse(text) {
  const findings = DETECTORS.map((detector) => {
    const hits = detector.run(text);
    return { ...detector, count: hits.length, hits: hits.slice(0, 4) };
  }).filter((f) => f.count > 0);

  const words = wordCount(text);
  const weighted = findings.reduce((sum, f) => sum + f.count * f.severity, 0);
  // Densite = points ponderes pour 100 mots. Comparable entre posts de longueurs differentes.
  const density = words > 0 ? (weighted / words) * 100 : 0;

  return {
    words,
    weighted,
    density: Number(density.toFixed(2)),
    categories: [...new Set(findings.map((f) => f.category))],
    findings: findings.sort((a, b) => b.count * b.severity - a.count * a.severity)
  };
}

function readDrafts(dbPath) {
  const raw = execFileSync(
    "sqlite3",
    [
      dbPath,
      "-json",
      "SELECT id, headline, body_markdown AS body, quality_score AS score, created_at FROM drafts ORDER BY created_at;"
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  );
  return JSON.parse(raw || "[]");
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const asJson = argv.includes("--json");

  let items = [];
  const dbPath = flag("--db");
  const filePath = flag("--file");

  if (dbPath) {
    items = readDrafts(dbPath).map((d) => ({
      id: d.id,
      label: d.headline,
      score: d.score,
      date: d.created_at,
      text: `${d.headline}\n\n${d.body}`
    }));
  } else if (filePath) {
    items = [{ id: filePath, label: filePath, text: readFileSync(filePath, "utf8") }];
  } else {
    console.error("Usage : node ai-tells.mjs --db <chemin.db> | --file <post.txt> [--json]");
    process.exit(1);
  }

  const results = items.map((item) => ({ ...item, ...analyse(item.text), text: undefined }));

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const totals = new Map();
  for (const result of results) {
    for (const finding of result.findings) {
      const entry = totals.get(finding.id) ?? { ...finding, count: 0, posts: 0 };
      entry.count += finding.count;
      entry.posts += 1;
      totals.set(finding.id, entry);
    }
  }

  console.log(`\nCORPUS : ${results.length} posts\n`);
  console.log("Post                                     mots  densite  marqueurs");
  console.log("-".repeat(78));
  for (const r of results) {
    const label = (r.label ?? r.id).slice(0, 38).padEnd(38);
    console.log(
      `${label} ${String(r.words).padStart(5)}  ${String(r.density).padStart(6)}  ${r.findings
        .slice(0, 3)
        .map((f) => `${f.id}(${f.count})`)
        .join(" ")}`
    );
  }

  const avg = results.reduce((s, r) => s + r.density, 0) / (results.length || 1);
  console.log("-".repeat(78));
  console.log(`Densite moyenne : ${avg.toFixed(2)} points ponderes / 100 mots\n`);

  console.log("MARQUEURS PAR FREQUENCE (posts touches / occurrences)");
  console.log("-".repeat(78));
  for (const t of [...totals.values()].sort((a, b) => b.posts - a.posts || b.count - a.count)) {
    const coverage = `${t.posts}/${results.length}`;
    console.log(
      `${coverage.padStart(5)} posts  ${String(t.count).padStart(3)}x  [s${t.severity}] ${t.label}`
    );
    if (t.hits.length > 0) console.log(`              ex. « ${t.hits[0]} »`);
  }
  console.log("");
}

// La garde comparait `import.meta.url` a un `file://` compose a la main.
// Sous Windows, la gauche vaut « file:///D:/a/... » et la droite
// « file://D:\\a\\... » : la comparaison est TOUJOURS fausse, donc `main()`
// n est jamais appele et le script sort a zero sans rien faire. Une sortie
// muette a zero est indiscernable d un succes.
//
// Ce script n est ni dans `package.json` ni dans la CI, il se lance a la
// main : aucun vert n en dependait. On le corrige quand meme, parce qu un
// outil qui ne fait rien en silence est la meme maladie que les portes que
// cette branche vient de reparer.
if (resolvePath(fileURLToPath(import.meta.url)) === resolvePath(process.argv[1] ?? "")) {
  main();
}

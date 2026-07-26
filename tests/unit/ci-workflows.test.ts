import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOWS_DIR = join(__dirname, "..", "..", ".github", "workflows");

// Assertions de securite et de chainage uniquement. La structure YAML (ordre
// des etapes, libelles, matrices) n'a aucune valeur de regression : elle suit
// l'evolution naturelle des workflows sans jamais rien detecter. Toutes les
// assertions ci-dessous portent sur le texte brut, pas sur un YAML parse : le
// depot n'embarque aucun analyseur YAML, et en ajouter un pour ce fichier
// serait disproportionne.
function readWorkflow(name: string): string {
  return readFileSync(join(WORKFLOWS_DIR, name), "utf-8");
}

const WORKFLOW_FILES = readdirSync(WORKFLOWS_DIR)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();

/**
 * Corps de chaque commande `run:`, blocs multilignes COMPRIS.
 *
 * CE QUI NE MARCHAIT PAS. La version precedente bouclait sur les lignes et ne
 * retenait que celles dont le texte propre commence par `run:`. Le corps d'un
 * bloc `run: |` n'etait donc jamais lu, et le test qui s'appelle
 * « anti-injection » restait vert sur une etape qui ecrit
 * `${{ secrets.MAC_CSC_LINK }}` dans un fichier puis POST
 * `${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}` vers un hote externe. Mutation
 * verifiee : les 7 tests du fichier passaient.
 *
 * On retient donc, pour chaque `run:`, la valeur inline ET, s'il s'agit d'un
 * scalaire de bloc (`|`, `|-`, `>`, `>-`), toutes les lignes plus indentees qui
 * suivent.
 */
export function runCommandBodies(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const bodies: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i]!.match(/^([ \t]*)(?:-[ \t]+)?run:[ \t]*([|>][-+]?)?[ \t]*(.*)$/);

    if (!match) {
      continue;
    }

    const indent = match[1]!.length;
    const isBlockScalar = Boolean(match[2]);
    let body = match[3] ?? "";

    if (isBlockScalar) {
      for (let j = i + 1; j < lines.length; j += 1) {
        const line = lines[j]!;

        if (line.trim() === "") {
          body += "\n";
          continue;
        }

        if (line.match(/^[ \t]*/)![0].length <= indent) {
          break;
        }

        body += `\n${line}`;
      }
    }

    bodies.push(body);
  }

  return bodies;
}

/** Decoupe le bloc `jobs:` en un bloc de texte par job. */
function jobBlocks(raw: string): Map<string, string> {
  const blocks = new Map<string, string>();
  let current: string | null = null;
  let buffer: string[] = [];
  let inJobs = false;

  for (const line of raw.split(/\r?\n/)) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }

    if (!inJobs) {
      continue;
    }

    const header = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);

    if (header) {
      if (current) {
        blocks.set(current, buffer.join("\n"));
      }
      current = header[1]!;
      buffer = [];
      continue;
    }

    if (current) {
      buffer.push(line);
    }
  }

  if (current) {
    blocks.set(current, buffer.join("\n"));
  }

  return blocks;
}

/** Dependances declarees d'un job, sous ses trois formes YAML. */
function needsOf(block: string): string[] {
  const inline = block.match(/^\s*needs:[ \t]*(\[.*\]|[A-Za-z0-9_-]+)[ \t]*$/m);

  if (inline) {
    const value = inline[1]!;

    return value.startsWith("[")
      ? value
          .slice(1, -1)
          .split(",")
          .map((item) => item.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean)
      : [value];
  }

  const lines = block.split(/\r?\n/);
  const listStart = lines.findIndex((line) => /^\s*needs:\s*$/.test(line));

  if (listStart === -1) {
    return [];
  }

  const items: string[] = [];

  for (const line of lines.slice(listStart + 1)) {
    const item = line.match(/^\s*-\s*([A-Za-z0-9_-]+)\s*$/);

    if (!item) {
      break;
    }

    items.push(item[1]!);
  }

  return items;
}

describe("le corpus de workflows", () => {
  // Sans cette garde, ajouter ou renommer un workflow le sortirait de toute
  // couverture sans qu'aucun test ne tombe, et une boucle sur un repertoire
  // vide passerait en n'assertant rien.
  it("est exactement celui que ce fichier couvre", () => {
    expect(WORKFLOW_FILES).toEqual([
      "auto-release.yml",
      "ci.yml",
      "package.yml",
      "release.yml"
    ]);
  });

  it.each(WORKFLOW_FILES)("%s n'utilise jamais continue-on-error", (name) => {
    expect(readWorkflow(name)).not.toMatch(/continue-on-error/);
  });

  it.each(WORKFLOW_FILES)(
    "%s n'interpole aucun secret dans une commande run:, blocs multilignes compris",
    (name) => {
      // Un secret dans un `env:` n'est expose qu'au processus ; splice dans un
      // `run:`, il peut etre ecrit sur disque ou exfiltre.
      for (const body of runCommandBodies(readWorkflow(name))) {
        expect(body).not.toMatch(/secrets\./);
      }
    }
  );
});

describe("runCommandBodies", () => {
  /*
   * Le lecteur de blocs est lui-meme une porte : s'il ne rendait rien, les
   * tests qui s'appuient dessus passeraient en n'examinant aucune ligne. Ces
   * deux cas le mesurent sur une entree fabriquee, plutot que de le supposer
   * bon parce que les workflows reels sont propres.
   */
  const SYNTHETIQUE = [
    "jobs:",
    "  demo:",
    "    steps:",
    "      - name: inline",
    "        run: npm ci",
    "      - name: bloc",
    "        run: |",
    '          echo "${{ secrets.MAC_CSC_LINK }}" > cert.p12',
    "          npm run build",
    "      - name: apres",
    "        run: npm test"
  ].join("\n");

  it("lit le corps d'un bloc run: | et pas seulement sa premiere ligne", () => {
    const bodies = runCommandBodies(SYNTHETIQUE);

    expect(bodies).toHaveLength(3);
    expect(bodies[1]).toContain("secrets.MAC_CSC_LINK");
    expect(bodies[1]).toContain("npm run build");
  });

  it("s'arrete a la fin du bloc et n'avale pas l'etape suivante", () => {
    const bodies = runCommandBodies(SYNTHETIQUE);

    expect(bodies[0]).toBe("npm ci");
    expect(bodies[1]).not.toContain("npm test");
    expect(bodies[2]).toBe("npm test");
  });
});

/**
 * Chaine de verification attendue, dans `ci.yml` comme dans le job `checks`
 * d'`auto-release.yml`.
 *
 * Les deux listes sont DUPLIQUEES dans les deux workflows, deliberement : la
 * chaine qui publie porte ses propres etapes plutot que d'appeler un workflow
 * partage, pour qu'elle se relise dans son YAML et que sa panne ne puisse pas
 * etre silencieuse. Le prix d'une duplication est qu'elle derive ; cette
 * constante est ce qui l'en empeche, puisque les deux fichiers sont mesures
 * contre elle.
 */
const CHAINE_DE_VERIFICATION = [
  "npm ci",
  "npm run rebuild:native:electron",
  "npm run typecheck",
  "npm run lint",
  "npm test",
  "npm run build",
  "npm audit --audit-level=high --omit=dev",
  "npm run audit:contraste",
  "npm run verify-hardening"
];

describe("ci.yml", () => {
  const raw = readWorkflow("ci.yml");

  it("execute la chaine de verification complete", () => {
    for (const commande of CHAINE_DE_VERIFICATION) {
      expect(raw).toContain(commande);
    }
  });

  it("ne reference aucun secret", () => {
    expect(raw).not.toMatch(/secrets\./);
  });
});

describe("auto-release.yml", () => {
  const raw = readWorkflow("auto-release.yml");
  const jobs = jobBlocks(raw);

  /*
   * Ce workflow n'etait couvert par AUCUN test. C'est le seul en
   * `permissions: contents: write`, le seul qui publie une release publique, et
   * il reference cinq secrets de signature. Son job `package` ne dependait que
   * de `check-version` : rien ne gatait la publication, et `ci.yml`, qui part
   * sur le meme push, est une execution independante dont l'echec n'empeche
   * rien.
   */
  /*
   * Les notes de version sont ECRITES, pas generees. Les releases precedentes
   * ne portaient que le lien « Full Changelog » automatique, soit une liste de
   * messages de commit : lisible par qui a ecrit le code, opaque pour qui
   * telecharge l'application.
   *
   * Cette porte est ce qui separe « notes ecrites » de « notes promises ».
   * `body_path` designe un fichier par version : sans elle, bumper sans ecrire
   * les notes publierait une release dont le corps est vide ou dont l'action
   * echoue au dernier moment, apres l'empaquetage des trois systemes. On veut
   * l'echec AVANT, et sur une phrase qui dit quoi faire.
   */
  it("publie des notes ecrites pour la version portee par package.json", () => {
    expect(raw).toContain(
      "body_path: .github/release-notes/v${{ needs.check-version.outputs.version }}.md"
    );

    const version = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8")
    ).version as string;
    const chemin = join(__dirname, "..", "..", ".github", "release-notes", `v${version}.md`);

    expect(
      existsSync(chemin),
      `Notes de version manquantes pour ${version}. Ecrire ${chemin} avant de publier.`
    ).toBe(true);

    // Un fichier vide passerait `existsSync` sans rien apprendre a personne.
    const notes = readFileSync(chemin, "utf-8").trim();
    expect(notes.length).toBeGreaterThan(200);
  });

  it("empeche l'empaquetage de demarrer sans que les verifications aient reussi", () => {
    expect(needsOf(jobs.get("package") ?? "")).toContain("checks");
  });

  it("fait dependre la publication de l'empaquetage", () => {
    expect(needsOf(jobs.get("publish") ?? "")).toContain("package");
  });

  it("porte la chaine de verification complete dans son job checks", () => {
    const checks = jobs.get("checks") ?? "";

    for (const commande of CHAINE_DE_VERIFICATION) {
      expect(checks).toContain(commande);
    }
  });

  it("porte exactement la meme chaine que ci.yml, sans derive", () => {
    // Les deux listes sont dupliquees a dessein. Ce test est ce qui les tient
    // ensemble : ajouter une etape d'un seul cote fait tomber ce test, au lieu
    // de laisser le chemin qui publie devenir le moins verifie des deux.
    const commandesDe = (raw: string) =>
      runCommandBodies(raw)
        .map((body) => body.trim())
        .filter(Boolean)
        .sort();

    expect(commandesDe(jobs.get("checks") ?? "")).toEqual(commandesDe(readWorkflow("ci.yml")));
  });

  it("refuse de publier une release sans le moindre binaire attache", () => {
    // `fail_on_unmatched_files` vaut `false` par defaut cote action (verifie
    // dans son `action.yml`). Sans cette entree, un motif sans correspondance
    // publie un tag public sur une page de release vide, en vert.
    expect(raw).toContain("fail_on_unmatched_files: true");
  });

  it("n'interpole aucun des cinq secrets de signature dans une commande run:", () => {
    // Le defaut trouve et prouve par mutation dans la version precedente de ce
    // fichier : le controle ne lisait que les lignes commencant par `run:`, donc
    // jamais le corps d'un bloc `run: |`.
    const secretsDeSignature = [
      "MAC_CSC_LINK",
      "MAC_CSC_KEY_PASSWORD",
      "APPLE_ID",
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_TEAM_ID"
    ];

    for (const body of runCommandBodies(raw)) {
      for (const secret of secretsDeSignature) {
        expect(body).not.toContain(secret);
      }
    }
  });

  it("ne contourne jamais une dependance ignoree ou en echec", () => {
    // `always()`, `!cancelled()` et `!failure()` font tourner un job dont une
    // dependance a ete IGNOREE ou a ECHOUE. Les employer sur `package` ou
    // `publish` rouvrirait exactement le chemin que le job `verify` ferme, et
    // aucune autre assertion de ce fichier ne le verrait.
    for (const [nom, bloc] of jobs) {
      for (const ligne of bloc.split(/\r?\n/).filter((l) => /^\s*if:/.test(l))) {
        expect(`${nom}: ${ligne}`).not.toMatch(/always\(\)|![ \t]*cancelled\(\)|![ \t]*failure\(\)/);
      }
    }
  });

  it("ne reference que les secrets attendus", () => {
    const used = [...new Set([...raw.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]))].sort();

    expect(used).toEqual([
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_ID",
      "APPLE_TEAM_ID",
      "GITHUB_TOKEN",
      "MAC_CSC_KEY_PASSWORD",
      "MAC_CSC_LINK"
    ]);
  });
});

describe("package.yml", () => {
  const raw = readWorkflow("package.yml");

  it("references only the expected mac code-signing secrets", () => {
    // Le build macOS est signe (Developer ID) + notarise : les secrets de
    // signature sont attendus. On verrouille l'ensemble exact pour forcer une
    // revue si la liste change.
    const used = [...new Set([...raw.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]))].sort();

    expect(used).toEqual([
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_ID",
      "APPLE_TEAM_ID",
      "MAC_CSC_KEY_PASSWORD",
      "MAC_CSC_LINK"
    ]);
  });
});

describe("release.yml", () => {
  const raw = readWorkflow("release.yml");

  it("only references the GITHUB_TOKEN secret (no other secrets)", () => {
    const secretRefs = raw.match(/secrets\.[A-Z0-9_]+/g) ?? [];
    const unique = Array.from(new Set(secretRefs));

    expect(unique).toEqual(["secrets.GITHUB_TOKEN"]);
  });

  it("ne publie qu'un brouillon, jamais une release publique", () => {
    // La publication publique passe par `auto-release.yml`, desormais gate par
    // son job `checks`. Ce workflow-ci suit `Package`, qui ne verifie rien :
    // son seul garde-fou est que la release reste un brouillon qu'un humain
    // promeut.
    expect(raw).toContain("draft: true");
  });

  it("ne produit pas un brouillon vide en silence", () => {
    expect(raw).toContain("fail_on_unmatched_files: true");
  });
});

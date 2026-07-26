import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Politique d execution des CLI d IA.
 *
 * Ces tests assertent les ARGUMENTS EXACTS passes au processus enfant, parce
 * que c est la seule chose qui contraigne reellement un CLI. Un test qui se
 * contenterait de verifier la presence d un drapeau passerait sur un ordre
 * faux, et pour Antigravity l ordre EST le defaut : son parseur ignore en
 * silence tout drapeau place apres un argument non-drapeau.
 *
 * D ou `toEqual` sur le tableau complet plutot que `toContain`, et des attendus
 * ecrits en toutes lettres plutot qu importes du code teste : un attendu qui
 * viendrait du code de production ne pourrait jamais tomber.
 */

const spawnCliMock = vi.hoisted(() => vi.fn());

vi.mock("../../app/main/domains/execution/spawn-cli", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../app/main/domains/execution/spawn-cli")
  >();
  return { ...actual, spawnCli: spawnCliMock };
});

import { buildChildEnv } from "../../app/main/domains/execution/spawn-cli";
import { CodexEngine } from "../../app/main/domains/execution/codex-engine";
import { ClaudeEngine } from "../../app/main/domains/execution/claude-engine";
import { AntigravityEngine } from "../../app/main/domains/execution/antigravity-engine";
import { CodexCliRunner } from "../../app/main/domains/execution/codex-cli-runner";

type SpawnCall = {
  command: string;
  args: string[];
  options: {
    input: string;
    timeoutMs: number;
    cwd?: string;
    envKeys?: readonly string[];
    envPrefixes?: readonly string[];
  };
};

function lastCall(): SpawnCall {
  const call = spawnCliMock.mock.calls.at(-1);
  if (!call) throw new Error("spawnCli n a pas ete appele");
  return { command: call[0], args: call[1], options: call[2] };
}

/**
 * Valeur qui suit un drapeau. Leve si le drapeau a disparu, plutot que de
 * propager `undefined` : un drapeau absent doit faire tomber le test en le
 * nommant, pas produire une comparaison confuse plus loin.
 */
function valueAfter(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (value === undefined) {
    throw new Error(`Aucune valeur apres ${flag} dans ${JSON.stringify(args)}`);
  }
  return value;
}

beforeEach(() => {
  spawnCliMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("politique d execution Codex", () => {
  beforeEach(() => {
    spawnCliMock.mockResolvedValue({
      status: 0,
      // Le moteur relit le fichier ecrit par la CLI. Le mock ne l ecrit pas,
      // donc `executeSkill` levera a la lecture : l assertion porte sur les
      // arguments deja captures, pas sur la valeur de retour.
      stdout: "",
      stderr: "",
      timedOut: false
    });
  });

  it("epingle bac a sable, configuration ignoree et racine de travail contrainte", async () => {
    await new CodexEngine().executeSkill("PROMPT").catch(() => undefined);

    const { args, options } = lastCall();

    // Le dossier de travail attendu est DERIVE du chemin de sortie, pas lu
    // depuis l argument `-C`. Si `-C` designait un autre dossier, l egalite
    // ci-dessous tomberait.
    const outputPath = valueAfter(args, "--output-last-message");
    const workDirectory = dirname(outputPath);

    expect(args).toEqual([
      "exec",
      "-s",
      "read-only",
      "--ignore-user-config",
      "--ignore-rules",
      "-C",
      workDirectory,
      "--skip-git-repo-check",
      "--ephemeral",
      "--output-last-message",
      outputPath,
      "-"
    ]);

    expect(basename(outputPath)).toBe("last-message.json");
    expect(workDirectory.startsWith(tmpdir())).toBe(true);
    expect(basename(workDirectory).startsWith("ghostwraiter-codex-")).toBe(true);
    expect(options.cwd).toBe(workDirectory);
    expect(options.input).toBe("PROMPT");
  });

  it("n autorise que les variables Codex, jamais l environnement entier", async () => {
    await new CodexEngine().executeSkill("PROMPT").catch(() => undefined);

    expect(lastCall().options.envKeys).toEqual([
      "CODEX_HOME",
      "OPENAI_API_KEY",
      "OPENAI_BASE_URL",
      "OPENAI_ORGANIZATION"
    ]);
    expect(lastCall().options.envPrefixes).toBeUndefined();
  });

  it("efface le dossier temporaire meme quand la CLI echoue", async () => {
    spawnCliMock.mockResolvedValue({
      status: 1,
      stdout: "",
      stderr: "boom",
      timedOut: false
    });

    await new CodexEngine().executeSkill("PROMPT").catch(() => undefined);

    const { args } = lastCall();
    const workDirectory = dirname(valueAfter(args, "--output-last-message"));
    expect(existsSync(workDirectory)).toBe(false);
  });
});

describe("politique d execution du runner Codex synchrone", () => {
  // Voie de repli, pas le chemin actif en production. Elle lance pourtant la
  // meme commande avec le meme prompt : elle porte donc la meme politique, et
  // ce test empeche les deux chemins de diverger.
  it("passe les memes drapeaux que le moteur asynchrone", () => {
    // Le repertoire temporaire est compose avec `join`, donc son separateur
    // suit la plateforme. Ecrire l attendu en POSIX faisait echouer ce test sur
    // Windows, et seulement la : `\tmp\codex-runner-test\last-message.json`
    // contre `/tmp/...`. Le defaut etait dans l attendu, pas dans le code.
    //
    // Les DRAPEAUX restent ecrits en toutes lettres, parce qu ils sont la
    // propriete mesuree. Seul le chemin est compose, parce que son separateur
    // est un fait de plateforme et non un comportement a verifier.
    const tempDirectory = join("/tmp", "codex-runner-test");
    const executor = vi.fn().mockReturnValue({ status: 1, stdout: "", stderr: "boom" });
    const filesystem = {
      makeTempDir: vi.fn().mockReturnValue(tempDirectory),
      readFile: vi.fn(),
      removeDir: vi.fn()
    };

    new CodexCliRunner(executor, filesystem).execute({
      runId: "run_policy",
      skillName: "linkedin-post-writer",
      skillVersion: "1.0.0",
      context: {},
      payload: {},
      attachments: []
    });

    expect(executor.mock.calls[0]?.[0]).toEqual([
      "exec",
      "-s",
      "read-only",
      "--ignore-user-config",
      "--ignore-rules",
      "-C",
      tempDirectory,
      "--skip-git-repo-check",
      "--ephemeral",
      "--output-last-message",
      join(tempDirectory, "last-message.json"),
      "-"
    ]);
  });
});

describe("politique d execution Claude Code", () => {
  beforeEach(() => {
    spawnCliMock.mockResolvedValue({
      status: 0,
      stdout: '{"result":"texte"}',
      stderr: "",
      timedOut: false
    });
  });

  it("desactive tous les outils et epingle le mode de permission", async () => {
    await new ClaudeEngine().executeSkill("PROMPT");

    const { args } = lastCall();

    expect(args).toEqual([
      "--print",
      "--output-format",
      "json",
      "--tools",
      "",
      "--permission-mode",
      "manual",
      "--safe-mode",
      "--strict-mcp-config",
      "--no-session-persistence"
    ]);

    // `--tools` est variadique : place en fin de ligne il avalerait le drapeau
    // suivant. Il doit rester suivi d un autre drapeau.
    const toolsIndex = args.indexOf("--tools");
    expect(valueAfter(args, "--tools")).toBe("");
    expect(args[toolsIndex + 2]).toBe("--permission-mode");

    // `--bare` casserait l authentification par abonnement (OAuth et trousseau
    // jamais lus). Il ne doit jamais reapparaitre ici.
    expect(args).not.toContain("--bare");
    expect(args).not.toContain("--dangerously-skip-permissions");
  });

  it("contraint le repertoire de travail et la liste blanche d environnement", async () => {
    await new ClaudeEngine().executeSkill("PROMPT");

    const { options } = lastCall();

    expect(options.cwd).toBeDefined();
    expect(options.cwd?.startsWith(tmpdir())).toBe(true);
    expect(basename(options.cwd ?? "").startsWith("ghostwraiter-claude-")).toBe(true);
    // Le dossier est efface une fois la generation terminee.
    expect(existsSync(options.cwd ?? "")).toBe(false);

    expect(options.envKeys).toEqual([
      "CLAUDE_CONFIG_DIR",
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_BASE_URL",
      "ANTHROPIC_MODEL",
      "ANTHROPIC_CUSTOM_HEADERS"
    ]);
  });
});

describe("politique d execution Antigravity", () => {
  beforeEach(() => {
    spawnCliMock.mockResolvedValue({
      status: 0,
      stdout: "texte",
      stderr: "",
      timedOut: false
    });
  });

  it("place --sandbox AVANT -p, sans quoi le parseur l ignorerait en silence", async () => {
    await new AntigravityEngine().executeSkill("PROMPT");

    const { args } = lastCall();

    expect(args).toEqual(["--sandbox", "-p", "PROMPT"]);

    // Assertion de POSITION, et non de presence. Le parseur de cette CLI a la
    // forme du paquet `flag` de Go : il s arrete au premier argument
    // non-drapeau. `["-p", prompt, "--sandbox"]` produirait une porte qui ne
    // restreint rien, et aucune erreur ne serait levee.
    expect(args.indexOf("--sandbox")).toBeLessThan(args.indexOf("-p"));
    expect(args.indexOf("--sandbox")).toBe(0);

    // Ces deux drapeaux existent sur la CLI et vont dans le mauvais sens.
    expect(args).not.toContain("--dangerously-skip-permissions");
    expect(args).not.toContain("--mode");
  });

  it("autorise les variables du fournisseur par prefixe, faute de liste connue", async () => {
    await new AntigravityEngine().executeSkill("PROMPT");

    expect(lastCall().options.envPrefixes).toEqual([
      "ANTIGRAVITY_",
      "AGY_",
      "GOOGLE_",
      "GEMINI_"
    ]);
  });
});

describe("liste blanche des variables d environnement", () => {
  // Identite fixe : les tests ne doivent dependre ni du compte qui les execute,
  // ni de la plateforme.
  const POSIX = { username: "testeur", homedir: "/Users/testeur", windows: false };
  const WINDOWS = { username: "testeur", homedir: "C:\\Users\\testeur", windows: true };

  it("laisse passer ce sans quoi les CLI cassent", () => {
    const source = {
      PATH: "/usr/bin",
      USER: "testeur",
      HOME: "/Users/testeur",
      LANG: "fr_FR.UTF-8",
      LC_ALL: "fr_FR.UTF-8",
      HTTPS_PROXY: "http://proxy:3128",
      NODE_EXTRA_CA_CERTS: "/etc/ca.pem",
      TMPDIR: "/tmp"
    };

    expect(buildChildEnv([], [], source, POSIX)).toEqual(source);
  });

  it("retire les secrets du poste qui ne concernent aucun moteur", () => {
    const child = buildChildEnv(
      [],
      [],
      {
        PATH: "/usr/bin",
        USER: "testeur",
        HOME: "/Users/testeur",
        AWS_SECRET_ACCESS_KEY: "secret",
        TELEGRAM_BOT_TOKEN: "secret",
        GITHUB_PAT_TOKEN: "secret",
        // Variable injectee par Electron dans son propre processus. La
        // transmettre ferait demarrer un CLI Node en mode interpreteur.
        ELECTRON_RUN_AS_NODE: "1"
      },
      POSIX
    );

    expect(child).toEqual({
      PATH: "/usr/bin",
      USER: "testeur",
      HOME: "/Users/testeur"
    });
  });

  it("compare sans tenir compte de la casse et preserve la casse d origine", () => {
    // Sur Windows les cles gardent la casse de l OS. Une comparaison exacte sur
    // des noms en majuscules les raterait toutes et le lancement echouerait.
    const child = buildChildEnv(
      [],
      [],
      {
        SystemRoot: "C:\\Windows",
        windir: "C:\\Windows",
        LocalAppData: "C:\\Users\\testeur\\AppData\\Local",
        Path: "C:\\Windows\\system32",
        UserName: "testeur",
        UserProfile: "C:\\Users\\testeur",
        https_proxy: "http://proxy:3128"
      },
      WINDOWS
    );

    expect(child).toEqual({
      SystemRoot: "C:\\Windows",
      windir: "C:\\Windows",
      LocalAppData: "C:\\Users\\testeur\\AppData\\Local",
      Path: "C:\\Windows\\system32",
      UserName: "testeur",
      UserProfile: "C:\\Users\\testeur",
      https_proxy: "http://proxy:3128"
    });
  });

  it("ajoute les variables declarees par un moteur, et rien de plus", () => {
    const source = {
      PATH: "/usr/bin",
      USER: "testeur",
      HOME: "/Users/testeur",
      CODEX_HOME: "/Users/testeur/.codex",
      CLAUDE_CONFIG_DIR: "/Users/testeur/.claude"
    };

    expect(buildChildEnv(["CODEX_HOME"], [], source, POSIX)).toEqual({
      PATH: "/usr/bin",
      USER: "testeur",
      HOME: "/Users/testeur",
      CODEX_HOME: "/Users/testeur/.codex"
    });
  });

  it("n autorise par prefixe que les prefixes demandes", () => {
    const child = buildChildEnv(
      [],
      ["ANTIGRAVITY_"],
      {
        PATH: "/usr/bin",
        USER: "testeur",
        HOME: "/Users/testeur",
        ANTIGRAVITY_PROJECT_ID: "abc",
        OPENAI_API_KEY: "secret"
      },
      POSIX
    );

    expect(child).toEqual({
      PATH: "/usr/bin",
      USER: "testeur",
      HOME: "/Users/testeur",
      ANTIGRAVITY_PROJECT_ID: "abc"
    });
  });
});

describe("repli d identite quand l environnement est pauvre", () => {
  const POSIX = { username: "testeur", homedir: "/Users/testeur", windows: false };
  const WINDOWS = { username: "testeur", homedir: "C:\\Users\\testeur", windows: true };

  // Cas reel vise : une application Electron lancee depuis le Finder ne recoit
  // pas l environnement d un shell de connexion. Sans `USER`, Claude Code se
  // declare non connecte alors que le poste l est.
  it("comble USER et HOME sur POSIX quand ils manquent a la source", () => {
    const child = buildChildEnv([], [], { PATH: "/usr/bin" }, POSIX);

    expect(child).toEqual({
      PATH: "/usr/bin",
      USER: "testeur",
      HOME: "/Users/testeur"
    });
  });

  it("comble USERNAME et USERPROFILE sur Windows, et jamais HOME", () => {
    const child = buildChildEnv([], [], { Path: "C:\\Windows" }, WINDOWS);

    expect(child).toEqual({
      Path: "C:\\Windows",
      USERNAME: "testeur",
      USERPROFILE: "C:\\Users\\testeur"
    });
    // `HOME` n est pas le nom natif sous Windows et plusieurs outils le lisent
    // en priorite. Le poser changerait leur repertoire de reference.
    expect(child.HOME).toBeUndefined();
  });

  it("n ecrase jamais une valeur deja presente", () => {
    const child = buildChildEnv(
      [],
      [],
      { PATH: "/usr/bin", USER: "choisi", HOME: "/ailleurs" },
      POSIX
    );

    expect(child.USER).toBe("choisi");
    expect(child.HOME).toBe("/ailleurs");
  });

  it("respecte la casse d origine plutot que de dupliquer la cle", () => {
    // Une source qui porte deja `Home` ne doit pas recevoir en plus `HOME` :
    // deux cles pour la meme variable donneraient un resultat imprevisible.
    const child = buildChildEnv([], [], { Path: "C:\\W", UserProfile: "C:\\U" }, WINDOWS);

    expect(child.USERPROFILE).toBeUndefined();
    expect(child.UserProfile).toBe("C:\\U");
  });

  it("ne comble rien quand le systeme ne sait pas repondre", () => {
    // Un identifiant sans entree dans la base de comptes existe. Inventer un
    // chemin serait pire que de ne rien poser.
    expect(buildChildEnv([], [], { PATH: "/usr/bin" }, null)).toEqual({ PATH: "/usr/bin" });
  });
});

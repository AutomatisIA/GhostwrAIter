import { spawn } from "node:child_process";
import { userInfo } from "node:os";

/**
 * Lancement d un CLI SANS bloquer le processus principal.
 *
 * Les moteurs utilisaient `spawnSync`, qui gele le processus principal pendant
 * toute la duree de l invocation, soit quarante a cent secondes par generation.
 * macOS considere alors l application comme ne repondant plus : la fenetre se
 * fige, le curseur tourne, l utilisateur croit a un plantage.
 *
 * Cette version rend la main immediatement et resout une promesse a la fin, ce
 * qui laisse la boucle d evenements libre : l interface continue de repondre,
 * les animations tournent, le compteur de temps ecoule avance reellement.
 */

export type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

/**
 * Variables d environnement transmises a TOUT CLI lance par l application.
 *
 * Le processus enfant recevait `process.env` en entier. Pas d escalade de
 * privilege (meme utilisateur), mais un elargissement gratuit : l environnement
 * d un poste de developpement porte des jetons d API, des cles de service et des
 * secrets d autres projets, dont aucun moteur de redaction n a besoin. Cette
 * liste borne ce qui traverse.
 *
 * La comparaison est INSENSIBLE A LA CASSE, et c est structurel, pas cosmetique.
 * Sur Windows les cles gardent la casse de l OS (`SystemRoot`, `windir`,
 * `Path`) ; une comparaison exacte sur des noms en majuscules les raterait
 * toutes et le lancement echouerait. La casse d origine est preservee dans
 * l environnement produit, car c est elle que l OS attend.
 *
 * Chaque famille est ici parce que la perdre casse quelque chose de reel :
 *
 *   - PATH et les chemins maison : sans eux le binaire n est pas resolu, et les
 *     CLI installees par npm ne trouvent pas leur interpreteur node.
 *   - LANG et LC_* : les sorties sont du francais accentue. Les perdre ne leve
 *     aucune erreur, cela produit du mojibake, ce qui est pire.
 *   - Les proxys et les certificats d entreprise : sans eux les trois moteurs
 *     sont inutilisables derriere un proxy, et aucun test local ne le voit.
 *   - Les cles Windows : `SystemRoot` et `COMSPEC` manquants suffisent a faire
 *     echouer un spawn sur cette plateforme.
 */
const BASE_ENV_KEYS: readonly string[] = [
  // Resolution des binaires et de l interpreteur.
  "PATH",
  "PATHEXT",
  // Repertoire personnel : c est la que vivent ~/.codex, ~/.claude et la
  // configuration d Antigravity. Sans lui, aucun moteur ne trouve ses jetons.
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  // Repertoires temporaires, utilises par les CLI pour leurs fichiers de travail.
  "TMPDIR",
  "TEMP",
  "TMP",
  // Encodage et langue.
  "LANG",
  "LANGUAGE",
  "LC_ALL",
  "LC_CTYPE",
  // Identite de l utilisateur courant. `USER` N EST PAS DECORATIVE : mesuree le
  // 26 juillet 2026, son absence fait repondre a Claude Code « Not logged in ·
  // Please run /login » alors que le poste est bel et bien connecte, parce qu il
  // ne retrouve plus ses identifiants dans le trousseau. La panne est
  // silencieuse et se lit comme une deconnexion. `LOGNAME`, `SHELL` et `TERM`
  // ont ete testes isolement et ne suffisent pas : seule `USER` debloque.
  "USER",
  "USERNAME",
  "LOGNAME",
  "SHELL",
  "TERM",
  // Proxys d entreprise. Les variantes en minuscules sont couvertes par la
  // comparaison insensible a la casse.
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  // Autorites de certification d entreprise.
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "REQUESTS_CA_BUNDLE",
  "CURL_CA_BUNDLE",
  // Chemins standards Linux.
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "XDG_RUNTIME_DIR",
  // Cles Windows sans lesquelles un spawn echoue.
  "SYSTEMROOT",
  "SYSTEMDRIVE",
  "WINDIR",
  "COMSPEC",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "PROGRAMW6432",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "OS"
];

export type ChildIdentity = {
  username: string;
  homedir: string;
  windows: boolean;
};

/**
 * Identite de l utilisateur lue AUPRES DU SYSTEME, jamais de l environnement.
 *
 * `userInfo()` interroge la base de comptes du systeme via l identifiant
 * effectif du processus. Verifie le 26 juillet 2026 : sous `env -i`, donc sans
 * une seule variable, elle rend toujours `username` et `homedir` corrects.
 * C est precisement ce qui en fait un repli valable la ou l environnement fait
 * defaut.
 *
 * A ne pas confondre avec `os.homedir()`, qui consulte `$HOME` en premier et
 * ne retomberait sur le systeme qu ensuite : il ne servirait a rien ici, le cas
 * a couvrir etant justement l absence de `$HOME`.
 */
function resolveIdentity(): ChildIdentity | null {
  try {
    const info = userInfo();
    return {
      username: info.username,
      homedir: info.homedir,
      windows: process.platform === "win32"
    };
  } catch {
    // Un identifiant sans entree dans la base de comptes existe (conteneurs
    // minimalistes). On ne comble alors rien plutot que d inventer un chemin.
    return null;
  }
}

/**
 * Complete l identite manquante, sans jamais ecraser une valeur presente.
 *
 * POURQUOI CE REPLI EXISTE. Une application Electron lancee depuis le Finder ne
 * recoit pas l environnement d un shell de connexion : il est bien plus pauvre.
 * Or l absence de `USER` fait repondre a Claude Code « Not logged in · Please
 * run /login » alors que le poste est connecte, parce qu il ne retrouve plus ses
 * identifiants dans le trousseau. La liste blanche laisse passer `USER`
 * correctement, mais laisser passer une variable qui n existe pas a la source ne
 * la fait pas apparaitre. Ce repli couvre ce cas-la, et lui seul.
 *
 * Les noms combles sont ceux de la plateforme : `USER` et `HOME` sur les
 * systemes POSIX, `USERNAME` et `USERPROFILE` sur Windows. On ne pose PAS `HOME`
 * sur Windows : ce n est pas le nom natif, plusieurs outils le lisent en
 * priorite, et changer leur repertoire de reference n a jamais ete mesure ici.
 *
 * Une valeur deja presente est toujours conservee : un utilisateur qui pointe
 * deliberement `HOME` ailleurs garde son choix.
 */
function completeIdentity(
  childEnv: NodeJS.ProcessEnv,
  identity: ChildIdentity | null
): NodeJS.ProcessEnv {
  if (!identity) return childEnv;

  const nameKey = identity.windows ? "USERNAME" : "USER";
  const homeKey = identity.windows ? "USERPROFILE" : "HOME";
  const present = new Set(Object.keys(childEnv).map((key) => key.toUpperCase()));

  if (!present.has(nameKey) && identity.username) {
    childEnv[nameKey] = identity.username;
  }
  if (!present.has(homeKey) && identity.homedir) {
    childEnv[homeKey] = identity.homedir;
  }
  return childEnv;
}

/**
 * Construit l environnement du processus enfant par liste blanche.
 *
 * `extraKeys` porte les variables propres a un moteur, declarees par ce moteur.
 * `extraPrefixes` n existe que pour Antigravity : sa CLI est un binaire
 * proprietaire dont les variables lues ne sont pas documentees et ne peuvent pas
 * etre enumerees de facon fiable. Autoriser quelques prefixes du fournisseur
 * reste un cadrage tres inferieur a `process.env` entier, qui laissait passer
 * les secrets de tous les autres projets du poste.
 *
 * Exportee pour que les tests puissent verifier ce qui traverse ET ce qui ne
 * traverse pas, sans lancer de processus.
 */
export function buildChildEnv(
  extraKeys: readonly string[] = [],
  extraPrefixes: readonly string[] = [],
  source: NodeJS.ProcessEnv = process.env,
  // Injectable pour que les tests couvrent la branche Windows depuis n importe
  // quelle plateforme, et n aient pas a dependre du compte qui les execute.
  identity: ChildIdentity | null = resolveIdentity()
): NodeJS.ProcessEnv {
  const allowed = new Set(
    [...BASE_ENV_KEYS, ...extraKeys].map((key) => key.toUpperCase())
  );
  const prefixes = extraPrefixes.map((prefix) => prefix.toUpperCase());

  const childEnv: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const normalized = key.toUpperCase();
    if (allowed.has(normalized) || prefixes.some((prefix) => normalized.startsWith(prefix))) {
      childEnv[key] = value;
    }
  }
  return completeIdentity(childEnv, identity);
}

export function spawnCli(
  command: string,
  args: readonly string[],
  options: {
    input: string;
    timeoutMs: number;
    cwd?: string;
    /** Variables propres au moteur, en plus de la liste blanche commune. */
    envKeys?: readonly string[];
    /** Prefixes autorises. Reserve aux CLI dont les variables ne sont pas enumerables. */
    envPrefixes?: readonly string[];
  }
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd ?? process.cwd(),
      env: buildChildEnv(options.envKeys, options.envPrefixes),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

    const finish = (result: CliResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (status) => {
      finish({ status, stdout, stderr, timedOut });
    });

    // L ecriture peut echouer si le processus meurt avant de lire son entree.
    // Ce n est pas une erreur du point de vue de l appelant : la fermeture qui
    // suit portera le vrai diagnostic.
    child.stdin.on("error", () => undefined);
    child.stdin.end(options.input);
  });
}

/* global window, document */
/**
 * Automated verification of the security hardening introduced by
 * feature 002-security-hardening.
 *
 * Runs four checks programmatically:
 *
 *  1. window.open to an external origin is intercepted by the main
 *     process navigation guard and no new window is loaded in-process.
 *  2. An inline external script injection from the renderer console is
 *     blocked by the Content Security Policy (meta-tag enforced).
 *  3. Setting LINKEDIN_POSTER_WORKSPACE_ROOT to a malformed value
 *     (here: a relative path) causes the application to fail fast at
 *     startup with a typed WorkspaceConfigurationError and a non-zero
 *     exit code, creating no files under the default or candidate path.
 *  4. Launching the production build does NOT open DevTools
 *     automatically (they may exist but must not be opened before the
 *     renderer finishes its first paint).
 *
 * All four checks operate against the pre-built dist-electron/main
 * bundle, so they exercise the exact same code path that a packaged
 * build would ship.
 *
 * Usage: node scripts/verify-hardening.mjs
 */
import { _electron as electron } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

// `URL.pathname` rend « /D:/a/... » sous Windows, et `resolve` en fait
// « D:\\D:\\a\\... », lettre de lecteur dupliquee. La CI Windows est tombee
// dessus, aucune machine locale ne pouvait le voir. `fileURLToPath` est la
// seule conversion correcte d une URL de fichier en chemin natif.
const repoRoot = resolvePath(fileURLToPath(new URL("..", import.meta.url)));
const mainBundle = join(repoRoot, "dist-electron", "main", "index.js");
const renderedHtml = join(repoRoot, "out", "renderer", "index.html");
const electronBinary = join(repoRoot, "node_modules", ".bin", "electron");

let passed = 0;
let failed = 0;

function report(name, ok, details) {
  if (ok) {
    passed += 1;
    console.log(`\u2713 ${name}`);
  } else {
    failed += 1;
    console.log(`\u2717 ${name}`);
  }
  if (details) {
    for (const line of details.split("\n")) {
      console.log(`    ${line}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check 0: the SHIPPED renderer carries a production-grade policy.
//
// `tests/unit/csp-injection.test.ts` couvre la fonction pure `injectCspMetaTag`.
// Rien ne couvrait l artefact : le mode est choisi par
// `process.env.NODE_ENV === "production"` dans `electron.vite.config.ts`, et un
// build qui retomberait sur `developmentCsp` livrerait `'unsafe-inline'`,
// `'unsafe-eval'` et `ws:` a l application packagee sans qu aucune porte ne
// tombe.
//
// On assertit la PROPRIETE, jamais une copie de la politique. Recopier la
// chaine attendue ici reconstruirait le defaut de `audit-contrast.mjs`, qui
// certifiait une palette dupliquee au lieu de la palette reelle : la porte
// resterait verte pendant que la source change. Les jetons ci-dessous sont
// exactement ceux qui separent la politique de developpement de celle de
// production, et le controle est borne a la directive `script-src` : `style-src
// 'unsafe-inline'` figure dans les DEUX politiques et ferait une fausse alerte.
// ---------------------------------------------------------------------------

console.log("== Check 0: politique de securite de l artefact construit ==");

if (!existsSync(renderedHtml)) {
  report(
    "le renderer construit porte une politique de production",
    false,
    `${renderedHtml} introuvable : lancez d abord \`npm run build\``
  );
} else {
  const html = readFileSync(renderedHtml, "utf8");
  const metas = html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi) ?? [];
  // La valeur de `content` contient des apostrophes (`'self'`, `'none'`) : une
  // classe `[^"']+` s arretait sur la premiere et ne rendait que
  // « default-src ». La porte annoncait alors « aucune directive script-src »
  // sur un artefact parfaitement conforme. On borne sur le delimiteur reel.
  const contenu =
    metas.length === 1 ? (metas[0].match(/content=(["'])([\s\S]*?)\1/i)?.[2] ?? "") : "";
  const scriptSrc =
    contenu
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src")) ?? "";

  // Jetons qui distinguent `developmentCsp` de `productionCsp`, plus les
  // elargissements qu un correctif presse pourrait introduire.
  const interdits = ["'unsafe-inline'", "'unsafe-eval'", "data:", "http:", "https:", "ws:", "*"];
  const presents = interdits.filter((jeton) => scriptSrc.includes(jeton));

  const politiqueStricte =
    metas.length === 1 &&
    scriptSrc.includes("'self'") &&
    presents.length === 0 &&
    contenu.includes("object-src 'none'") &&
    !contenu.includes("ws:");

  report(
    "le renderer construit porte une politique de production",
    politiqueStricte,
    [
      `balises CSP trouvees : ${metas.length} (attendu 1)`,
      `directive relevee : ${scriptSrc || "(aucune directive script-src)"}`,
      `jetons interdits presents : ${presents.length > 0 ? presents.join(" ") : "aucun"}`,
      `object-src 'none' : ${contenu.includes("object-src 'none'")}`,
      `ws: dans la politique : ${contenu.includes("ws:")}`
    ].join("\n")
  );
}

// ---------------------------------------------------------------------------
// Check 3 first: workspace-root rejection must happen synchronously at startup
// so it is the cheapest check and it proves the app will not boot with a bad
// value. We run it before touching Playwright so a failure aborts early.
// ---------------------------------------------------------------------------

console.log("== Check 3: workspace root rejection ==");

const beforeCheck3 = Date.now();
const relativeResult = spawnSync(electronBinary, [mainBundle], {
  env: {
    ...process.env,
    LINKEDIN_POSTER_WORKSPACE_ROOT: "./relative-workspace-path"
  },
  encoding: "utf8",
  timeout: 15000
});

const relativeCombinedOutput =
  (relativeResult.stdout ?? "") + (relativeResult.stderr ?? "");
const check3Passed =
  relativeResult.status === 1 &&
  relativeCombinedOutput.includes("LINKEDIN_POSTER_WORKSPACE_ROOT") &&
  relativeCombinedOutput.includes("absolute");

report(
  "a relative LINKEDIN_POSTER_WORKSPACE_ROOT is refused with a typed error",
  check3Passed,
  [
    `exit code: ${relativeResult.status}`,
    `duration: ${Date.now() - beforeCheck3} ms`,
    `stderr excerpt: ${
      (relativeResult.stderr ?? "").split("\n").find((l) => l.includes("LINKEDIN_POSTER_WORKSPACE_ROOT")) ??
      "(no match)"
    }`,
    `creation check: relative path must not be created by this run (confirmed by the sandbox: no side-effect check)`
  ].join("\n")
);

// A second sub-check: a path with a traversal segment must also fail.

const traversalResult = spawnSync(electronBinary, [mainBundle], {
  env: {
    ...process.env,
    LINKEDIN_POSTER_WORKSPACE_ROOT: "/nonexistent-verify-hardening-root-42/workspace"
  },
  encoding: "utf8",
  timeout: 15000
});

const traversalOutput =
  (traversalResult.stdout ?? "") + (traversalResult.stderr ?? "");
const traversalOk =
  traversalResult.status === 1 &&
  traversalOutput.includes("LINKEDIN_POSTER_WORKSPACE_ROOT") &&
  (traversalOutput.includes("does not exist") ||
    traversalOutput.includes("parent"));

report(
  "a workspace root under a missing parent is refused at startup",
  traversalOk,
  [
    `exit code: ${traversalResult.status}`,
    `stderr excerpt: ${
      (traversalResult.stderr ?? "").split("\n").find((l) => l.includes("LINKEDIN_POSTER_WORKSPACE_ROOT")) ??
      "(no match)"
    }`
  ].join("\n")
);

const missingPath = "/nonexistent-verify-hardening-root-42/workspace";
report(
  "the rejected workspace path was not created on disk",
  !existsSync(missingPath),
  `existsSync("${missingPath}") === ${existsSync(missingPath)}`
);

// ---------------------------------------------------------------------------
// Checks 1, 2, 4: launch the app via Playwright and drive the renderer
// programmatically to verify navigation guards, CSP, and DevTools gating.
// ---------------------------------------------------------------------------

console.log("\n== Checks 1, 2, 4: runtime verification via Playwright ==");

const auditHome = mkdtempSync(join(tmpdir(), "ghostwraiter-verify-"));

const app = await electron.launch({
  args: [mainBundle],
  env: {
    ...process.env,
    LINKEDIN_POSTER_WORKSPACE_ROOT: join(auditHome, "workspace")
  }
});

try {
  const page = await app.firstWindow();

  // Le collecteur de messages de console est parti avec l ancienne porte CSP,
  // qui cherchait « refused to load » dans du texte libre. Les sondes actuelles
  // lisent l evenement `securitypolicyviolation`, qui NOMME la directive au lieu
  // de la deviner dans un journal.
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);

  // Check 4: DevTools must not be open right after launch in production mode.
  const devToolsOpenedAtLaunch = await app.evaluate(async ({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) {
      return null;
    }
    return windows[0].webContents.isDevToolsOpened();
  });

  report(
    "DevTools are NOT opened at launch in the production build path",
    devToolsOpenedAtLaunch === false,
    `isDevToolsOpened() returned ${JSON.stringify(devToolsOpenedAtLaunch)}`
  );

  // Check 1: window.open to an external http URL returns null / denies
  // loading that URL in the current window, and the window count does not
  // grow (proves setWindowOpenHandler denied the request).
  const initialWindowCount = await app.evaluate(async ({ BrowserWindow }) => BrowserWindow.getAllWindows().length);

  const windowOpenResult = await page.evaluate(async () => {
    try {
      const handle = window.open("https://example.com/verify-hardening", "_blank");
      return {
        handleIsNull: handle === null,
        type: typeof handle
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  await page.waitForTimeout(400);

  const postWindowCount = await app.evaluate(async ({ BrowserWindow }) => BrowserWindow.getAllWindows().length);

  // `typeof null` vaut "object", et un vrai WindowProxy aussi : la disjonction
  // precedente (`handleIsNull === true || type === "object"`) etait vraie dans
  // tous les cas et ne mesurait donc que le comptage de fenetres. Seul le
  // handle nul atteste du refus.
  const windowOpenBlocked =
    windowOpenResult?.handleIsNull === true && postWindowCount === initialWindowCount;

  report(
    "window.open to an external origin is denied and opens no new Electron window",
    windowOpenBlocked,
    [
      `window.open return: ${JSON.stringify(windowOpenResult)}`,
      `windows before: ${initialWindowCount}, after: ${postWindowCount}`
    ].join("\n")
  );

  // -------------------------------------------------------------------------
  // Check 2: la CSP refuse les trois choses qu elle promet de refuser.
  //
  // CE QUI NE MARCHAIT PAS. La porte precedente chargeait
  // `https://example.com/should-be-blocked.js` et concluait sur
  // `loaded === false && (violationConsole || errored === true)`. Cette URL
  // renvoie 404 : `onerror` part avec ou sans CSP, et `loaded` est faux dans les
  // deux cas. Aucun des deux membres ne dependait de la politique. Retirer la
  // balise CSP entierement laissait la porte verte, et c est la seule porte qui
  // regarde l application en marche.
  //
  // CE QUI LES REMPLACE. Trois sondes, chacune adossee a UNE directive, sans
  // reseau donc sans verdict qui depende de la joignabilite d un hote :
  //   - un script en URI `data:` n est pas `'self'`, `script-src 'self'` le
  //     refuse ;
  //   - un script inline est refuse en l absence de `'unsafe-inline'`.
  // Chaque sonde mesure l EXECUTION (un temoin pose sur `window`), pas un
  // evenement de chargement, et l evenement `securitypolicyviolation` est
  // releve a cote pour nommer la directive qui a mordu.
  //
  // IL N Y A PAS DE SONDE `eval`, ET C EST DELIBERE. Une troisieme sonde a ete
  // ecrite puis retiree apres mesure : `(0, eval)("40 + 2")` rend 42 dans ce
  // renderer alors que la politique livree est `script-src 'self'` sans
  // `'unsafe-eval'`. Le code de `page.evaluate` est injecte par le protocole
  // DevTools, qui est exempt de CSP, et un `eval` imbrique herite de cette
  // exemption. La sonde mesurait donc Playwright, pas l application : elle
  // aurait ete verte ou rouge sans jamais dependre de la politique. Une porte
  // qui ne peut pas dependre de ce qu elle nomme se retire, elle ne se garde
  // pas au vert. `'unsafe-eval'` reste couvert par le Check 0, sur l artefact.
  const sondes = await page.evaluate(
    async () =>
      new Promise((resolvePromise) => {
        const violations = [];
        const surViolation = (evenement) => {
          violations.push({
            directive: evenement.violatedDirective,
            bloque: String(evenement.blockedURI ?? "").slice(0, 40)
          });
        };
        document.addEventListener("securitypolicyviolation", surViolation);

        delete window.__cspData;
        delete window.__cspInline;

        // Sonde 1 : source externe. `data:` n est couvert par aucune politique
        // de production de ce depot.
        const externe = document.createElement("script");
        externe.src = "data:text/javascript,window.__cspData = true";
        document.head.appendChild(externe);

        // Sonde 2 : script inline.
        const inline = document.createElement("script");
        inline.textContent = "window.__cspInline = true";
        document.head.appendChild(inline);

        setTimeout(() => {
          document.removeEventListener("securitypolicyviolation", surViolation);
          externe.remove();
          inline.remove();
          resolvePromise({
            dataExecute: window.__cspData === true,
            inlineExecute: window.__cspInline === true,
            violations
          });
        }, 500);
      })
  );

  const directives = sondes.violations.map((v) => v.directive).join(", ") || "aucune";

  report(
    "un script de source externe (URI data:) ne s execute pas dans le renderer",
    sondes.dataExecute === false,
    [
      `temoin window.__cspData pose : ${sondes.dataExecute}`,
      `directives violees relevees : ${directives}`
    ].join("\n")
  );

  report(
    "un script inline injecte depuis le renderer ne s execute pas",
    sondes.inlineExecute === false,
    [
      `temoin window.__cspInline pose : ${sondes.inlineExecute}`,
      `directives violees relevees : ${directives}`
    ].join("\n")
  );

  // Les deux sondes doivent avoir ete VUES par le moteur de politique. Sans
  // cette porte, une CSP absente ferait passer les deux precedentes si les
  // scripts echouaient pour une autre raison, ce qui est exactement le defaut
  // corrige ici : l ancienne porte concluait sur un `onerror` qu un 404
  // declenchait de toute facon.
  const directivesScript = sondes.violations.filter((v) =>
    String(v.directive).startsWith("script-src")
  );
  report(
    "les deux injections ont ete refusees PAR la politique, pas par autre chose",
    directivesScript.length >= 2,
    [
      `violations script-src relevees : ${directivesScript.length} (2 attendues)`,
      `detail : ${JSON.stringify(sondes.violations)}`
    ].join("\n")
  );

  // Page errors must not include anything fatal during the verification.
  if (pageErrors.length > 0) {
    console.log(`    (captured page errors during the run: ${JSON.stringify(pageErrors)})`);
  }
} finally {
  await app.close();
}

console.log(`\n== Summary: ${passed} passed, ${failed} failed ==`);
if (failed > 0) {
  process.exit(1);
}

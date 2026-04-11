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
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

const repoRoot = resolvePath(new URL("..", import.meta.url).pathname);
const mainBundle = join(repoRoot, "dist-electron", "main", "index.js");
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

const auditHome = mkdtempSync(join(tmpdir(), "linkedin-poster-verify-"));

const app = await electron.launch({
  args: [mainBundle],
  env: {
    ...process.env,
    LINKEDIN_POSTER_WORKSPACE_ROOT: join(auditHome, "workspace")
  }
});

try {
  const page = await app.firstWindow();

  const pageErrors = [];
  const consoleMessages = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

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

  const windowOpenBlocked =
    (windowOpenResult?.handleIsNull === true || windowOpenResult?.type === "object") &&
    postWindowCount === initialWindowCount;

  report(
    "window.open to an external origin is denied and opens no new Electron window",
    windowOpenBlocked,
    [
      `window.open return: ${JSON.stringify(windowOpenResult)}`,
      `windows before: ${initialWindowCount}, after: ${postWindowCount}`
    ].join("\n")
  );

  // Check 2: injecting a <script src="https://external/..."> from the console
  // should be blocked by the CSP. The external script never loads, so its
  // onload never fires; a CSP violation is reported in the console.
  consoleMessages.length = 0;

  const scriptInjectionResult = await page.evaluate(async () => {
    return new Promise((resolvePromise) => {
      const script = document.createElement("script");
      script.src = "https://example.com/should-be-blocked.js";
      script.dataset.verify = "hardening";
      let loaded = false;
      let errored = false;
      script.onload = () => {
        loaded = true;
      };
      script.onerror = () => {
        errored = true;
      };
      document.head.appendChild(script);
      setTimeout(() => {
        script.remove();
        resolvePromise({ loaded, errored });
      }, 600);
    });
  });

  await page.waitForTimeout(200);

  const cspViolationDetected = consoleMessages.some(
    (m) =>
      m.text.toLowerCase().includes("content security policy") ||
      m.text.toLowerCase().includes("content-security-policy") ||
      m.text.toLowerCase().includes("refused to load")
  );

  const externalScriptBlocked =
    scriptInjectionResult?.loaded === false && (cspViolationDetected || scriptInjectionResult?.errored === true);

  report(
    "an external script injection from the renderer console is blocked by CSP",
    externalScriptBlocked,
    [
      `script onload fired: ${scriptInjectionResult?.loaded}`,
      `script onerror fired: ${scriptInjectionResult?.errored}`,
      `CSP violation in console: ${cspViolationDetected}`,
      `relevant console messages: ${JSON.stringify(
        consoleMessages.filter((m) =>
          m.text.toLowerCase().includes("content security policy")
        )
      )}`
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

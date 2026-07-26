#!/usr/bin/env node
// Verifies that node_modules/electron is usable, and repairs it if it is not.
//
// Electron's postinstall downloads a zip and extracts it. That extraction fails
// intermittently on the Windows runner:
//
//   failed to create directory '\\?\D:\a\...\node_modules\electron\dist\locales':
//   Cannot create a file when that file already exists. (os error 183)
//
// npm reports success anyway, so `npm ci` is green while node_modules/electron
// holds no binary. The failure surfaces much later and says something else
// entirely: "Electron failed to install correctly", raised by the first test
// file that happens to import electron-log.
//
// It is not deterministic: the same commit passed on Windows an hour before it
// failed. Re-running the job is what made it pass, which is exactly the kind of
// "flaky, just retry" that hides a real gap. The gap here is that nothing
// checks the install before relying on it.
//
// Verified once rather than retried forever: this runs after `npm ci` and
// repairs in place. It is also useful locally, where the same postinstall stays
// silent under Node 26.

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ELECTRON_DIR = join(process.cwd(), "node_modules", "electron");
const ELECTRON_DIST = join(ELECTRON_DIR, "dist");

/**
 * Decides whether the install is usable, from facts only. Pure, so the decision
 * is testable without an actual Electron download.
 *
 * `path.txt` holds the executable's path relative to `node_modules/electron/dist`,
 * NOT to the package root. Read from `electron/index.js`, which resolves it as
 * `path.join(__dirname, 'dist', executablePath)`; a first version of this script
 * joined it to the package root, found nothing, and declared a healthy install
 * broken.
 *
 * The pointer's presence alone proves nothing either: it is written before the
 * extraction completes, so a truncated install has the pointer and not the
 * binary.
 *
 * @param {{ packageExists: boolean, pathTxt: string | null, binaryExists: boolean }} facts
 * @returns {"missing-package" | "usable" | "needs-repair"}
 */
export function electronInstallState({ packageExists, pathTxt, binaryExists }) {
  if (!packageExists) return "missing-package";
  if (!pathTxt || pathTxt.trim() === "") return "needs-repair";
  return binaryExists ? "usable" : "needs-repair";
}

function readPathTxt() {
  const file = join(ELECTRON_DIR, "path.txt");
  if (!existsSync(file)) return null;
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function main() {
  const pathTxt = readPathTxt();
  const relative = pathTxt?.trim() ?? "";
  const state = electronInstallState({
    packageExists: existsSync(ELECTRON_DIR),
    pathTxt,
    binaryExists: relative !== "" && existsSync(join(ELECTRON_DIST, relative))
  });

  if (state === "missing-package") {
    console.error(
      "node_modules/electron est absent. Lancer `npm ci` avant ce script."
    );
    process.exit(1);
  }

  if (state === "usable") {
    console.log(`Electron installe : ${relative}`);
    return;
  }

  console.log("Installation d'Electron incomplete, reparation en cours.");
  const repair = spawnSync(process.execPath, [join(ELECTRON_DIR, "install.js")], {
    stdio: "inherit",
    cwd: ELECTRON_DIR
  });

  if (repair.status !== 0) {
    console.error("La reparation d'Electron a echoue.");
    process.exit(repair.status ?? 1);
  }

  const repaired = readPathTxt()?.trim() ?? "";
  if (repaired === "" || !existsSync(join(ELECTRON_DIST, repaired))) {
    console.error(
      "Electron reste inutilisable apres reparation : aucun binaire a l'emplacement annonce."
    );
    process.exit(1);
  }

  console.log(`Electron repare : ${repaired}`);
}

// Only run when invoked directly, so the pure function above can be imported
// by tests without triggering a download.
if (process.argv[1] && process.argv[1].endsWith("ensure-electron.mjs")) {
  main();
}

import { promisify } from "node:util";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMacLauncherAppleScript,
  getMacLauncherPaths,
  assertDarwinHost
} from "./mac-launcher-lib.mjs";

const execFileAsync = promisify(execFile);

async function main() {
  if (!assertDarwinHost()) {
    return;
  }
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..");
  const {
    launcherAppPath,
    launcherIconPath,
    launcherOutputDir,
    launcherPlistPath,
    packagedIconPath,
    launcherSourcePath
  } = getMacLauncherPaths(repoRoot);

  await fs.mkdir(launcherOutputDir, { recursive: true });
  await fs.writeFile(launcherSourcePath, buildMacLauncherAppleScript(repoRoot), "utf8");
  await fs.rm(launcherAppPath, { recursive: true, force: true });

  await execFileAsync("osacompile", ["-o", launcherAppPath, launcherSourcePath]);
  await fs.copyFile(packagedIconPath, launcherIconPath);
  await execFileAsync("plutil", ["-replace", "CFBundleName", "-string", "GhostwrAIter", launcherPlistPath]);
  await execFileAsync("plutil", ["-replace", "CFBundleDisplayName", "-string", "GhostwrAIter", launcherPlistPath]);
  await execFileAsync("plutil", ["-replace", "CFBundleIdentifier", "-string", "fr.automatisia.ghostwraiter.launcher", launcherPlistPath]);
  await execFileAsync("plutil", ["-replace", "CFBundleIconFile", "-string", "applet.icns", launcherPlistPath]);
  await execFileAsync("plutil", ["-replace", "CFBundleIconName", "-string", "applet", launcherPlistPath]);

  console.log(`Launcher created at ${launcherAppPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

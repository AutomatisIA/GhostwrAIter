import path from "node:path";

/**
 * Gates a macOS-only helper on the current host. Returns `true` when the
 * script is running on macOS (Darwin), prints an advisory message and
 * returns `false` on any other platform. Callers should treat a `false`
 * return as a no-op success: the macOS-specific tooling is not applicable,
 * but that is not an error — it is simply a different operating system.
 *
 * Optional `platform` argument allows unit tests to simulate Windows and
 * Linux without changing the real `process.platform`.
 */
export function assertDarwinHost(platform = process.platform) {
  if (platform === "darwin") {
    return true;
  }
  console.warn(
    `[mac-launcher] macOS-only helper skipped (detected host platform: ${platform}).\n` +
      "On Windows, launch the packaged .exe produced by 'npm run package:win'.\n" +
      "On Linux, launch the AppImage produced by 'npm run package:linux'."
  );
  return false;
}

function escapeAppleScriptString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

export function getMacLauncherPaths(repoRoot) {
  const launcherOutputDir = path.join(repoRoot, "dist-launcher");
  const packagedAppPath = path.join(repoRoot, "dist-app", "mac-arm64", "GhostwrAIter.app");

  return {
    launcherOutputDir,
    launcherLogPath: path.join(launcherOutputDir, "launcher.log"),
    launcherSourcePath: path.join(launcherOutputDir, "GhostwrAIter Latest.applescript"),
    launcherAppPath: path.join(launcherOutputDir, "GhostwrAIter Launcher.app"),
    launchScriptPath: path.join(repoRoot, "scripts", "open-mac-latest.sh"),
    packagedAppPath,
    packagedIconPath: path.join(packagedAppPath, "Contents", "Resources", "electron.icns"),
    launcherIconPath: path.join(
      launcherOutputDir,
      "GhostwrAIter Launcher.app",
      "Contents",
      "Resources",
      "applet.icns"
    ),
    launcherPlistPath: path.join(
      launcherOutputDir,
      "GhostwrAIter Launcher.app",
      "Contents",
      "Info.plist"
    )
  };
}

export function buildMacLauncherShellCommand(repoRoot) {
  const { launchScriptPath, launcherLogPath } = getMacLauncherPaths(repoRoot);

  return `/bin/zsh -lc '"${launchScriptPath}" >> "${launcherLogPath}" 2>&1 &'`;
}

export function buildMacLauncherAppleScript(repoRoot) {
  const shellCommand = buildMacLauncherShellCommand(repoRoot);

  return `on run
  do shell script "${escapeAppleScriptString(shellCommand)}"
  display notification "Construction de la derniere version locale..." with title "GhostwrAIter Latest"
end run
`;
}

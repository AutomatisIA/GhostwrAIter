import path from "node:path";

function escapeAppleScriptString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

export function getMacLauncherPaths(repoRoot) {
  const launcherOutputDir = path.join(repoRoot, "dist-launcher");
  const packagedAppPath = path.join(repoRoot, "dist-app", "mac-arm64", "LinkedIn Poster.app");

  return {
    launcherOutputDir,
    launcherLogPath: path.join(launcherOutputDir, "launcher.log"),
    launcherSourcePath: path.join(launcherOutputDir, "LinkedIn Poster Latest.applescript"),
    launcherAppPath: path.join(launcherOutputDir, "LinkedIn Poster Launcher.app"),
    launchScriptPath: path.join(repoRoot, "scripts", "open-mac-latest.sh"),
    packagedAppPath,
    packagedIconPath: path.join(packagedAppPath, "Contents", "Resources", "electron.icns"),
    launcherIconPath: path.join(
      launcherOutputDir,
      "LinkedIn Poster Launcher.app",
      "Contents",
      "Resources",
      "applet.icns"
    ),
    launcherPlistPath: path.join(
      launcherOutputDir,
      "LinkedIn Poster Launcher.app",
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
  display notification "Construction de la derniere version locale..." with title "LinkedIn Poster Latest"
end run
`;
}

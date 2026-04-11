import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertDarwinHost,
  buildMacLauncherAppleScript,
  buildMacLauncherShellCommand,
  getMacLauncherPaths
} from "../../scripts/mac-launcher-lib.mjs";

describe.skipIf(process.platform === "win32")("mac launcher helpers", () => {
  it("builds stable launcher paths inside the repository", () => {
    const repoRoot = "/tmp/linkedin-poster";
    const paths = getMacLauncherPaths(repoRoot);

    expect(paths.launcherOutputDir).toBe("/tmp/linkedin-poster/dist-launcher");
    expect(paths.launchScriptPath).toBe("/tmp/linkedin-poster/scripts/open-mac-latest.sh");
    expect(paths.launcherAppPath).toBe(
      "/tmp/linkedin-poster/dist-launcher/LinkedIn Poster Launcher.app"
    );
    expect(paths.packagedIconPath).toBe(
      "/tmp/linkedin-poster/dist-app/mac-arm64/LinkedIn Poster.app/Contents/Resources/electron.icns"
    );
    expect(paths.launcherIconPath).toBe(
      "/tmp/linkedin-poster/dist-launcher/LinkedIn Poster Launcher.app/Contents/Resources/applet.icns"
    );
  });

  it("builds an AppleScript launcher that targets the latest local build flow", () => {
    const repoRoot = "/tmp/linkedin-poster";
    const shellCommand = buildMacLauncherShellCommand(repoRoot);
    const appleScript = buildMacLauncherAppleScript(repoRoot);

    expect(shellCommand).toContain(
      '"/tmp/linkedin-poster/scripts/open-mac-latest.sh" >> "/tmp/linkedin-poster/dist-launcher/launcher.log" 2>&1 &'
    );
    expect(appleScript).toContain("do shell script");
    expect(appleScript).toContain(path.join(repoRoot, "scripts", "open-mac-latest.sh"));
    expect(appleScript).toContain("LinkedIn Poster Latest");
  });
});

describe("assertDarwinHost cross-platform guard", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns true on darwin without warning", () => {
    const result = assertDarwinHost("darwin");
    expect(result).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns false on linux and prints an advisory", () => {
    const result = assertDarwinHost("linux");
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("macOS-only");
    expect(warnSpy.mock.calls[0]?.[0]).toContain("linux");
  });

  it("returns false on win32 and prints an advisory", () => {
    const result = assertDarwinHost("win32");
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("macOS-only");
  });
});

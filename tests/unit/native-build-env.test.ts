import { describe, expect, it } from "vitest";
// Plain ESM helper, resolved through `allowJs` in tsconfig.node.json, like
// scripts/mac-launcher-lib.mjs.
import { resolveNativeBuildEnv } from "../../scripts/native-build-env.mjs";

/**
 * The `cc` on this developer's machine is a launcher for Claude Code, not a
 * compiler. node-gyp inherits it and dies on `error: unknown option '-o'`,
 * an error that names neither `cc` nor the launcher. The workaround had to be
 * remembered and typed on every session.
 *
 * These fixtures are the real outputs, captured rather than invented: the
 * point of the detection is to tell them apart.
 */
const CLANG_VERSION_OUTPUT = `Apple clang version 17.0.0 (clang-1700.0.13.5)
Target: arm64-apple-darwin25.5.0
Thread model: posix
InstalledDir: /Library/Developer/CommandLineTools/usr/bin`;

const GCC_VERSION_OUTPUT = `gcc (GCC) 14.2.1 20240912
Copyright (C) 2024 Free Software Foundation, Inc.`;

const LAUNCHER_OUTPUT = `Claude Code 2.1.4 (Claude Code)`;

function build(overrides: Record<string, unknown> = {}) {
  return resolveNativeBuildEnv({
    env: {},
    platform: "darwin",
    fileExists: (path: string) =>
      path === "/usr/bin/python3" || path === "/usr/bin/clang",
    probeCompiler: () => CLANG_VERSION_OUTPUT,
    ...overrides
  });
}

describe("native module build environment", () => {
  it("pins clang when the cc on PATH is not a compiler", () => {
    const { env, notes } = build({ probeCompiler: () => LAUNCHER_OUTPUT });

    expect(env.CC).toBe("/usr/bin/clang");
    expect(env.CXX).toBe("/usr/bin/clang++");
    // The substitution has to be visible in the output: a build that silently
    // changes compiler is a surprise for the next session.
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("/usr/bin/clang");
  });

  it("leaves everything alone when cc answers like a real compiler", () => {
    for (const output of [CLANG_VERSION_OUTPUT, GCC_VERSION_OUTPUT]) {
      const { env, notes } = build({ probeCompiler: () => output });

      expect(env.CC).toBeUndefined();
      expect(env.CXX).toBeUndefined();
      expect(notes).toEqual([]);
    }
  });

  it("honours a CC chosen by the caller, even when cc is a launcher", () => {
    const { env, notes } = build({
      env: { CC: "/opt/homebrew/bin/gcc-14" },
      probeCompiler: () => LAUNCHER_OUTPUT
    });

    expect(env.CC).toBe("/opt/homebrew/bin/gcc-14");
    expect(env.CXX).toBeUndefined();
    expect(notes).toEqual([]);
  });

  it("pins nothing when clang is absent from the machine", () => {
    const { env } = build({
      fileExists: (path: string) => path === "/usr/bin/python3",
      probeCompiler: () => LAUNCHER_OUTPUT
    });

    expect(env.CC).toBeUndefined();
  });

  it("pins Python when /usr/bin/python3 exists", () => {
    expect(build().env.PYTHON).toBe("/usr/bin/python3");
    expect(build({ fileExists: () => false }).env.PYTHON).toBeUndefined();
  });

  // On Windows neither the POSIX path nor `cc` exists: node-gyp finds Python
  // through PATH and the registry, and the compiler through MSVC.
  it("leaves everything alone on Windows", () => {
    let probes = 0;
    const { env, notes } = build({
      platform: "win32",
      env: { PATH: "C:\\Windows" },
      probeCompiler: () => {
        probes += 1;
        return LAUNCHER_OUTPUT;
      }
    });

    expect(env).toEqual({ PATH: "C:\\Windows" });
    expect(notes).toEqual([]);
    // No probe is run: pointless here, and `cc --version` under cmd would print
    // an error into the CI logs for nothing.
    expect(probes).toBe(0);
  });
});

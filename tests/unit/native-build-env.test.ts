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

describe("environnement de compilation du module natif", () => {
  it("force clang quand le cc du PATH n'est pas un compilateur", () => {
    const { env, notes } = build({ probeCompiler: () => LAUNCHER_OUTPUT });

    expect(env.CC).toBe("/usr/bin/clang");
    expect(env.CXX).toBe("/usr/bin/clang++");
    // Le contournement doit se voir dans la sortie : une compilation qui
    // change de compilateur en silence est une surprise pour la session
    // suivante.
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("/usr/bin/clang");
  });

  it("ne touche a rien quand cc repond comme un vrai compilateur", () => {
    for (const sortie of [CLANG_VERSION_OUTPUT, GCC_VERSION_OUTPUT]) {
      const { env, notes } = build({ probeCompiler: () => sortie });

      expect(env.CC).toBeUndefined();
      expect(env.CXX).toBeUndefined();
      expect(notes).toEqual([]);
    }
  });

  it("respecte un CC choisi par l'appelant, meme si cc est un lanceur", () => {
    const { env, notes } = build({
      env: { CC: "/opt/homebrew/bin/gcc-14" },
      probeCompiler: () => LAUNCHER_OUTPUT
    });

    expect(env.CC).toBe("/opt/homebrew/bin/gcc-14");
    expect(env.CXX).toBeUndefined();
    expect(notes).toEqual([]);
  });

  it("ne force rien quand clang est absent de la machine", () => {
    const { env } = build({
      fileExists: (path: string) => path === "/usr/bin/python3",
      probeCompiler: () => LAUNCHER_OUTPUT
    });

    expect(env.CC).toBeUndefined();
  });

  it("epingle Python quand /usr/bin/python3 existe", () => {
    expect(build().env.PYTHON).toBe("/usr/bin/python3");
    expect(build({ fileExists: () => false }).env.PYTHON).toBeUndefined();
  });

  // Sur Windows ni le chemin POSIX ni `cc` n'existent : node-gyp trouve Python
  // par le PATH et le registre, et le compilateur par MSVC.
  it("ne touche a rien sur Windows", () => {
    let sondages = 0;
    const { env, notes } = build({
      platform: "win32",
      env: { PATH: "C:\\Windows" },
      probeCompiler: () => {
        sondages += 1;
        return LAUNCHER_OUTPUT;
      }
    });

    expect(env).toEqual({ PATH: "C:\\Windows" });
    expect(notes).toEqual([]);
    // Aucun sondage lance : inutile, et `cc --version` sous cmd afficherait
    // une erreur dans les journaux de CI pour rien.
    expect(sondages).toBe(0);
  });
});

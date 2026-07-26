/**
 * Environment used to rebuild the native module (better-sqlite3) with node-gyp.
 *
 * Two host quirks are handled here, both of which produce errors that say
 * nothing about their cause. The logic is a pure function so it can be tested
 * without running an actual rebuild: every host fact it depends on is injected.
 */

/** Output of a compiler responding to `--version` looks like one of these. */
const COMPILER_SIGNATURE = /\b(clang|gcc|g\+\+|Free Software Foundation)\b/i;

/**
 * Builds the environment for `npm rebuild better-sqlite3`.
 *
 * `PYTHON` is pinned when `/usr/bin/python3` exists, because a host with
 * several Python installations can hand node-gyp the wrong one. On Windows the
 * path does not exist and node-gyp finds Python through PATH and the registry.
 *
 * `CC`/`CXX` are pinned only when the `cc` on PATH does not answer like a
 * compiler. On this developer's machine `~/.local/bin/cc` is a launcher for
 * Claude Code, so node-gyp inherits it and dies on:
 *
 *     error: unknown option '-o'
 *     make: *** [Release/obj.target/sqlite3/gen/sqlite3/sqlite3.o] Error 1
 *
 * Nothing in that output names `cc`, and the workaround (prefixing every call
 * with `CC=/usr/bin/clang`) has to be remembered every session.
 *
 * The probe matters: pinning clang unconditionally would override a host whose
 * toolchain is deliberately something else, and an explicit `CC` from the
 * caller always wins.
 *
 * @param {object} deps
 * @param {NodeJS.ProcessEnv} deps.env      environment to start from
 * @param {string} deps.platform            value of `os.platform()`
 * @param {(path: string) => boolean} deps.fileExists
 * @param {() => string} deps.probeCompiler  combined stdout+stderr of `cc --version`
 * @returns {{ env: NodeJS.ProcessEnv, notes: string[] }}
 */
export function resolveNativeBuildEnv({ env, platform, fileExists, probeCompiler }) {
  const result = { ...env };
  const notes = [];

  if (platform === "win32") {
    return { env: result, notes };
  }

  if (fileExists("/usr/bin/python3")) {
    result.PYTHON = "/usr/bin/python3";
  }

  // An explicit choice by the caller is never second-guessed.
  if (result.CC) {
    return { env: result, notes };
  }

  if (!fileExists("/usr/bin/clang")) {
    return { env: result, notes };
  }

  if (COMPILER_SIGNATURE.test(probeCompiler())) {
    return { env: result, notes };
  }

  result.CC = "/usr/bin/clang";
  result.CXX = "/usr/bin/clang++";
  notes.push(
    "Le `cc` du PATH ne repond pas comme un compilateur : compilation forcee sur /usr/bin/clang."
  );
  return { env: result, notes };
}

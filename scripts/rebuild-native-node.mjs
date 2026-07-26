#!/usr/bin/env node
// Cross-platform wrapper for `npm rebuild better-sqlite3`.
//
// The environment handed to node-gyp is computed by `resolveNativeBuildEnv`,
// a pure function covered by tests/unit/native-build-env.test.ts. It pins
// Python when several installations may be present, and pins clang when the
// `cc` on PATH turns out not to be a compiler at all.
//
// Uses spawnSync with shell:true so that `npm` resolves to `npm.cmd` on
// Windows (CVE-2024-27980 hardening prevents Node from executing .cmd files
// directly). The command and arguments are fully hardcoded, and no external
// input flows into the shell, so there is no injection surface.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { platform } from "node:os";
import { resolveNativeBuildEnv } from "./native-build-env.mjs";

const { env, notes } = resolveNativeBuildEnv({
  env: process.env,
  platform: platform(),
  fileExists: existsSync,
  probeCompiler: () => {
    // A missing or non-executable `cc` yields no output; that reads as "does
    // not answer like a compiler", which is exactly the case being detected.
    const probe = spawnSync("cc", ["--version"], { encoding: "utf8", shell: true });
    return `${probe.stdout ?? ""}${probe.stderr ?? ""}`;
  }
});

for (const note of notes) {
  console.log(note);
}

const result = spawnSync("npm", ["rebuild", "better-sqlite3"], {
  stdio: "inherit",
  env,
  shell: true
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);

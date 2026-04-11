#!/usr/bin/env node
// Cross-platform wrapper for `npm rebuild better-sqlite3`.
//
// On macOS and Linux we force PYTHON=/usr/bin/python3 when that binary exists,
// because some systems have several Python installations and node-gyp needs
// the right one. On Windows the POSIX-style env-var-prefix syntax is not
// recognised by cmd/PowerShell, and /usr/bin/python3 does not exist anyway —
// node-gyp on Windows discovers Python via PATH and the Windows registry.
//
// Uses spawnSync with shell:true so that `npm` resolves to `npm.cmd` on
// Windows (CVE-2024-27980 hardening prevents Node from executing .cmd files
// directly). The command and arguments are fully hardcoded — no external
// input flows into the shell, so there is no injection surface.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { platform } from "node:os";

const isWindows = platform() === "win32";
const env = { ...process.env };

if (!isWindows && existsSync("/usr/bin/python3")) {
  env.PYTHON = "/usr/bin/python3";
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

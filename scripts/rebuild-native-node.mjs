#!/usr/bin/env node
// Cross-platform wrapper for `npm rebuild better-sqlite3`.
//
// On macOS and Linux we force PYTHON=/usr/bin/python3 when that binary exists,
// because some systems have several Python installations and node-gyp needs
// the right one. On Windows the POSIX-style env-var-prefix syntax is not
// recognised by cmd/PowerShell, and /usr/bin/python3 does not exist anyway —
// node-gyp on Windows discovers Python via PATH and the Windows registry.
//
// This wrapper keeps the same npm script name (`rebuild:native:node`) so
// nothing upstream changes, while making the gate cross-OS green.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { platform } from "node:os";

const isWindows = platform() === "win32";
const env = { ...process.env };

if (!isWindows && existsSync("/usr/bin/python3")) {
  env.PYTHON = "/usr/bin/python3";
}

const npmCommand = isWindows ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["rebuild", "better-sqlite3"], {
  stdio: "inherit",
  env,
  shell: false
});

process.exit(result.status ?? 1);

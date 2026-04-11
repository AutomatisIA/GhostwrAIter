import { existsSync as defaultExistsSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { join } from "node:path";

/**
 * Injectable dependencies for cross-platform Codex CLI detection. All four
 * are optional and default to the corresponding host-environment values.
 * The injection surface lets unit tests simulate every supported platform
 * without touching the real filesystem.
 */
export type FindCodexBinaryDeps = {
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly existsSync?: (path: string) => boolean;
  readonly homedir?: () => string;
};

type Resolved = {
  readonly env: NodeJS.ProcessEnv;
  readonly platform: NodeJS.Platform;
  readonly existsSync: (path: string) => boolean;
  readonly homedir: () => string;
};

function resolveDeps(deps: FindCodexBinaryDeps | undefined): Resolved {
  return {
    env: deps?.env ?? process.env,
    platform: deps?.platform ?? process.platform,
    existsSync: deps?.existsSync ?? defaultExistsSync,
    homedir: deps?.homedir ?? defaultHomedir
  };
}

function splitPath(rawPath: string | undefined, separator: string): string[] {
  if (!rawPath) {
    return [];
  }
  return rawPath
    .split(separator)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function darwinCandidates(resolved: Resolved): string[] {
  const home = safeHomedir(resolved);
  return [
    ...splitPath(resolved.env.PATH, ":"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    home ? join(home, ".local/bin") : ""
  ].filter((entry): entry is string => entry.length > 0);
}

function linuxCandidates(resolved: Resolved): string[] {
  const home = safeHomedir(resolved);
  return [
    ...splitPath(resolved.env.PATH, ":"),
    "/usr/local/bin",
    "/usr/bin",
    home ? join(home, ".local/bin") : ""
  ].filter((entry): entry is string => entry.length > 0);
}

function windowsCandidates(resolved: Resolved): string[] {
  const home = safeHomedir(resolved);
  const candidates: string[] = [...splitPath(resolved.env.PATH, ";")];

  const programFiles = resolved.env.ProgramFiles;
  if (programFiles && programFiles.length > 0) {
    candidates.push(`${programFiles}\\Codex\\bin`);
  }

  const localAppData = resolved.env.LOCALAPPDATA;
  if (localAppData && localAppData.length > 0) {
    candidates.push(`${localAppData}\\Programs\\codex`);
  } else if (home && home.length > 0) {
    candidates.push(`${home}\\AppData\\Local\\Programs\\codex`);
  }

  return candidates;
}

function safeHomedir(resolved: Resolved): string {
  try {
    return resolved.homedir();
  } catch {
    return "";
  }
}

function dedupe(entries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of entries) {
    if (!seen.has(entry)) {
      seen.add(entry);
      out.push(entry);
    }
  }
  return out;
}

function probeUnixCandidates(
  candidates: string[],
  existsSync: (path: string) => boolean
): string | null {
  for (const directory of dedupe(candidates)) {
    const candidate = `${directory}/codex`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function probeWindowsCandidates(
  candidates: string[],
  existsSync: (path: string) => boolean
): string | null {
  for (const directory of dedupe(candidates)) {
    const dot = `${directory}\\codex.exe`;
    if (existsSync(dot)) {
      return dot;
    }
    const bare = `${directory}\\codex`;
    if (existsSync(bare)) {
      return bare;
    }
  }
  return null;
}

/**
 * Finds the Codex CLI binary on the host operating system without executing
 * it. Returns the absolute path to the first existing candidate, or `null`
 * if no candidate is found. Callers may use the returned path as argv[0] of
 * a child process invocation, or fall back to the bare name "codex" so the
 * shell PATH resolution handles the lookup as a last resort.
 *
 * Lookup order per platform is documented in
 * `specs/004-cross-platform-portability/contracts/codex-binary-detection.md`.
 */
export function findCodexBinary(deps?: FindCodexBinaryDeps): string | null {
  const resolved = resolveDeps(deps);

  if (resolved.platform === "win32") {
    return probeWindowsCandidates(windowsCandidates(resolved), resolved.existsSync);
  }
  if (resolved.platform === "darwin") {
    return probeUnixCandidates(darwinCandidates(resolved), resolved.existsSync);
  }
  // linux and every other Unix-like platform (freebsd, openbsd, sunos, aix, …)
  return probeUnixCandidates(linuxCandidates(resolved), resolved.existsSync);
}

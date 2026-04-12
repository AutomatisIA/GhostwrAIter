import { existsSync as defaultExistsSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { join } from "node:path";

export type FindCliBinaryDeps = {
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

function resolveDeps(deps: FindCliBinaryDeps | undefined): Resolved {
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

function safeHomedir(resolved: Resolved): string {
  try {
    return resolved.homedir();
  } catch {
    return "";
  }
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
    candidates.push(`${programFiles}\\nodejs`);
  }

  const localAppData = resolved.env.LOCALAPPDATA;
  if (localAppData && localAppData.length > 0) {
    candidates.push(`${localAppData}\\Programs\\nodejs`);
  } else if (home && home.length > 0) {
    candidates.push(`${home}\\AppData\\Local\\Programs\\nodejs`);
  }

  return candidates;
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
  binaryName: string,
  candidates: string[],
  existsSync: (path: string) => boolean
): string | null {
  for (const directory of dedupe(candidates)) {
    const candidate = `${directory}/${binaryName}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function probeWindowsCandidates(
  binaryName: string,
  candidates: string[],
  existsSync: (path: string) => boolean
): string | null {
  for (const directory of dedupe(candidates)) {
    const dot = `${directory}\\${binaryName}.exe`;
    if (existsSync(dot)) {
      return dot;
    }
    const bare = `${directory}\\${binaryName}`;
    if (existsSync(bare)) {
      return bare;
    }
  }
  return null;
}

/**
 * Generic CLI binary finder. Same cross-platform detection logic as
 * `findCodexBinary` but parameterised by binary name so it works for
 * any CLI engine (codex, claude, gemini).
 */
export function findCliBinary(binaryName: string, deps?: FindCliBinaryDeps): string | null {
  const resolved = resolveDeps(deps);

  if (resolved.platform === "win32") {
    return probeWindowsCandidates(binaryName, windowsCandidates(resolved), resolved.existsSync);
  }
  if (resolved.platform === "darwin") {
    return probeUnixCandidates(binaryName, darwinCandidates(resolved), resolved.existsSync);
  }
  return probeUnixCandidates(binaryName, linuxCandidates(resolved), resolved.existsSync);
}

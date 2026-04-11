import { accessSync, constants as fsConstants, existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve as resolvePath, sep } from "node:path";

export type WorkspacePaths = {
  rootDirectory: string;
  contentDirectory: string;
  dataDirectory: string;
  logsDirectory: string;
  skillsDirectory: string;
  databasePath: string;
};

/**
 * Thrown synchronously by resolveWorkspaceRoot() when the environment variable
 * LINKEDIN_POSTER_WORKSPACE_ROOT is set to a value that fails validation.
 *
 * The caller in app/main/index.ts is responsible for catching this error,
 * logging it, and aborting startup with a non-zero exit code. No silent
 * fallback to the default path is allowed.
 */
export class WorkspaceConfigurationError extends Error {
  readonly reason: "NOT_ABSOLUTE" | "TRAVERSAL_SEGMENT" | "PARENT_NOT_FOUND" | "PARENT_NOT_WRITABLE";
  readonly value: string;

  constructor(
    reason: "NOT_ABSOLUTE" | "TRAVERSAL_SEGMENT" | "PARENT_NOT_FOUND" | "PARENT_NOT_WRITABLE",
    value: string,
    message: string
  ) {
    super(message);
    this.name = "WorkspaceConfigurationError";
    this.reason = reason;
    this.value = value;
  }
}

/**
 * Thrown by assertUnderRoot() when a path candidate resolves outside the
 * declared workspace root. Used as defense in depth by any future path
 * builder that handles dynamic input.
 */
export class WorkspacePathEscapeError extends Error {
  readonly candidate: string;
  readonly root: string;

  constructor(candidate: string, root: string) {
    super(
      `Refusing to operate outside the workspace root. Candidate: "${candidate}", root: "${root}".`
    );
    this.name = "WorkspacePathEscapeError";
    this.candidate = candidate;
    this.root = root;
  }
}

const requiredDirectories = [
  "content",
  "content/strategy",
  "content/ideas",
  "content/drafts",
  "content/published",
  "content/research",
  "content/exports",
  "data",
  "logs",
  "logs/executions",
  "skills",
  "config"
];

function isWritable(path: string): boolean {
  try {
    accessSync(path, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the absolute workspace root for the running application.
 *
 * When the environment variable LINKEDIN_POSTER_WORKSPACE_ROOT is absent or
 * empty, the default location under `userDataPath/workspace` is returned
 * unchanged. When the variable is present, it is validated against the rules
 * enumerated in specs/002-security-hardening/contracts/workspace-validation-error.md
 * and a WorkspaceConfigurationError is thrown on any rule failure.
 *
 * Rules applied in order:
 *
 *   1. Absent / empty  → default path.
 *   2. Must be absolute (path.isAbsolute). Fails with NOT_ABSOLUTE.
 *   3. After path.resolve the normalized form must not contain any `..`
 *      segment. Fails with TRAVERSAL_SEGMENT.
 *   4. The parent of the normalized path must exist. Fails with
 *      PARENT_NOT_FOUND.
 *   5. The parent must be writable by the current user. Fails with
 *      PARENT_NOT_WRITABLE.
 */
export function resolveWorkspaceRoot(
  userDataPath: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const raw = env.LINKEDIN_POSTER_WORKSPACE_ROOT;

  if (raw === undefined || raw === null || raw === "") {
    return join(userDataPath, "workspace");
  }

  if (!isAbsolute(raw)) {
    throw new WorkspaceConfigurationError(
      "NOT_ABSOLUTE",
      raw,
      `LINKEDIN_POSTER_WORKSPACE_ROOT must be an absolute path; got "${raw}". ` +
        "Provide a full path starting at the filesystem root."
    );
  }

  const normalized = resolvePath(raw);

  if (normalized.split(sep).includes("..")) {
    throw new WorkspaceConfigurationError(
      "TRAVERSAL_SEGMENT",
      raw,
      `LINKEDIN_POSTER_WORKSPACE_ROOT resolved to "${normalized}" which contains a traversal segment. ` +
        "Provide a canonical path."
    );
  }

  const parent = dirname(normalized);
  if (!existsSync(parent)) {
    throw new WorkspaceConfigurationError(
      "PARENT_NOT_FOUND",
      raw,
      `LINKEDIN_POSTER_WORKSPACE_ROOT points to "${normalized}" but its parent "${parent}" does not exist. ` +
        "Create the parent directory or pick a different path."
    );
  }

  if (!isWritable(parent)) {
    throw new WorkspaceConfigurationError(
      "PARENT_NOT_WRITABLE",
      raw,
      `LINKEDIN_POSTER_WORKSPACE_ROOT points to "${normalized}" but its parent "${parent}" is not writable by the current user. ` +
        "Pick a path under a writable directory."
    );
  }

  return normalized;
}

/**
 * Defense-in-depth helper: returns the resolved candidate if it is the
 * declared root itself or a descendant of it, otherwise throws
 * WorkspacePathEscapeError. Pure path computation, no filesystem I/O.
 */
export function assertUnderRoot(candidate: string, root: string): string {
  const resolvedRoot = resolvePath(root);
  const resolvedCandidate = resolvePath(candidate);

  if (resolvedCandidate === resolvedRoot) {
    return resolvedCandidate;
  }

  const rootWithSeparator = resolvedRoot.endsWith(sep) ? resolvedRoot : `${resolvedRoot}${sep}`;

  if (resolvedCandidate.startsWith(rootWithSeparator)) {
    return resolvedCandidate;
  }

  throw new WorkspacePathEscapeError(candidate, root);
}

export function createWorkspaceService(rootDirectory: string) {
  function ensureWorkspace(): WorkspacePaths {
    for (const directory of requiredDirectories) {
      mkdirSync(join(rootDirectory, directory), { recursive: true });
    }

    return {
      rootDirectory,
      contentDirectory: join(rootDirectory, "content"),
      dataDirectory: join(rootDirectory, "data"),
      logsDirectory: join(rootDirectory, "logs"),
      skillsDirectory: join(rootDirectory, "skills"),
      databasePath: join(rootDirectory, "data", "linkedin-poster.db")
    };
  }

  function workspaceExists() {
    return existsSync(join(rootDirectory, "data"));
  }

  return {
    ensureWorkspace,
    workspaceExists
  };
}

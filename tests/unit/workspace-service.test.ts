import { chmodSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertUnderRoot,
  createWorkspaceService,
  resolveWorkspaceRoot,
  WorkspaceConfigurationError,
  WorkspacePathEscapeError,
  type WorkspacePaths
} from "../../app/main/workspace/workspace.service";

describe("workspace service", () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    while (tempDirectories.length > 0) {
      const directory = tempDirectories.pop();
      if (directory) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it("creates the expected local-first workspace tree", () => {
    const root = mkdtempSync(join(tmpdir(), "linkedin-poster-workspace-"));
    tempDirectories.push(root);

    const service = createWorkspaceService(root);
    const paths = service.ensureWorkspace();

    expect(paths.dataDirectory).toBe(join(root, "data"));
    expect(paths.contentDirectory).toBe(join(root, "content"));
    expect(paths.logsDirectory).toBe(join(root, "logs"));
    expect(paths.databasePath).toBe(join(root, "data", "linkedin-poster.db"));
    expect(service.workspaceExists()).toBe(true);
  });

  it("returns stable paths across repeated initialization", () => {
    const root = mkdtempSync(join(tmpdir(), "linkedin-poster-workspace-"));
    tempDirectories.push(root);

    const service = createWorkspaceService(root);
    const first = service.ensureWorkspace();
    const second = service.ensureWorkspace();

    expect(second).toEqual(first satisfies WorkspacePaths);
  });

  it("supports overriding the workspace root from the environment", () => {
    const userDataRoot = mkdtempSync(join(tmpdir(), "linkedin-poster-userdata-"));
    tempDirectories.push(userDataRoot);
    const overrideParent = mkdtempSync(join(tmpdir(), "linkedin-poster-override-"));
    tempDirectories.push(overrideParent);
    const overrideRoot = join(overrideParent, "workspace");

    expect(resolveWorkspaceRoot(userDataRoot, {})).toBe(join(userDataRoot, "workspace"));
    expect(
      resolveWorkspaceRoot(userDataRoot, {
        LINKEDIN_POSTER_WORKSPACE_ROOT: overrideRoot
      })
    ).toBe(overrideRoot);
  });
});

describe("resolveWorkspaceRoot — validation (FR-012, FR-013)", () => {
  const tempDirectories: string[] = [];
  let userDataRoot: string;

  beforeEach(() => {
    userDataRoot = mkdtempSync(join(tmpdir(), "linkedin-poster-validation-userdata-"));
    tempDirectories.push(userDataRoot);
  });

  afterEach(() => {
    while (tempDirectories.length > 0) {
      const directory = tempDirectories.pop();
      if (directory) {
        try {
          chmodSync(directory, 0o700);
        } catch {
          // best-effort restore so rmSync can clean up
        }
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it("returns the default path when the variable is absent", () => {
    const result = resolveWorkspaceRoot(userDataRoot, {});
    expect(result).toBe(join(userDataRoot, "workspace"));
  });

  it("returns the default path when the variable is an empty string", () => {
    const result = resolveWorkspaceRoot(userDataRoot, { LINKEDIN_POSTER_WORKSPACE_ROOT: "" });
    expect(result).toBe(join(userDataRoot, "workspace"));
  });

  it("rejects a relative path with NOT_ABSOLUTE", () => {
    expect(() =>
      resolveWorkspaceRoot(userDataRoot, { LINKEDIN_POSTER_WORKSPACE_ROOT: "./relative" })
    ).toThrow(WorkspaceConfigurationError);

    try {
      resolveWorkspaceRoot(userDataRoot, { LINKEDIN_POSTER_WORKSPACE_ROOT: "./relative" });
    } catch (err) {
      expect(err).toBeInstanceOf(WorkspaceConfigurationError);
      expect((err as WorkspaceConfigurationError).reason).toBe("NOT_ABSOLUTE");
      expect((err as WorkspaceConfigurationError).value).toBe("./relative");
      expect((err as WorkspaceConfigurationError).message).toContain("LINKEDIN_POSTER_WORKSPACE_ROOT");
      expect((err as WorkspaceConfigurationError).message).toContain("absolute");
    }
  });

  it("rejects a path whose parent does not exist with PARENT_NOT_FOUND", () => {
    const missing = "/nonexistent-parent-for-workspace-test-42/child/workspace";
    try {
      resolveWorkspaceRoot(userDataRoot, { LINKEDIN_POSTER_WORKSPACE_ROOT: missing });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WorkspaceConfigurationError);
      expect((err as WorkspaceConfigurationError).reason).toBe("PARENT_NOT_FOUND");
      expect((err as WorkspaceConfigurationError).value).toBe(missing);
    }
  });

  it("accepts a valid absolute path under a writable existing parent", () => {
    const parent = mkdtempSync(join(tmpdir(), "linkedin-poster-parent-ok-"));
    tempDirectories.push(parent);
    const candidate = join(parent, "workspace");

    const result = resolveWorkspaceRoot(userDataRoot, {
      LINKEDIN_POSTER_WORKSPACE_ROOT: candidate
    });

    expect(result).toBe(candidate);
  });

  it("rejects a path whose parent is not writable with PARENT_NOT_WRITABLE", () => {
    if (process.getuid && process.getuid() === 0) {
      // root can write to any directory, skip this case
      return;
    }
    const readOnlyParent = mkdtempSync(join(tmpdir(), "linkedin-poster-readonly-"));
    tempDirectories.push(readOnlyParent);
    chmodSync(readOnlyParent, 0o500);
    const candidate = join(readOnlyParent, "workspace");

    try {
      resolveWorkspaceRoot(userDataRoot, { LINKEDIN_POSTER_WORKSPACE_ROOT: candidate });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WorkspaceConfigurationError);
      expect((err as WorkspaceConfigurationError).reason).toBe("PARENT_NOT_WRITABLE");
    }
  });
});

describe("assertUnderRoot — path-traversal defense helper", () => {
  const tempDirectories: string[] = [];
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "linkedin-poster-assert-"));
    tempDirectories.push(root);
    mkdirSync(join(root, "subdir"), { recursive: true });
  });

  afterEach(() => {
    while (tempDirectories.length > 0) {
      const directory = tempDirectories.pop();
      if (directory) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it("returns the resolved candidate when it is equal to the root", () => {
    const result = assertUnderRoot(root, root);
    expect(result).toBe(root);
  });

  it("returns the resolved candidate when it is a direct descendant of the root", () => {
    const candidate = join(root, "subdir");
    const result = assertUnderRoot(candidate, root);
    expect(result).toBe(candidate);
  });

  it("returns the resolved candidate when it is a nested descendant of the root", () => {
    const candidate = join(root, "subdir", "nested", "file.txt");
    const result = assertUnderRoot(candidate, root);
    expect(result).toBe(candidate);
  });

  it("throws WorkspacePathEscapeError when the candidate is outside the root", () => {
    const escaping = join(root, "..", "elsewhere");
    expect(() => assertUnderRoot(escaping, root)).toThrow(WorkspacePathEscapeError);
  });

  it("throws WorkspacePathEscapeError when the candidate resolves to a sibling", () => {
    const sibling = `${root}-sibling`;
    expect(() => assertUnderRoot(sibling, root)).toThrow(WorkspacePathEscapeError);
  });
});

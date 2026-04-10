import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  createWorkspaceService,
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
});

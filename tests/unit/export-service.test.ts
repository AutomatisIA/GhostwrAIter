import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ExportService } from "../../app/main/domains/export/export.service";

describe("export service", () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    while (tempDirectories.length > 0) {
      const directory = tempDirectories.pop();
      if (directory) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it("creates a workspace snapshot file including execution log metadata", () => {
    const root = mkdtempSync(join(tmpdir(), "ghostwraiter-export-"));
    const exportsDir = join(root, "content", "exports");
    const strategyDir = join(root, "content", "strategy");
    const executionLogsDir = join(root, "logs", "executions");
    tempDirectories.push(root);

    mkdirSync(exportsDir, { recursive: true });
    mkdirSync(strategyDir, { recursive: true });
    mkdirSync(executionLogsDir, { recursive: true });
    writeFileSync(join(root, "seed.txt"), "workspace");
    writeFileSync(join(root, "content.json"), "{}");
    writeFileSync(join(executionLogsDir, "run-1.json"), '{"ok":true}');

    const service = new ExportService(root, exportsDir, strategyDir, executionLogsDir);
    const result = service.exportWorkspace();

    const files = readdirSync(exportsDir);
    const snapshot = JSON.parse(readFileSync(result.exportPath, "utf8")) as {
      executionLogs: Array<{ name: string; size: number }>;
    };

    expect(result.exportPath).toContain("workspace-export-");
    expect(files.some((file) => file.endsWith(".json"))).toBe(true);
    expect(snapshot.executionLogs).toHaveLength(1);
  });
});

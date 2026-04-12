import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { PrivacyService } from "../../app/main/domains/privacy/privacy.service";

describe("privacy service", () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    while (tempDirectories.length > 0) {
      const directory = tempDirectories.pop();
      if (directory) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it("purges local execution logs while preserving the directory", () => {
    const root = mkdtempSync(join(tmpdir(), "linkedin-poster-privacy-"));
    const logsDir = join(root, "logs", "executions");
    tempDirectories.push(root);

    mkdirSync(logsDir, { recursive: true });
    writeFileSync(join(logsDir, "run-1.json"), "{}");
    writeFileSync(join(logsDir, "run-2.json"), "{}");

    const service = new PrivacyService(logsDir);
    const result = service.purgeExecutionLogs();

    expect(result.deletedCount).toBe(2);
    expect(readdirSync(logsDir)).toHaveLength(0);
  });
});

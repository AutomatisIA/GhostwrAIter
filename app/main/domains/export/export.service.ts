import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, join } from "node:path";

export class ExportService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly exportsDirectory: string,
    private readonly strategyDirectory: string,
    private readonly executionLogsDirectory: string
  ) {}

  exportWorkspace() {
    mkdirSync(this.exportsDirectory, { recursive: true });
    mkdirSync(this.strategyDirectory, { recursive: true });

    const exportPath = join(
      this.exportsDirectory,
      `workspace-export-${Date.now()}.json`
    );

    const rootFiles = readdirSync(this.workspaceRoot, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      kind: entry.isDirectory() ? "directory" : "file"
    }));

    const strategyFiles = readdirSync(this.strategyDirectory, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      kind: entry.isDirectory() ? "directory" : "file"
    }));
    const executionLogs = readdirSync(this.executionLogsDirectory, {
      withFileTypes: true
    })
      .filter((entry) => entry.isFile())
      .map((entry) => ({
        name: entry.name,
        size: statSync(join(this.executionLogsDirectory, entry.name)).size
      }));

    const snapshot = {
      exportedAt: new Date().toISOString(),
      workspaceRoot: basename(this.workspaceRoot),
      rootFiles,
      strategyFiles,
      executionLogs,
      manifestPreview: rootFiles
        .filter((entry) => entry.kind === "file")
        .slice(0, 10)
        .map((entry) => ({
          name: entry.name,
          content: readFileSync(join(this.workspaceRoot, entry.name), "utf8")
        }))
    };

    writeFileSync(exportPath, JSON.stringify(snapshot, null, 2));

    return { exportPath };
  }
}

import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

export class PrivacyService {
  constructor(private readonly executionLogsDirectory: string) {}

  purgeExecutionLogs() {
    const files = readdirSync(this.executionLogsDirectory);

    for (const file of files) {
      rmSync(join(this.executionLogsDirectory, file), { force: true });
    }

    return {
      deletedCount: files.length
    };
  }
}

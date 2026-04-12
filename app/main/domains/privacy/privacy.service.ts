import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

export class PrivacyService {
  constructor(private readonly executionLogsDirectory: string) {}

  countExecutionLogs() {
    if (!existsSync(this.executionLogsDirectory)) {
      return { count: 0 };
    }
    const files = readdirSync(this.executionLogsDirectory);
    return { count: files.length };
  }

  purgeExecutionLogs() {
    if (!existsSync(this.executionLogsDirectory)) {
      return { deletedCount: 0 };
    }
    const files = readdirSync(this.executionLogsDirectory);

    for (const file of files) {
      rmSync(join(this.executionLogsDirectory, file), { force: true });
    }

    return {
      deletedCount: files.length
    };
  }
}

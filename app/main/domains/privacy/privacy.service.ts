import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

function isLogFile(name: string): boolean {
  return name.endsWith(".json");
}

export class PrivacyService {
  constructor(private readonly executionLogsDirectory: string) {}

  countExecutionLogs() {
    if (!existsSync(this.executionLogsDirectory)) {
      return { count: 0 };
    }
    const files = readdirSync(this.executionLogsDirectory).filter(isLogFile);
    return { count: files.length };
  }

  purgeExecutionLogs() {
    if (!existsSync(this.executionLogsDirectory)) {
      return { deletedCount: 0 };
    }
    const files = readdirSync(this.executionLogsDirectory).filter(isLogFile);

    for (const file of files) {
      rmSync(join(this.executionLogsDirectory, file), { force: true });
    }

    return {
      deletedCount: files.length
    };
  }
}

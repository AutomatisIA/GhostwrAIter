import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type WorkspacePaths = {
  rootDirectory: string;
  contentDirectory: string;
  dataDirectory: string;
  logsDirectory: string;
  skillsDirectory: string;
  databasePath: string;
};

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

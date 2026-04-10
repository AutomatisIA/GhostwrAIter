import Database from "better-sqlite3";

export function createAppDatabase(databasePath: string) {
  return new Database(databasePath);
}

import Database from "better-sqlite3";

export function createAppDatabase(databasePath: string): Database.Database {
  return new Database(databasePath);
}

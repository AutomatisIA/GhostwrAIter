import type Database from "better-sqlite3";
import type { PreferenceEntry } from "../../../shared/types/settings";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export class SettingsService {
  constructor(private readonly db: Database.Database) {
    this.db.pragma("journal_mode = WAL");
    this.db.prepare(CREATE_TABLE_SQL).run();
  }

  getPreference(key: string): { key: string; value: string | null } {
    const row = this.db
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return { key, value: row?.value ?? null };
  }

  setPreference(key: string, value: string): PreferenceEntry {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(key, value, now);
    return { key, value, updated_at: now };
  }

  getAllPreferences(): Record<string, string> {
    const rows = this.db
      .prepare("SELECT key, value FROM app_settings")
      .all() as Array<{ key: string; value: string }>;
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }
}

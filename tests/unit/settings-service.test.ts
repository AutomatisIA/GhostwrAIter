import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsService } from "../../app/main/domains/settings/settings.service";

describe("SettingsService", () => {
  let db: Database.Database;
  let service: SettingsService;

  beforeEach(() => {
    db = new Database(":memory:");
    service = new SettingsService(db);
  });

  afterEach(() => {
    db.close();
  });

  it("returns null for a missing key", () => {
    const result = service.getPreference("nonexistent");
    expect(result).toEqual({ key: "nonexistent", value: null });
  });

  it("stores and retrieves a preference", () => {
    service.setPreference("theme", "dark");
    const result = service.getPreference("theme");
    expect(result).toEqual({ key: "theme", value: "dark" });
  });

  it("upserts on duplicate key", () => {
    service.setPreference("theme", "dark");
    service.setPreference("theme", "light");
    const result = service.getPreference("theme");
    expect(result.value).toBe("light");
  });

  it("returns updated_at on set", () => {
    const entry = service.setPreference("theme", "system");
    expect(entry.key).toBe("theme");
    expect(entry.value).toBe("system");
    expect(entry.updated_at).toBeTruthy();
    expect(() => new Date(entry.updated_at)).not.toThrow();
  });

  it("returns all preferences as a flat record", () => {
    service.setPreference("theme", "dark");
    service.setPreference("active_engine", "codex");
    const all = service.getAllPreferences();
    expect(all).toEqual({ theme: "dark", active_engine: "codex" });
  });

  it("returns empty record when no preferences exist", () => {
    const all = service.getAllPreferences();
    expect(all).toEqual({});
  });
});

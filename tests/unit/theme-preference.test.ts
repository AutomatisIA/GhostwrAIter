import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsService } from "../../app/main/domains/settings/settings.service";

describe("Theme preference persistence", () => {
  let db: Database.Database;
  let service: SettingsService;

  beforeEach(() => {
    db = new Database(":memory:");
    service = new SettingsService(db);
  });

  afterEach(() => {
    db.close();
  });

  it("stores dark theme and retrieves it", () => {
    service.setPreference("theme", "dark");
    expect(service.getPreference("theme").value).toBe("dark");
  });

  it("stores system theme and retrieves it", () => {
    service.setPreference("theme", "system");
    expect(service.getPreference("theme").value).toBe("system");
  });

  it("falls back to null when no theme is set", () => {
    expect(service.getPreference("theme").value).toBeNull();
  });

  it("overwrites previous theme choice", () => {
    service.setPreference("theme", "dark");
    service.setPreference("theme", "light");
    expect(service.getPreference("theme").value).toBe("light");
  });
});

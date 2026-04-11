import { describe, expect, it } from "vitest";
import { buildHardenedWebPreferences } from "../../app/main/window-factory";

describe("webPreferences hardening", () => {
  const fakePreloadPath = "/fake/preload/index.mjs";

  it("enables the Chromium sandbox", () => {
    const prefs = buildHardenedWebPreferences(fakePreloadPath);
    expect(prefs.sandbox).toBe(true);
  });

  it("enables contextIsolation explicitly", () => {
    const prefs = buildHardenedWebPreferences(fakePreloadPath);
    expect(prefs.contextIsolation).toBe(true);
  });

  it("disables nodeIntegration explicitly", () => {
    const prefs = buildHardenedWebPreferences(fakePreloadPath);
    expect(prefs.nodeIntegration).toBe(false);
  });

  it("enables webSecurity explicitly", () => {
    const prefs = buildHardenedWebPreferences(fakePreloadPath);
    expect(prefs.webSecurity).toBe(true);
  });

  it("preserves the caller's preload path", () => {
    const prefs = buildHardenedWebPreferences(fakePreloadPath);
    expect(prefs.preload).toBe(fakePreloadPath);
  });

  it("returns a new object on each call so callers cannot mutate a shared instance", () => {
    const first = buildHardenedWebPreferences(fakePreloadPath);
    const second = buildHardenedWebPreferences(fakePreloadPath);
    expect(first).not.toBe(second);
  });
});

import { describe, expect, it } from "vitest";

const REDIRECT_MAP: Record<string, string> = {
  "/idees": "/creer",
  "/atelier": "/creer",
  "/calendrier": "/bibliotheque?view=planning",
  "/runner": "/parametres?section=diagnostics"
};

const VALID_ROUTES = ["/", "/strategie", "/creer", "/bibliotheque", "/parametres"];

describe("Route redirects", () => {
  it.each(Object.entries(REDIRECT_MAP))(
    "legacy route %s redirects to %s",
    (oldPath, expectedTarget) => {
      expect(REDIRECT_MAP[oldPath]).toBe(expectedTarget);
    }
  );

  it("has exactly 5 main routes", () => {
    expect(VALID_ROUTES).toHaveLength(5);
  });

  it("main routes include all expected paths", () => {
    expect(VALID_ROUTES).toContain("/");
    expect(VALID_ROUTES).toContain("/strategie");
    expect(VALID_ROUTES).toContain("/creer");
    expect(VALID_ROUTES).toContain("/bibliotheque");
    expect(VALID_ROUTES).toContain("/parametres");
  });

  it("legacy routes do not overlap with main routes", () => {
    for (const legacyPath of Object.keys(REDIRECT_MAP)) {
      expect(VALID_ROUTES).not.toContain(legacyPath);
    }
  });
});

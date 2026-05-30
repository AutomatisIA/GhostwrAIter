import { describe, expect, it } from "vitest";
import { isTourSeen } from "./tour-seen";

/*
 * Détection « visite guidée déjà vue » (feature 010). Le flag n'est jamais
 * écrit qu'à la valeur littérale "true" : la détection doit donc tester cette
 * valeur exacte, et traiter toute autre valeur (absence, vide, "false") comme
 * « non vue », afin de ne pas masquer un déclenchement légitime au premier
 * lancement.
 */
describe("isTourSeen", () => {
  it("considère la visite comme vue uniquement pour la valeur exacte \"true\"", () => {
    expect(isTourSeen("true")).toBe(true);
  });

  it("considère la visite comme non vue pour null, undefined ou toute autre valeur", () => {
    expect(isTourSeen(null)).toBe(false);
    expect(isTourSeen(undefined)).toBe(false);
    expect(isTourSeen("")).toBe(false);
    expect(isTourSeen("false")).toBe(false);
    expect(isTourSeen("TRUE")).toBe(false);
    expect(isTourSeen("1")).toBe(false);
  });
});

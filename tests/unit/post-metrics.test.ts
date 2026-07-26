import { describe, expect, it } from "vitest";
import {
  LINKEDIN_FOLD_CHARS,
  LINKEDIN_MAX_CHARS,
  formatCharCount,
  measurePost
} from "../../app/shared/post-metrics";

describe("post metrics", () => {
  it("compte les caracteres et les mots", () => {
    const m = measurePost("Un post court avec six mots.");
    expect(m.chars).toBe(28);
    expect(m.words).toBe(6);
  });

  it("compte les caracteres accentues comme un seul caractere", () => {
    // Le francais du produit est accentue : un comptage naif en UTF-16
    // surcompterait les caracteres composes.
    expect(measurePost("éàçù").chars).toBe(4);
  });

  it("signale le depassement de la limite LinkedIn", () => {
    const sous = measurePost("a".repeat(LINKEDIN_MAX_CHARS));
    const au_dela = measurePost("a".repeat(LINKEDIN_MAX_CHARS + 1));

    expect(sous.overLimit).toBe(false);
    expect(au_dela.overLimit).toBe(true);
  });

  it("expose le texte visible avant le repli", () => {
    const long = "b".repeat(LINKEDIN_FOLD_CHARS + 50);
    const m = measurePost(long);

    expect(m.isFolded).toBe(true);
    expect([...m.visibleBeforeFold].length).toBe(LINKEDIN_FOLD_CHARS);
  });

  it("ne replie pas un post plus court que le seuil", () => {
    const m = measurePost("court");
    expect(m.isFolded).toBe(false);
    expect(m.visibleBeforeFold).toBe("court");
  });

  it("tolere une entree vide", () => {
    const m = measurePost("");
    expect(m.chars).toBe(0);
    expect(m.words).toBe(0);
    expect(m.overLimit).toBe(false);
  });

  it("formate le compteur, avec mention du depassement", () => {
    expect(formatCharCount("abc")).toBe("3 caractères");
    expect(formatCharCount("a".repeat(LINKEDIN_MAX_CHARS + 1))).toContain(
      "au-delà de la limite LinkedIn"
    );
  });
});

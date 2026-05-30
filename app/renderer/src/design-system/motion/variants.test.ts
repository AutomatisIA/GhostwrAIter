import { describe, expect, it } from "vitest";
import {
  DURATIONS,
  fadeInUp,
  staggerContainer,
  pageTransition,
  celebration,
  resolveVariants
} from "./variants";

describe("motion variants", () => {
  it("expose des durees alignees sur les tokens motion (150/250/400ms en secondes)", () => {
    expect(DURATIONS.fast).toBeCloseTo(0.15);
    expect(DURATIONS.base).toBeCloseTo(0.25);
    expect(DURATIONS.slow).toBeCloseTo(0.4);
  });

  it("fadeInUp anime opacite et translation verticale", () => {
    expect(fadeInUp.hidden).toMatchObject({ opacity: 0 });
    expect(fadeInUp.hidden.y).toBeGreaterThan(0);
    expect(fadeInUp.visible).toMatchObject({ opacity: 1, y: 0 });
  });

  it("staggerContainer orchestre l'apparition en cascade", () => {
    const visible = staggerContainer.visible as { transition?: { staggerChildren?: number } };
    expect(visible.transition?.staggerChildren).toBeGreaterThan(0);
  });

  it("pageTransition definit initial/animate/exit", () => {
    expect(pageTransition.initial).toBeDefined();
    expect(pageTransition.animate).toBeDefined();
    expect(pageTransition.exit).toBeDefined();
  });

  it("celebration definit un etat de mise en avant", () => {
    expect(celebration.hidden).toBeDefined();
    expect(celebration.visible).toBeDefined();
  });
});

describe("resolveVariants (respect du mouvement reduit)", () => {
  it("retourne les variants complets quand le mouvement n'est pas reduit", () => {
    const resolved = resolveVariants(fadeInUp, false);
    expect(resolved.hidden).toMatchObject({ opacity: 0 });
    expect(resolved.hidden.y).toBeGreaterThan(0);
  });

  it("neutralise les transformations decoratives quand le mouvement est reduit", () => {
    const resolved = resolveVariants(fadeInUp, true);
    // L'opacite (feedback) est conservee, mais aucune translation/echelle.
    expect(resolved.hidden).toMatchObject({ opacity: 0 });
    expect(resolved.hidden.y ?? 0).toBe(0);
    expect(resolved.visible).toMatchObject({ opacity: 1 });
  });

  it("neutralise le stagger quand le mouvement est reduit", () => {
    const resolved = resolveVariants(staggerContainer, true) as {
      visible: { transition?: { staggerChildren?: number } };
    };
    expect(resolved.visible.transition?.staggerChildren ?? 0).toBe(0);
  });

  it("ramene l'echelle a 1 (pas 0) pour garder l'element visible sous mouvement reduit", () => {
    // La celebration part de scale 0.85 et arrive a 1. Sous mouvement reduit,
    // l'element doit rester VISIBLE (scale 1), jamais disparaitre (scale 0).
    const resolved = resolveVariants(celebration, true) as {
      hidden: { scale?: number; opacity?: number };
      visible: { scale?: number; opacity?: number };
    };
    expect(resolved.hidden.scale).toBe(1);
    expect(resolved.visible.scale).toBe(1);
    expect(resolved.visible.opacity).toBe(1);
  });
});

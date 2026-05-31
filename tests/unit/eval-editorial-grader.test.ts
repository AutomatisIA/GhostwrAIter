import { describe, expect, it } from "vitest";
import { gradeOutput } from "../../scripts/eval-editorial-grader.mjs";

const baseDoctrine = {
  bannedOpenings: ["En réalité", "Dans beaucoup de PME"],
  bannedMetaPhrases: ["Structure retenue", "Variante orientée"],
  voiceRules: [],
  concreteHeuristics: {
    numberRegex: /\b\d+(?:[.,]\d+)?\s*(?:%|€|jours?|mois|FTE)?\b/iu,
    operationalCostKeywords: ["supervision", "cadrage", "audit"],
    businessConsequenceKeywords: ["retard", "bloque", "perte"],
    arbitrageKeywords: ["plutôt que", "au lieu de"]
  }
};

const baseConfig = {
  bodyLengthMin: 800,
  bodyLengthMax: 2200,
  qualityScoreThreshold: 0.8
};

function paddedBody(seed: string, targetLength: number): string {
  const filler = "Cadrage et supervision conditionnent toute mise en production réussie. ";
  let body = seed;
  while (body.length < targetLength) body += filler;
  return body.slice(0, targetLength);
}

// Forme RÉELLE retournée par generateFinalDraft / transformNews(createFromNewsSource) /
// correctDraft : un objet de session avec `draft` au niveau racine portant
// headline / bodyMarkdown / qualityScore (PAS de wrapper `.data`, PAS de
// `qualitySignals`). Le grader doit lire cette forme. Voir
// app/shared/types/{workshop,ideas}.ts.
function buildOutput(overrides: Record<string, unknown> = {}): unknown {
  return {
    status: "succeeded",
    summary: "ok",
    skillName: "linkedin-post-writer",
    fixtureId: "A1",
    fixtureType: "A",
    draft: {
      id: "draft_eval",
      headline: "Sharp distinct headline",
      bodyMarkdown: paddedBody(
        "On choisit l'audit plutôt que la migration brutale. Le retard de production se mesure en jours. ",
        1500
      ),
      qualityScore: 0.85
    },
    ...overrides
  };
}

function draft(
  headline: string,
  bodyMarkdown: string,
  qualityScore = 0.9
): Record<string, unknown> {
  return { draft: { id: "draft_eval", headline, bodyMarkdown, qualityScore } };
}

describe("gradeOutput — extraction (forme réelle de session)", () => {
  it("extrait headline / body / qualityScore depuis draft racine et note pass", () => {
    const result = gradeOutput(buildOutput(), baseDoctrine, baseConfig);
    expect(result.bodyLength).toBeGreaterThan(0);
    expect(result.qualityScore).toBe(0.85);
    expect(result.verdict).toBe("pass");
  });
});

describe("gradeOutput — Rule 1 (skill refused)", () => {
  it("returns single skill-refused violation when status is failed", () => {
    const result = gradeOutput(
      { status: "failed", summary: "no", error: { code: "X", message: "boom" } },
      baseDoctrine,
      baseConfig
    );
    expect(result.verdict).toBe("fail");
    expect(result.violatedRules).toHaveLength(1);
    expect(result.violatedRules[0]!.rule).toBe("skill-refused");
  });
});

describe("gradeOutput — Rule 2 (banned opening)", () => {
  it("fails when banned opening appears with no concrete anchor in same sentence", () => {
    const out = buildOutput(
      draft("A clear headline", paddedBody("En réalité ce sujet est compliqué pour beaucoup. ", 1500))
    );
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.verdict).toBe("fail");
    expect(result.violatedRules.some((v) => v.rule === "banned-opening")).toBe(true);
  });

  it("rescues a banned opening followed by a concrete number in the same sentence", () => {
    const out = buildOutput(
      draft("A clear headline", paddedBody("En réalité 42% des PME bloquent sur le cadrage. ", 1500))
    );
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.violatedRules.some((v) => v.rule === "banned-opening")).toBe(false);
  });
});

describe("gradeOutput — Rule 3 (banned meta phrase)", () => {
  it("fails when a banned meta phrase appears anywhere in the body", () => {
    const out = buildOutput(
      draft("A clear headline", paddedBody("Structure retenue: contraste fort. Cadrage initial fait. ", 1500))
    );
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.verdict).toBe("fail");
    expect(result.violatedRules.some((v) => v.rule === "banned-meta-phrase")).toBe(true);
  });
});

describe("gradeOutput — Rule 4 (headline repeat)", () => {
  it("fails when the headline appears verbatim in the first two sentences", () => {
    const out = buildOutput(
      draft(
        "Repeated headline marker",
        paddedBody("Repeated headline marker, voilà le sujet. Cadrage prévu. ", 1500)
      )
    );
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.verdict).toBe("fail");
    expect(result.violatedRules.some((v) => v.rule === "headline-repeated")).toBe(true);
  });

  it("passes Rule 4 when the headline appears later than sentence 2", () => {
    const out = buildOutput();
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.violatedRules.some((v) => v.rule === "headline-repeated")).toBe(false);
  });
});

describe("gradeOutput — Rule 5 (body length range)", () => {
  it("fails when body is below the minimum length", () => {
    const out = buildOutput(draft("A clear headline", "Audit court. Cadrage simple. Plutôt que retard."));
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.violatedRules.some((v) => v.rule === "body-length-out-of-range")).toBe(true);
  });

  it("fails when body exceeds the maximum length", () => {
    const out = buildOutput(draft("A clear headline", paddedBody("Audit cadrage plutôt que migration. ", 2400)));
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.violatedRules.some((v) => v.rule === "body-length-out-of-range")).toBe(true);
  });

  it("passes when body length is inside the range", () => {
    const out = buildOutput();
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.violatedRules.some((v) => v.rule === "body-length-out-of-range")).toBe(false);
  });
});

describe("gradeOutput — Rule 6 (concrete element)", () => {
  it("passes when an operational-cost keyword is present", () => {
    const out = buildOutput(
      draft(
        "A clear headline",
        paddedBody("La supervision rend cette IA exploitable en PME et change l'arbitrage. ", 1500)
      )
    );
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.violatedRules.some((v) => v.rule === "no-concrete-element")).toBe(false);
  });

  it("fails when the body contains no concrete element from any category", () => {
    const out = buildOutput(
      draft(
        "A clear headline",
        paddedBody(
          "Réfléchissons posément ensemble à ces enjeux nouveaux qui nous concernent tous, sans précipitation. ",
          1500
        ).replace(/[a-z]+(?=[ ,.])/gi, (m) =>
          ["audit", "supervision", "cadrage", "retard", "bloque", "plutôt que", "perte"].includes(
            m.toLowerCase()
          )
            ? "doucement"
            : m
        )
      )
    );
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.violatedRules.some((v) => v.rule === "no-concrete-element")).toBe(true);
  });
});

describe("gradeOutput — Rule 7 (quality score)", () => {
  it("fails when quality score is below threshold", () => {
    const out = buildOutput(
      draft("A clear headline", paddedBody("Audit cadrage plutôt que migration brutale en PME. ", 1500), 0.7)
    );
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.violatedRules.some((v) => v.rule === "quality-score-below-threshold")).toBe(true);
  });

  it("passes when quality score is at or above threshold", () => {
    const out = buildOutput();
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.violatedRules.some((v) => v.rule === "quality-score-below-threshold")).toBe(false);
  });
});

describe("gradeOutput — integration", () => {
  it("collects multiple violations in a single result", () => {
    const out = buildOutput(draft("A clear headline", "En réalité c'est court.", 0.5));
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.verdict).toBe("fail");
    expect(result.violatedRules.length).toBeGreaterThanOrEqual(2);
  });

  it("returns pass with empty violatedRules when every rule passes", () => {
    const out = buildOutput();
    const result = gradeOutput(out, baseDoctrine, baseConfig);
    expect(result.verdict).toBe("pass");
    expect(result.violatedRules).toEqual([]);
  });
});

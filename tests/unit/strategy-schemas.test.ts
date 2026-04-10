import { describe, expect, it } from "vitest";
import {
  strategyBundleInputSchema,
  voiceRuleInputSchema
} from "../../app/shared/schemas/strategy";

describe("strategy schemas", () => {
  it("accepts a complete strategy bundle", () => {
    const result = strategyBundleInputSchema.safeParse({
      profile: {
        name: "Philippe",
        positioning: "Consultant en IA generative pour PME",
        bio: "J'aide les PME a deployer l'IA sans hype.",
        expertiseSummary: "Adoption, process, ROI"
      },
      offers: [
        {
          name: "Diagnostic IA PME",
          promise: "Transformer l'IA en gains operationnels",
          problems:
            "Pas de priorisation, pas de methode, pas de cadre de deploiement",
          proofPoints: "Ateliers terrain, feuille de route, ROI"
        }
      ],
      icps: [
        {
          segment: "Dirigeants de PME",
          pains: "Temps perdu, IA floue, equipes pas alignees",
          objections: "Trop complexe, trop cher, pas prioritaire",
          desiredOutcomes: "Cas d'usage concrets, process simples",
          languageCues: "Concret, rentable, deployable"
        }
      ],
      pillars: [
        {
          label: "Adoption IA",
          description: "Usage concret et mise en oeuvre",
          position: 1,
          isDefault: true
        }
      ],
      voiceRules: [
        {
          category: "anti_style",
          ruleText: "Eviter le ton vendeur artificiel",
          ruleType: "anti_style"
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects a voice rule with an unsupported type", () => {
    const result = voiceRuleInputSchema.safeParse({
      category: "style",
      ruleText: "Toujours ajouter des emojis",
      ruleType: "weird"
    });

    expect(result.success).toBe(false);
  });

  it("rejects a strategy bundle without an active profile name", () => {
    const result = strategyBundleInputSchema.safeParse({
      profile: {
        name: "",
        positioning: "Consultant",
        bio: "",
        expertiseSummary: ""
      },
      offers: [],
      icps: [],
      pillars: [],
      voiceRules: []
    });

    expect(result.success).toBe(false);
  });
});

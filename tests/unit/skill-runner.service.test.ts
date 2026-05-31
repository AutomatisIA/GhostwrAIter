import { describe, expect, it } from "vitest";
import {
  SkillRunnerService,
  type SkillRunnerResult
} from "../../app/main/domains/execution/skill-runner.service";
import type { EngineRegistry } from "../../app/main/domains/execution/engine-registry";

describe("skill runner service", () => {
  it("fails explicitly when Codex is unavailable", async () => {
    const service = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => false,
        execute: () => {
          throw new Error("should not execute when unavailable");
        }
      }
    });

    const result = await service.execute({
      runId: "run_1",
      skillName: "linkedin-post-writer",
      skillVersion: "1.0.0",
      context: {
        profileId: "profile_active",
        pillarLabel: "Adoption IA",
        voiceGuardrail: "Pas de hype, du terrain."
      },
      payload: {
        ideaId: "idea_1",
        title: "Le vrai frein a l'IA en PME",
        angle: "Le probleme n'est presque jamais le prompt",
        selectedHook: "Le vrai probleme n'est pas l'outil."
      },
      attachments: []
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("ENGINE_UNAVAILABLE");
  });

  it("returns a failed contract for an unknown skill", async () => {
    const service = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: () =>
          ({
            status: "failed",
            summary: "Unknown skill from Codex",
            error: {
              code: "SKILL_NOT_FOUND",
              message: "No implementation for unknown-skill"
            }
          }) as SkillRunnerResult
      }
    });

    const result = await service.execute({
      runId: "run_2",
      skillName: "unknown-skill",
      skillVersion: "1.0.0",
      context: {},
      payload: {},
      attachments: []
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("SKILL_NOT_FOUND");
    expect(result.summary).toContain("Unknown skill");
  });

  it("accepts a valid Codex response for linkedin-repurpose", async () => {
    const service = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: () =>
          ({
            status: "succeeded",
            summary: "Variant created by Codex",
            data: {
              draft: {
                headline: "Variante - Pourquoi cadrer avant de prompter",
                bodyMarkdown: "Version courte plus directe."
              },
              hooks: [],
              variants: [
                {
                  variantType: "repurpose",
                  bodyMarkdown: "Version courte plus directe."
                }
              ],
              qualitySignals: {
                clarity: 0.8,
                specificity: 0.78,
                antiHypeAlignment: 0.95
              }
            }
          }) as SkillRunnerResult
      }
    });

    const result = await service.execute({
      runId: "run_3",
      skillName: "linkedin-repurpose",
      skillVersion: "1.0.0",
      context: {
        pillarLabel: "Methodes",
        voiceGuardrail: "Pas de hype, du terrain."
      },
      payload: {
        headline: "Pourquoi cadrer avant de prompter",
        bodyMarkdown: "Le process prime sur l'outil."
      },
      attachments: []
    });

    expect(result.status).toBe("succeeded");
    expect(result.data?.variants).toHaveLength(1);
    expect(result.data?.variants[0]?.variantType).toBe("repurpose");
  });

  it("accepts a valid Codex response for linkedin-news-to-post", async () => {
    const service = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: () =>
          ({
            status: "succeeded",
            summary: "News transformed by Codex",
            data: {
              draft: {
                headline: "Une PME industrialise ses copilotes IA",
                bodyMarkdown: "Post construit sur un angle PME."
              },
              hooks: [
                {
                  family: "news-angle",
                  text: "La vraie question n'est pas la news.",
                  score: 0.87
                }
              ],
              variants: [],
              qualitySignals: {
                clarity: 0.85,
                specificity: 0.84,
                antiHypeAlignment: 0.93
              }
            }
          }) as SkillRunnerResult
      }
    });

    const result = await service.execute({
      runId: "run_4",
      skillName: "linkedin-news-to-post",
      skillVersion: "1.0.0",
      context: {
        pillarLabel: "Veille",
        voiceGuardrail: "Pas de hype, du terrain."
      },
      payload: {
        sourceTitle: "Une PME industrialise ses copilotes IA",
        sourceSummary: "Le sujet central est l'adoption terrain et la priorisation des cas d'usage."
      },
      attachments: []
    });

    expect(result.status).toBe("succeeded");
    expect(result.data?.draft?.headline).toContain("copilotes IA");
    expect(result.summary).toContain("Codex");
  });

  it("accepts a valid Codex response for linkedin-strategy-foundation", async () => {
    const service = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: () =>
          ({
            status: "succeeded",
            summary: "Strategy foundation generated by Codex",
            data: {
              hooks: [],
              variants: [],
              qualitySignals: {
                clarity: 0.9,
                specificity: 0.86,
                antiHypeAlignment: 0.95
              }
            },
            artifacts: [
              {
                kind: "markdown",
                label: "human_output",
                content: "Positionnement: Consultant IA PME"
              }
            ]
          }) as SkillRunnerResult
      }
    });

    const result = await service.execute({
      runId: "run_4b",
      skillName: "linkedin-strategy-foundation",
      skillVersion: "1.0.0",
      context: {},
      payload: {
        profile: {
          name: "Philippe",
          positioning: "Consultant IA PME"
        },
        offers: [{ name: "Offre coeur" }],
        icps: [{ segment: "Dirigeants PME" }],
        pillars: [{ label: "Adoption IA" }],
        voiceRules: [{ ruleText: "Pas de hype" }]
      },
      attachments: []
    });

    expect(result.status).toBe("succeeded");
    expect(result.summary).toContain("Strategy foundation");
    expect(result.artifacts?.[0]?.content).toContain("Consultant IA PME");
  });

  it("accepts a valid Codex response for linkedin-topic-generator", async () => {
    const service = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: () =>
          ({
            status: "succeeded",
            summary: "Topics generated by Codex",
            data: {
              hooks: [],
              variants: [],
              qualitySignals: {
                clarity: 0.84,
                specificity: 0.82,
                antiHypeAlignment: 0.94
              }
            },
            artifacts: [
              {
                kind: "markdown",
                label: "human_output",
                content: "1. Adoption IA - angle concret"
              }
            ]
          }) as SkillRunnerResult
      }
    });

    const result = await service.execute({
      runId: "run_4c",
      skillName: "linkedin-topic-generator",
      skillVersion: "1.0.0",
      context: {},
      payload: {
        profileName: "Philippe",
        positioning: "Consultant IA PME",
        pillars: [{ label: "Adoption IA" }, { label: "ROI" }],
        icps: [{ segment: "Dirigeants PME" }],
        offers: [{ name: "Offre coeur" }]
      },
      attachments: []
    });

    expect(result.status).toBe("succeeded");
    expect(result.summary).toContain("Topics generated");
    expect(result.artifacts?.[0]?.content).toContain("Adoption IA");
  });

  it("prefers codex cli when available", async () => {
    const service = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: () =>
          ({
            status: "succeeded",
            summary: "Generated by Codex CLI",
            data: {
              draft: {
                headline: "Titre",
                bodyMarkdown: "Texte"
              },
              hooks: [],
              variants: [],
              qualitySignals: {
                clarity: 0.9,
                specificity: 0.9,
                antiHypeAlignment: 0.95
              }
            }
          }) as SkillRunnerResult
      }
    });

    const result = await service.execute({
      runId: "run_5",
      skillName: "linkedin-post-writer",
      skillVersion: "1.0.0",
      context: {},
      payload: {},
      attachments: []
    });

    expect(result.summary).toContain("Codex CLI");
  });

  it("fails when Codex returns a succeeded payload missing required fields", async () => {
    const service = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: () =>
          ({
            status: "succeeded",
            summary: "Codex returned incomplete data",
            data: {
              hooks: [],
              variants: [],
              qualitySignals: {
                clarity: 0.9,
                specificity: 0.9,
                antiHypeAlignment: 0.95
              }
            }
          }) as SkillRunnerResult
      }
    });

    const result = await service.execute({
      runId: "run_6",
      skillName: "linkedin-structure-selector",
      skillVersion: "1.0.0",
      context: {},
      payload: {
        title: "Pourquoi les PME bloquent"
      },
      attachments: []
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("ENGINE_INVALID_CONTRACT");
  });

  it("fails when Codex returns hooks without valid numeric scores", async () => {
    const service = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: () =>
          ({
            status: "succeeded",
            summary: "Codex returned malformed hooks",
            data: {
              hooks: [
                {
                  family: "contrarian",
                  text: "Hook without score",
                  score: Number.NaN
                }
              ],
              variants: [],
              qualitySignals: {
                clarity: 0.9,
                specificity: 0.9,
                antiHypeAlignment: 0.95
              }
            }
          }) as SkillRunnerResult
      }
    });

    const result = await service.execute({
      runId: "run_6b",
      skillName: "linkedin-hook-engine",
      skillVersion: "1.0.0",
      context: {},
      payload: {
        title: "Pourquoi les PME bloquent"
      },
      attachments: []
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("ENGINE_INVALID_CONTRACT");
  });

  it("fails explicitly when the Codex runner throws", async () => {
    const service = new SkillRunnerService({
      codexCliRunner: {
        isAvailable: () => true,
        execute: () => {
          throw new Error("output file missing");
        }
      }
    });

    const result = await service.execute({
      runId: "run_7",
      skillName: "linkedin-hook-engine",
      skillVersion: "1.0.0",
      context: {},
      payload: {
        title: "Pourquoi les PME bloquent"
      },
      attachments: []
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("ENGINE_EXECUTION_ERROR");
  });

  it("executeViaEngine prefixe le preambule cadre partage (source unique)", async () => {
    let capturedPrompt = "";
    const engine = {
      executeSkill: async (prompt: string) => {
        capturedPrompt = prompt;
        return JSON.stringify({
          status: "succeeded",
          summary: "ok",
          data: {
            draft: { headline: "H", bodyMarkdown: "B" },
            hooks: [],
            variants: [],
            qualitySignals: { clarity: 0.9, specificity: 0.9, antiHypeAlignment: 0.9 }
          }
        });
      }
    };
    const engineRegistry = {
      getActiveEngine: async () => ({
        engine: "claude",
        status: { installState: "authenticated" }
      }),
      getEngineByName: () => engine
    } as unknown as EngineRegistry;
    const service = new SkillRunnerService({ engineRegistry });

    const result = await service.executeAsync({
      runId: "run_engine",
      skillName: "linkedin-post-writer",
      skillVersion: "1.0.0",
      context: {},
      payload: { title: "t", angle: "a" },
      attachments: []
    });

    expect(result.status).toBe("succeeded");
    // Preambule cadre charge depuis skills/_framework/PROMPT.md, prefixe au prompt.
    expect(capturedPrompt).toContain(
      "You are a premium LinkedIn editorial skill runner"
    );
    expect(capturedPrompt).toContain("Contract-specific instructions:");
  });
});

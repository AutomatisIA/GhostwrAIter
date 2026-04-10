import { CodexCliRunner } from "./codex-cli-runner";

export type SkillRunnerInvocation = {
  runId: string;
  skillName: string;
  skillVersion: string;
  context: Record<string, unknown>;
  payload: Record<string, unknown>;
  attachments: Array<{
    kind: string;
    path: string;
  }>;
};

export type SkillRunnerResult = {
  status: "succeeded" | "failed" | "partial";
  summary: string;
  data?: {
    draft?: {
      headline: string;
      bodyMarkdown: string;
    };
    hooks: Array<{
      family: string;
      text: string;
      score: number;
    }>;
    structure?: {
      key: string;
      label: string;
      rationale: string;
    };
    variants: Array<{
      variantType: string;
      bodyMarkdown: string;
    }>;
    qualitySignals: {
      clarity: number;
      specificity: number;
      antiHypeAlignment: number;
    };
  };
  artifacts?: Array<{
    kind: string;
    label: string;
    content: string;
  }>;
  error?: {
    code: string;
    message: string;
  };
};

type SkillRunnerOptions = {
  codexCliRunner?: Pick<CodexCliRunner, "isAvailable" | "execute">;
};

export class SkillRunnerService {
  private readonly codexCliRunner?: Pick<CodexCliRunner, "isAvailable" | "execute">;

  constructor(options?: SkillRunnerOptions) {
    this.codexCliRunner = options?.codexCliRunner;
  }

  execute(invocation: SkillRunnerInvocation): SkillRunnerResult {
    if (this.codexCliRunner?.isAvailable()) {
      const codexResult = this.codexCliRunner.execute(invocation);

      if (codexResult.status === "succeeded") {
        return codexResult;
      }
    }

    switch (invocation.skillName) {
      case "linkedin-structure-selector":
        return this.runStructureSelector(invocation);
      case "linkedin-strategy-foundation":
        return this.runStrategyFoundation(invocation);
      case "linkedin-topic-generator":
        return this.runTopicGenerator(invocation);
      case "linkedin-hook-engine":
        return this.runHookEngine(invocation);
      case "linkedin-post-writer":
        return this.runPostWriter(invocation);
      case "linkedin-post-editor":
        return this.runPostEditor(invocation);
      case "linkedin-repurpose":
        return this.runRepurpose(invocation);
      case "linkedin-news-to-post":
        return this.runNewsToPost(invocation);
      default:
        return {
          status: "failed",
          summary: `Unknown skill: ${invocation.skillName}`,
          error: {
            code: "SKILL_NOT_FOUND",
            message: `No local runner implementation found for ${invocation.skillName}.`
          }
        };
    }
  }

  getRunnerMode(): "codex" | "local-simulated" {
    return this.codexCliRunner?.isAvailable() ? "codex" : "local-simulated";
  }

  private runPostWriter(invocation: SkillRunnerInvocation): SkillRunnerResult {
    const title = String(invocation.payload.title ?? "Sujet");
    const angle = String(invocation.payload.angle ?? "");
    const structureLabel = String(invocation.payload.structureLabel ?? "structure terrain");
    const voiceGuardrail = String(
      invocation.context.voiceGuardrail ?? "Pas de hype, du terrain."
    );

    const bodyMarkdown = [
      `${title}.`,
      "",
      `${angle}.`,
      "",
      `Structure retenue : ${structureLabel}.`,
      "",
      "Ce post part d'un constat terrain en PME : le blocage vient souvent du process avant de venir de l'outil.",
      "",
      "On gagne plus vite avec un cadre simple, un cas d'usage priorise et un pilote concret."
    ].join("\n");

    const fallbackHooks = [
      {
        family: "contrarian",
        text: `Le vrai probleme avec ${title.toLowerCase()}, ce n'est presque jamais l'outil.`,
        score: 0.91
      },
      {
        family: "diagnostic",
        text: "Si votre projet IA n'avance pas, regardez d'abord votre process.",
        score: 0.86
      },
      {
        family: "pme",
        text: "Une PME n'a pas besoin de plus d'IA. Elle a besoin d'un meilleur cadrage.",
        score: 0.88
      }
    ];

    return {
      status: "succeeded",
      summary: "Draft generated",
      data: {
        draft: {
          headline: title,
          bodyMarkdown
        },
        hooks: Array.isArray(invocation.payload.hooks)
          ? (invocation.payload.hooks as Array<{ family: string; text: string; score: number }>)
          : fallbackHooks,
        variants: [
          {
            variantType: "short",
            bodyMarkdown: `${title}. ${angle}. Commencez par un pilote simple et utile.`
          }
        ],
        qualitySignals: {
          clarity: 0.84,
          specificity: 0.82,
          antiHypeAlignment: voiceGuardrail.includes("hype") ? 0.95 : 0.83
        }
      },
      artifacts: [
        {
          kind: "markdown",
          label: "human_output",
          content: bodyMarkdown
        }
      ]
    };
  }

  private runStructureSelector(invocation: SkillRunnerInvocation): SkillRunnerResult {
    const title = String(invocation.payload.title ?? "Sujet");

    return {
      status: "succeeded",
      summary: "Structure selected",
      data: {
        hooks: [],
        structure: {
          key: "belief-terrain-reality",
          label: "Croyance -> terrain -> realite",
          rationale: `Structure choisie pour ${title} afin de partir d'une croyance, la confronter au terrain, puis proposer une realite actionnable.`
        },
        variants: [],
        qualitySignals: {
          clarity: 0.82,
          specificity: 0.79,
          antiHypeAlignment: 0.93
        }
      }
    };
  }

  private runHookEngine(invocation: SkillRunnerInvocation): SkillRunnerResult {
    const title = String(invocation.payload.title ?? "Sujet");

    return {
      status: "succeeded",
      summary: "Hooks generated",
      data: {
        hooks: [
          {
            family: "contrarian",
            text: `Le vrai probleme avec ${title.toLowerCase()}, ce n'est presque jamais l'outil.`,
            score: 0.91
          },
          {
            family: "diagnostic",
            text: "Si votre projet IA n'avance pas, regardez d'abord votre process.",
            score: 0.86
          },
          {
            family: "pme",
            text: "Une PME n'a pas besoin de plus d'IA. Elle a besoin d'un meilleur cadrage.",
            score: 0.88
          }
        ],
        variants: [],
        qualitySignals: {
          clarity: 0.8,
          specificity: 0.78,
          antiHypeAlignment: 0.94
        }
      }
    };
  }

  private runStrategyFoundation(invocation: SkillRunnerInvocation): SkillRunnerResult {
    const profile = (invocation.payload.profile ?? {}) as {
      name?: string;
      positioning?: string;
    };
    const offers = ((invocation.payload.offers ?? []) as Array<{ name?: string }>).map(
      (offer) => offer.name ?? "Offre"
    );
    const pillars = ((invocation.payload.pillars ?? []) as Array<{ label?: string }>).map(
      (pillar) => pillar.label ?? "Pilier"
    );
    const voiceRules = ((invocation.payload.voiceRules ?? []) as Array<{ ruleText?: string }>).map(
      (rule) => rule.ruleText ?? ""
    );
    const summaryMarkdown = [
      `Positionnement: ${profile.positioning ?? "Positionnement non defini"}`,
      `Expert: ${profile.name ?? "Profil actif"}`,
      `Offres: ${offers.join(", ") || "Aucune offre"}`,
      `Piliers: ${pillars.join(", ") || "Aucun pilier"}`,
      `Voix: ${voiceRules.join(", ") || "Aucune regle de voix"}`
    ].join("\n");

    return {
      status: "succeeded",
      summary: "Strategy foundation generated",
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
          content: summaryMarkdown
        }
      ]
    };
  }

  private runTopicGenerator(invocation: SkillRunnerInvocation): SkillRunnerResult {
    const pillars = (invocation.payload.pillars ?? []) as Array<{ label?: string }>;
    const positioning = String(invocation.payload.positioning ?? "Expert IA PME");
    const ideas = pillars.length > 0 ? pillars : [{ label: "General" }];
    const content = ideas
      .map((pillar, index) => {
        const label = pillar.label ?? "General";
        return `${index + 1}. ${label} - Pourquoi ${label.toLowerCase()} bloque souvent en PME | angle: Le frein principal est le cadrage | score: ${0.9 - index * 0.05}`;
      })
      .join("\n");

    return {
      status: "succeeded",
      summary: `Topics generated for ${positioning}`,
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
          content
        }
      ]
    };
  }

  private runPostEditor(invocation: SkillRunnerInvocation): SkillRunnerResult {
    const draftBody = String(invocation.payload.bodyMarkdown ?? "");
    const correctedBody = `${draftBody}\n\nVersion revue : plus concret, plus net, plus utile pour un decideur PME.`;

    return {
      status: "succeeded",
      summary: "Draft corrected",
      data: {
        draft: {
          headline: String(invocation.payload.headline ?? "Draft revise"),
          bodyMarkdown: correctedBody
        },
        hooks: [],
        variants: [],
        qualitySignals: {
          clarity: 0.9,
          specificity: 0.88,
          antiHypeAlignment: 0.95
        }
      },
      artifacts: [
        {
          kind: "markdown",
          label: "human_output",
          content: correctedBody
        }
      ]
    };
  }

  private runRepurpose(invocation: SkillRunnerInvocation): SkillRunnerResult {
    const headline = String(invocation.payload.headline ?? "Variante");
    const sourceBody = String(invocation.payload.bodyMarkdown ?? "");
    const variantBody = `${sourceBody}\n\nVariante orientee angle complementaire pour reutilisation editoriale.`;

    return {
      status: "succeeded",
      summary: "Variant created",
      data: {
        draft: {
          headline: `Variante - ${headline}`,
          bodyMarkdown: variantBody
        },
        hooks: [],
        variants: [
          {
            variantType: "repurpose",
            bodyMarkdown: variantBody
          }
        ],
        qualitySignals: {
          clarity: 0.83,
          specificity: 0.8,
          antiHypeAlignment: 0.94
        }
      },
      artifacts: [
        {
          kind: "markdown",
          label: "human_output",
          content: variantBody
        }
      ]
    };
  }

  private runNewsToPost(invocation: SkillRunnerInvocation): SkillRunnerResult {
    const sourceTitle = String(invocation.payload.sourceTitle ?? "Actualite");
    const sourceSummary = String(invocation.payload.sourceSummary ?? "");
    const bodyMarkdown = [
      `${sourceTitle}.`,
      "",
      `${sourceSummary}`,
      "",
      "Mon angle PME: la valeur ne vient pas du buzz mais du cadrage, de l'adoption et du cas d'usage prioritaire."
    ].join("\n");

    return {
      status: "succeeded",
      summary: "News transformed into editorial draft",
      data: {
        draft: {
          headline: sourceTitle,
          bodyMarkdown
        },
        hooks: [
          {
            family: "news-angle",
            text: "La vraie question n'est pas la news. C'est ce que vous pouvez en faire dans votre PME.",
            score: 0.87
          }
        ],
        variants: [],
        qualitySignals: {
          clarity: 0.85,
          specificity: 0.84,
          antiHypeAlignment: 0.93
        }
      },
      artifacts: [
        {
          kind: "markdown",
          label: "human_output",
          content: bodyMarkdown
        }
      ]
    };
  }
}

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
    structures?: Array<{
      key: string;
      label: string;
      rationale: string;
    }>;
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
    if (!this.codexCliRunner?.isAvailable()) {
      return {
        status: "failed",
        summary: "Codex unavailable",
        error: {
          code: "CODEX_UNAVAILABLE",
          message: "Codex CLI is not available or not authenticated."
        }
      };
    }

    try {
      const codexResult = this.codexCliRunner.execute(invocation);

      if (codexResult.status === "failed") {
        return codexResult;
      }

      if (!this.isResultUsableForSkill(invocation.skillName, codexResult)) {
        return {
          status: "failed",
          summary: "Codex returned an invalid contract",
          error: {
            code: "CODEX_INVALID_CONTRACT",
            message: `Codex returned a payload that does not satisfy the ${invocation.skillName} contract.`
          }
        };
      }

      return codexResult;
    } catch (error) {
      return {
        status: "failed",
        summary: "Codex execution error",
        error: {
          code: "CODEX_EXECUTION_ERROR",
          message: error instanceof Error ? error.message : "Unknown Codex execution error"
        }
      };
    }
  }

  getRunnerMode(): "codex" | "unavailable" {
    return this.codexCliRunner?.isAvailable() ? "codex" : "unavailable";
  }

  private isResultUsableForSkill(skillName: string, result: SkillRunnerResult) {
    const hasFiniteQualitySignals =
      result.data?.qualitySignals !== undefined &&
      Number.isFinite(result.data.qualitySignals.clarity) &&
      Number.isFinite(result.data.qualitySignals.specificity) &&
      Number.isFinite(result.data.qualitySignals.antiHypeAlignment);

    switch (skillName) {
      case "linkedin-structure-selector": {
        const hasStructures =
          Array.isArray(result.data?.structures) &&
          result.data.structures.length > 0 &&
          result.data.structures.every(
            (s) => typeof s.key === "string" && typeof s.label === "string" && typeof s.rationale === "string"
          );
        const hasSingleStructure = Boolean(
          result.data?.structure?.key &&
            result.data.structure.label &&
            result.data.structure.rationale
        );
        return Boolean(hasFiniteQualitySignals && (hasStructures || hasSingleStructure));
      }
      case "linkedin-hook-engine":
        return Boolean(
          hasFiniteQualitySignals &&
            Array.isArray(result.data?.hooks) &&
            result.data.hooks.length > 0 &&
            result.data.hooks.every(
              (hook) =>
                typeof hook.family === "string" &&
                hook.family.length > 0 &&
                typeof hook.text === "string" &&
                hook.text.length > 0 &&
                Number.isFinite(hook.score)
            )
        );
      case "linkedin-post-writer":
      case "linkedin-post-editor":
      case "linkedin-news-to-post":
        return Boolean(
          hasFiniteQualitySignals &&
            result.data?.draft?.headline &&
            result.data.draft.bodyMarkdown
        );
      case "linkedin-repurpose":
        return Boolean(
          hasFiniteQualitySignals &&
            result.data?.draft?.headline &&
            result.data.draft.bodyMarkdown &&
            Array.isArray(result.data?.variants) &&
            result.data.variants.every(
              (variant) =>
                typeof variant.variantType === "string" &&
                variant.variantType.length > 0 &&
                typeof variant.bodyMarkdown === "string" &&
                variant.bodyMarkdown.length > 0
            )
        );
      case "linkedin-strategy-foundation":
      case "linkedin-topic-generator":
        return Boolean(
          hasFiniteQualitySignals &&
            Array.isArray(result.artifacts) &&
            result.artifacts.length > 0 &&
            result.artifacts.every(
              (artifact) =>
                typeof artifact.kind === "string" &&
                artifact.kind.length > 0 &&
                typeof artifact.content === "string" &&
                artifact.content.length > 0
            )
        );
      default:
        return false;
    }
  }
}

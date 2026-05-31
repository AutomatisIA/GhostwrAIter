import { CodexCliRunner } from "./codex-cli-runner";
import type { EngineRegistry } from "./engine-registry";
import {
  FrameworkPromptNotFoundError,
  SkillPromptNotFoundError,
  assembleSkillPrompt,
  createDefaultSkillPromptLoader,
  type SkillPromptLoader
} from "./skill-prompt-loader";

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
  engineRegistry?: EngineRegistry;
  promptLoader?: SkillPromptLoader;
};

export class SkillRunnerService {
  private readonly codexCliRunner?: Pick<CodexCliRunner, "isAvailable" | "execute">;
  private readonly engineRegistry?: EngineRegistry;
  private readonly promptLoader: SkillPromptLoader;

  constructor(options?: SkillRunnerOptions) {
    this.codexCliRunner = options?.codexCliRunner;
    this.engineRegistry = options?.engineRegistry;
    this.promptLoader = options?.promptLoader ?? createDefaultSkillPromptLoader();
  }

  execute(invocation: SkillRunnerInvocation): SkillRunnerResult {
    if (!this.codexCliRunner?.isAvailable()) {
      return {
        status: "failed",
        summary: "No engine available",
        error: {
          code: "ENGINE_UNAVAILABLE",
          message: "No AI engine is available or authenticated."
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
          summary: "Engine returned an invalid contract",
          error: {
            code: "ENGINE_INVALID_CONTRACT",
            message: `Engine returned a payload that does not satisfy the ${invocation.skillName} contract.`
          }
        };
      }

      return codexResult;
    } catch (error) {
      return {
        status: "failed",
        summary: "Engine execution error",
        error: {
          code: "ENGINE_EXECUTION_ERROR",
          message: error instanceof Error ? error.message : "Unknown execution error"
        }
      };
    }
  }

  async executeAsync(invocation: SkillRunnerInvocation): Promise<SkillRunnerResult> {
    if (this.engineRegistry) {
      try {
        const selection = await this.engineRegistry.getActiveEngine();
        if (selection.status.installState === "authenticated") {
          const engine = this.engineRegistry.getEngineByName(selection.engine);
          if (engine) {
            return await this.executeViaEngine(engine, invocation);
          }
        }
      } catch {
        // Fall through to sync fallback
      }
    }
    return this.execute(invocation);
  }

  private async executeViaEngine(
    engine: { executeSkill(prompt: string, timeoutMs?: number): Promise<string> },
    invocation: SkillRunnerInvocation
  ): Promise<SkillRunnerResult> {
    let skillPrompt: string;
    let frameworkPreamble: string;
    try {
      frameworkPreamble = this.promptLoader.loadFrameworkPreamble();
      skillPrompt = this.promptLoader.loadPrompt(invocation.skillName);
    } catch (err) {
      if (err instanceof FrameworkPromptNotFoundError) {
        return {
          status: "failed",
          summary: "Framework preamble missing",
          error: {
            code: "FRAMEWORK_PROMPT_NOT_FOUND",
            message: err.message
          }
        };
      }
      if (err instanceof SkillPromptNotFoundError) {
        return {
          status: "failed",
          summary: "Skill prompt missing",
          error: {
            code: "SKILL_PROMPT_NOT_FOUND",
            message: err.message
          }
        };
      }
      throw err;
    }

    const prompt = assembleSkillPrompt(invocation, skillPrompt, frameworkPreamble);
    const raw = await engine.executeSkill(prompt);

    let result: SkillRunnerResult;
    try {
      result = JSON.parse(raw) as SkillRunnerResult;
    } catch {
      return {
        status: "failed",
        summary: "Engine returned non-JSON output",
        error: {
          code: "ENGINE_INVALID_JSON",
          message: raw
        }
      };
    }

    if (result.status === "failed") {
      return result;
    }

    if (!this.isResultUsableForSkill(invocation.skillName, result)) {
      return {
        status: "failed",
        summary: "Engine returned an invalid contract",
        error: {
          code: "ENGINE_INVALID_CONTRACT",
          message: `Engine returned a payload that does not satisfy the ${invocation.skillName} contract.`
        }
      };
    }

    return result;
  }

  getRunnerMode(): "codex" | "unavailable" {
    return this.codexCliRunner?.isAvailable() ? "codex" : "unavailable";
  }

  getEngineRegistry(): EngineRegistry | undefined {
    return this.engineRegistry;
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

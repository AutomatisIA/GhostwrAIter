import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import type {
  SkillRunnerInvocation,
  SkillRunnerResult
} from "./skill-runner.service";

export type CodexCliCommandExecutor = (
  args: string[],
  input: string
) => {
  status: number | null;
  stdout: string;
  stderr: string;
  signal?: NodeJS.Signals | null;
};

const DEFAULT_CODEX_CLI_TIMEOUT_MS = 120_000;

/**
 * Reads the Codex CLI timeout from the environment variable
 * `CODEX_CLI_TIMEOUT_MS`. Accepts only a finite positive integer; any other
 * value (missing, empty, non-numeric, zero, negative) resolves to the default
 * of 120 000 ms (2 minutes). Read lazily per invocation so tests can override
 * by mutating `process.env` between calls.
 */
export function resolveCodexCliTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.CODEX_CLI_TIMEOUT_MS;
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_CODEX_CLI_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CODEX_CLI_TIMEOUT_MS;
  }
  return parsed;
}

export type CodexCliFilesystem = {
  makeTempDir: () => string;
  readFile: (path: string) => string;
  removeDir: (path: string) => void;
};

const commonCliDirectories = ["/opt/homebrew/bin", "/usr/local/bin"];

export function buildCodexCliPath(existingPath = process.env.PATH ?? "") {
  return [...existingPath.split(delimiter).filter(Boolean), ...commonCliDirectories]
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .join(delimiter);
}

function defaultExecutor(args: string[], input: string) {
  const timeoutMs = resolveCodexCliTimeoutMs();
  const result = spawnSync("codex", args, {
    input,
    encoding: "utf8",
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: buildCodexCliPath()
    },
    timeout: timeoutMs
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    signal: result.signal
  };
}

function defaultFilesystem(): CodexCliFilesystem {
  return {
    makeTempDir: () => mkdtempSync(join(tmpdir(), "linkedin-poster-codex-")),
    readFile: (path) => readFileSync(path, "utf8"),
    removeDir: (path) => rmSync(path, { recursive: true, force: true })
  };
}

export class CodexCliRunner {
  constructor(
    private readonly executor: CodexCliCommandExecutor = defaultExecutor,
    private readonly filesystem: CodexCliFilesystem = defaultFilesystem()
  ) {}

  isAvailable() {
    const result = this.executor(["login", "status"], "");
    return result.status === 0;
  }

  execute(invocation: SkillRunnerInvocation): SkillRunnerResult {
    const tempDirectory = this.filesystem.makeTempDir();
    const outputPath = join(tempDirectory, "last-message.json");

    try {
      const result = this.executor(
        [
          "exec",
          "--skip-git-repo-check",
          "--ephemeral",
          "--output-last-message",
          outputPath,
          "-"
        ],
        this.buildPrompt(invocation)
      );

      if (result.signal === "SIGTERM" && result.status === null) {
        const timeoutMs = resolveCodexCliTimeoutMs();
        return {
          status: "failed",
          summary: "Codex CLI execution timed out",
          error: {
            code: "CODEX_CLI_TIMEOUT",
            message: `Codex CLI did not respond within ${timeoutMs} ms. Increase CODEX_CLI_TIMEOUT_MS or verify Codex availability.`
          }
        };
      }

      if (result.status !== 0) {
        return {
          status: "failed",
          summary: "Codex CLI execution failed",
          error: {
            code: "CODEX_CLI_FAILED",
            message: result.stderr || result.stdout || "Unknown Codex CLI error"
          }
        };
      }

      const message = this.filesystem.readFile(outputPath).trim();

      try {
        return JSON.parse(message) as SkillRunnerResult;
      } catch {
        return {
          status: "failed",
          summary: "Codex CLI returned non-JSON output",
          error: {
            code: "CODEX_CLI_INVALID_JSON",
            message
          }
        };
      }
    } finally {
      this.filesystem.removeDir(tempDirectory);
    }
  }

  private buildPrompt(invocation: SkillRunnerInvocation) {
    const skillPrompt = this.buildSkillPrompt(invocation);

    return [
      "You are a premium LinkedIn editorial skill runner for a consultant in generative AI for SMEs.",
      "You are not allowed to degrade gracefully, simulate missing data, or invent placeholders.",
      "If the requested output cannot be produced with high confidence from the provided context, return a failed JSON response.",
      "Return only valid JSON matching the requested contract.",
      "Do not wrap the JSON in markdown fences.",
      "Never expose internal reasoning, validation grids, or hidden control logic in the final editorial output.",
      "Never invent numbers, proofs, clients, results, links, or examples that are not explicitly present in the input.",
      'Do not use "partial". If the contract cannot be fully satisfied, return "failed".',
      "",
      "Required top-level JSON fields:",
      '- "status" in ["succeeded","failed","partial"]',
      '- "summary" as a string',
      '- "data" object for successful runs',
      '- "error" object for failed runs',
      "",
      "Quality doctrine:",
      "- Exact voice over generic correctness.",
      "- Concrete over abstract.",
      "- One strong idea per output.",
      "- Anti-hype, anti-corporate, anti-generic AI phrasing.",
      "- Hooks must create tension, curiosity, or a sharp business contrast.",
      "- Structures must be compatible with the requested typology and objective.",
      "- Correction must be silent: return the corrected content, not an explanation of the correction process.",
      "",
      "Contract-specific instructions:",
      skillPrompt,
      "",
      "Invocation:",
      JSON.stringify(invocation, null, 2)
    ].join("\n");
  }

  private buildSkillPrompt(invocation: SkillRunnerInvocation) {
    switch (invocation.skillName) {
      case "linkedin-structure-selector":
        return [
          "Select exactly one narrative structure.",
          "It must fit the requested typology, audience, and business objective.",
          "Prefer structures from this family when relevant: Erreur -> consequence -> correction, Croyance -> terrain -> realite, Avant -> apres, Observation client -> lecon, Framework en 3 points, Opinion nuancee mais tranchee, Actualite -> impact PME -> recommandation.",
          'Return `data.structure` with `key`, `label`, and a rationale grounded in the user idea. No generic rationale.',
          'Return this exact success shape: {"status":"succeeded","summary":"...","data": { "structure": { "key": "...", "label": "...", "rationale": "..." }, "qualitySignals": { "clarity": 0.0, "specificity": 0.0, "antiHypeAlignment": 0.0 } },"error":null}',
          'If you cannot select a structure with confidence, return {"status":"failed","summary":"...","error":{"code":"STRUCTURE_SELECTION_FAILED","message":"..."}}.'
        ].join("\n");
      case "linkedin-hook-engine":
        return [
          "Return 3 to 5 hooks with distinct families.",
          "No soft openers, no generic LinkedIn intros, no vague abstractions.",
          "Each hook must be specific to the idea, typology, and structure.",
          "Do not repeat the raw title, and do not use shell formulas unless they are made concrete and sharply differentiated.",
          "Use these editorial references for sharpness, not for copy-paste: 'La plupart des PME ne ratent pas l IA a cause des outils.', 'Le vrai probleme avec l IA en PME n est presque jamais technique.', 'On parle beaucoup de prompts. Pas assez de process.', 'Un bon outil IA ne corrige pas une mauvaise organisation.', 'Une PME n a pas besoin de 20 cas d usage IA. Elle a besoin des 3 bons.'",
          "Avoid weak patterns such as: 'Le vrai probleme avec X...', 'Si votre projet n'avance pas...', 'Une PME n'a pas besoin de plus de ...' unless the line is materially grounded in the supplied angle.",
          "Ban openings that are now too recognizable when they are not fully earned by the input: 'On vend X comme un raccourci', 'Le sujet n est pas...', 'Le debat n est pas...', 'Dans beaucoup de PME...'.",
          "Prefer families such as direct, contrastive, diagnostic, narrative, interrogative, or signal-of-market when they fit.",
          "Score hooks honestly: do not inflate scores.",
          "Return hook scores as decimals between 0 and 1. Never use percentages like 87 or 91.",
          'Return this exact success shape: {"status":"succeeded","summary":"...","data":{"hooks":[{"family":"...","text":"...","score":0.0}],"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}',
          'If you cannot produce 3 to 5 strong hooks, return {"status":"failed","summary":"...","error":{"code":"HOOK_GENERATION_FAILED","message":"..."}}.'
        ].join("\n");
      case "linkedin-post-writer":
        return [
          "Write a publication-ready LinkedIn post in French.",
          "Do not expose internal labels such as structure names, scoring, rationale, or prompt mechanics inside the draft.",
          "Always start from the anti-style and voice profile contained in the context before writing.",
          "Respect the anti-style constraint strictly: no consultant cliches, no inflated claims, no generic corporate phrasing.",
          "The post must sound like an expert practitioner speaking to SME decision-makers.",
          "Litmus test: if it does not sound like something the person would genuinely publish, return failed and do not bluff.",
          "Use short readable paragraphs, one central idea, at least one concrete operational point, and a discreet CTA only if justified.",
          "Prefer 120 to 220 words unless the input absolutely requires more.",
          "Open with one sharp line that can stop the scroll. No warm-up paragraph.",
          "If the input compares two approaches, make the tradeoff explicit with control, cost, risk, ROI, adoption, or operational consequences.",
          "If strategy context includes an offer, audience pain, or pillar description, use them to sharpen the angle instead of staying generic.",
          "Use these editorial references for sharpness, not for copy-paste: 'La plupart des PME ne ratent pas l IA a cause des outils.', 'Le vrai probleme avec l IA en PME n est presque jamais technique.', 'On parle beaucoup de prompts. Pas assez de process.', 'Un bon outil IA ne corrige pas une mauvaise organisation.', 'Une PME n a pas besoin de 20 cas d usage IA. Elle a besoin des 3 bons.'",
          "Never start the post by repeating the headline verbatim.",
          "Avoid soft transitions such as 'dans beaucoup de PME' or 'en realite' unless immediately tied to a concrete operational contrast.",
          "Avoid generic openings such as 'On vend X comme l'etape d'apres', 'Sur le terrain', or 'Le vrai arbitrage' when they could apply to dozens of posts.",
          "Never open with formulas such as 'Le sujet n est pas...', 'Le debat n est pas...', or 'Dans beaucoup de PME...' unless they are immediately anchored in a concrete operational fact.",
          "The first two paragraphs must already contain a concrete business consequence or operational cost.",
          "Never output phrases such as 'Structure retenue', 'Ce post part d'un constat terrain', 'On gagne plus vite avec', 'Version revue', or any other meta-writing commentary.",
          "The final paragraph must sharpen the recommendation, arbitrage, or implication for an SME decision-maker. No generic landing.",
          "Return `data.draft`, optionally `data.hooks`, and realistic `qualitySignals`.",
          'Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"hooks":[{"family":"...","text":"...","score":0.0}],"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}',
          'If the draft is not publication-ready, return "failed" instead of a weak draft.'
        ].join("\n");
      case "linkedin-post-editor":
        return [
          "Rewrite and improve the draft silently.",
          "Do not append editorial commentary such as 'version reviewed' or correction notes.",
          "Strengthen clarity, specificity, rhythm, and voice while preserving the core idea.",
          "Remove generic AI phrasing, remove internal process language, and tighten the argument.",
          "Specifically remove weak formulas such as 'ce post part d'un constat', 'on gagne plus vite avec', and repeated-title openings.",
          "Return only the corrected editorial output in `data.draft`.",
          'Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}'
        ].join("\n");
      case "linkedin-repurpose":
        return [
          "Create a real editorial variant, not a cosmetic rewrite.",
          "Keep the same core idea but change the entry angle, pacing, or delivery logic.",
          "The new angle must be obvious within the first two paragraphs.",
          "Avoid generic transitions such as 'dans beaucoup de PME' or 'en realite' unless tied to a concrete decision or business contrast.",
          "Do not reuse the original headline pattern or the same opening move.",
          "Push the variant toward a genuinely different business lens, not just different wording.",
          "Prefer a clearer angle such as economics, operational risk, decision-making, adoption friction, or hidden cost if the source supports it.",
          "The first paragraph must signal the new editorial promise immediately, not after setup lines.",
          "Do not append a label like 'Variante orientee angle complementaire'. The variant itself must embody the new angle.",
          "Return the main variant in `data.draft` and list all generated variants in `data.variants`.",
          'Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"variants":[{"variantType":"...","bodyMarkdown":"..."}],"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}'
        ].join("\n");
      case "linkedin-news-to-post":
        return [
          "Turn the source into a LinkedIn post with a strong SME-relevant angle.",
          "No news summary without interpretation.",
          "Do not produce generic meta-lines such as 'Mon angle PME'. Write the editorial interpretation directly as part of the post.",
          "If the source is not specific or verifiable enough, fail instead of fabricating an angle.",
          'Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}',
          'If the source is too weak, return {"status":"failed","summary":"...","error":{"code":"NEWS_SOURCE_TOO_WEAK","message":"..."}}.'
        ].join("\n");
      case "linkedin-strategy-foundation":
        return [
          "Synthesize the editorial foundation as markdown.",
          "Preserve uncertainty explicitly when information is missing.",
          "Never fill strategic fields speculatively.",
          "Use artifacts for the human-readable output.",
          'Never place artifacts inside "data". Use the top-level "artifacts" array only.',
          'Return this exact success shape: {"status":"succeeded","summary":"...","data":{"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"artifacts": [{ "kind": "markdown", "label": "editorial_foundation", "content": "# ..." }],"error": null}',
          'If key strategic information is too incomplete to produce a usable synthesis, return {"status":"failed","summary":"...","error":{"code":"FOUNDATION_CONTEXT_INCOMPLETE","message":"..."}}.'
        ].join("\n");
      case "linkedin-topic-generator":
        return [
          "Generate a backlog of concrete post ideas, not vague themes.",
          "Each idea must connect a pain point, a typology, and a business-relevant angle.",
          "Avoid duplicates and monotonous patterns.",
          "Use artifacts for the human-readable output.",
          'Return artifacts at the top level, never nested inside "data".',
          'Return this exact success shape: {"status":"succeeded","summary":"...","data":{"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"artifacts":[{"kind":"markdown","label":"topic_backlog","content":"1. ..."}],"error":null}'
        ].join("\n");
      default:
        return [
          "If this skill is not supported, return a failed response with code SKILL_NOT_FOUND.",
          "Do not guess."
        ].join("\n");
    }
  }
}

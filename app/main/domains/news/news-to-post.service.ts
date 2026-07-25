import type { WebContents } from "electron";
import Database from "better-sqlite3";
import { IdeasRepository } from "../ideas/ideas.repository";
import {
  SkillRunnerService,
  type SkillRunnerInvocation
} from "../execution/skill-runner.service";
import {
  emitPhaseSettled,
  emitPhaseStarted
} from "../execution/execution-progress-emitter";
import type { WorkshopSession } from "../../../shared/types/workshop";
import type { StrategyBundle } from "../../../shared/types/strategy";
import { createId } from "../../shared/create-id";
import { recordExecutionRun } from "../execution/execution-runs.repository";
import { skillRunError } from "../execution/skill-run-error";
import { buildStrategyContext } from "../strategy/strategy-context";

export class NewsToPostService {
  constructor(
    private readonly db: Database.Database,
    private readonly ideasRepository: IdeasRepository,
    private readonly skillRunnerService: SkillRunnerService = new SkillRunnerService(),
    private readonly getActiveStrategy?: () => StrategyBundle | null,
    private readonly getFoundationSummary?: () => string | null
  ) {}

  async createDraftFromSource(
    input: {
      sourceTitle: string;
      sourceSummary: string;
    },
    sender?: WebContents
  ): Promise<WorkshopSession> {
    const idea = this.ideasRepository.createIdea({
      title: input.sourceTitle,
      angle: input.sourceSummary,
      pillarLabel: "Veille"
    });
    const draftId = createId("draft");
    const runId = createId("run");
    const createdAt = new Date().toISOString();
    const runnerContext = this.buildRunnerContext();

    const invocation: SkillRunnerInvocation = {
      runId,
      skillName: "linkedin-news-to-post",
      skillVersion: "1.0.0",
      context: runnerContext,
      payload: input,
      attachments: []
    };

    const announced = this.skillRunnerService.getSelectedEngineName?.() ?? "codex";
    emitPhaseStarted(sender, { runId, phase: "news", engine: announced });
    const result = await this.skillRunnerService.executeAsync(invocation);
    const usedEngine = result.engine ?? announced;

    if (result.status !== "succeeded" || !result.data?.draft) {
      emitPhaseSettled(sender, {
        runId,
        phase: "news",
        engine: usedEngine,
        status: "failed",
        errorCode: result.error?.code
      });
      throw skillRunError(result);
    }

    // Le skill linkedin-news-to-post ne renvoie PAS de hooks (contrat
    // {data:{draft, qualitySignals}}) : l accroche est dans le corps. On tolere
    // donc l absence de `hooks` (defaut tableau vide) au lieu de planter sur une
    // iteration de `undefined`. Bug revele par l eval (fixtures B), corrige ici.
    const skillHooks = result.data.hooks ?? [];

    this.db
      .prepare(`
        INSERT INTO drafts (id, idea_id, headline, body_markdown, quality_score, created_at, status, source_draft_id)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL)
      `)
      .run(
        draftId,
        idea.id,
        result.data.draft.headline,
        result.data.draft.bodyMarkdown,
        result.data.qualitySignals.clarity,
        createdAt
      );

    for (const hook of skillHooks) {
      this.db
        .prepare("INSERT INTO hooks (id, draft_id, text) VALUES (?, ?, ?)")
        .run(createId("hook"), draftId, hook.text);
    }

    this.db
      .prepare(`
        INSERT INTO draft_versions (id, draft_id, body_markdown, quality_score, reason, created_at)
        VALUES (?, ?, ?, ?, 'generation', ?)
      `)
      .run(
        createId("version"),
        draftId,
        result.data.draft.bodyMarkdown,
        result.data.qualitySignals.clarity,
        createdAt
      );

    recordExecutionRun(this.db, {
      invocation,
      result,
      ideaId: idea.id,
      draftId,
      createdAt
    });

    // "completed" emis apres la persistance reussie : si une ecriture echoue,
    // l'utilisateur ne voit pas un faux signal de succes.
    emitPhaseSettled(sender, {
      runId,
      phase: "news",
      engine: usedEngine,
      status: "completed"
    });

    return {
      idea,
      draft: {
        id: draftId,
        headline: result.data.draft.headline,
        bodyMarkdown: result.data.draft.bodyMarkdown,
        qualityScore: result.data.qualitySignals.clarity
      },
      hooks: skillHooks.map((hook, index) => ({
        id: `hook_${index}`,
        text: hook.text
      })),
      run: {
        id: runId,
        skillName: invocation.skillName,
        status: result.status,
        summary: result.summary
      },
      versions: [
        {
          id: "version_1",
          bodyMarkdown: result.data.draft.bodyMarkdown,
          qualityScore: result.data.qualitySignals.clarity,
          reason: "generation",
          createdAt
        }
      ],
      contextUsed: {
        pillarLabel: runnerContext.pillarLabel,
        voiceGuardrail: runnerContext.voiceRules
          .map((rule) => `[${rule.ruleType}] ${rule.ruleText}`)
          .join(" | "),
        activeSkills: [invocation.skillName]
      }
    };
  }

  /**
   * Contexte du parcours veille.
   *
   * Il divergeait des deux autres services : une seule regle de voix sur dix
   * (la premiere de type anti_style), un pilier code en dur, et ni offres ni
   * cibles ni bio. Cette porte d entree produisait donc structurellement des
   * posts moins alignes que les autres, sans que rien ne le signale
   * (cf. docs/audit-2026-07-editorial.md section 8). Elle utilise desormais le
   * meme contexte que l atelier et la bibliotheque.
   */
  private buildRunnerContext() {
    const strategy = this.getActiveStrategy?.();

    if (!strategy) {
      throw new Error("No active strategy bundle is available.");
    }

    // Le pilier "Veille" reste la valeur par defaut de ce parcours, mais on
    // prefere le pilier reellement declare par l utilisateur s il existe, pour
    // que sa description parte elle aussi dans le contexte.
    const pillarLabel =
      strategy.pillars.find((pillar) => /veille|actualit/i.test(pillar.label))?.label ?? "Veille";

    return buildStrategyContext(
      strategy,
      pillarLabel,
      this.getFoundationSummary?.() ?? null,
      { requireVoiceRules: true }
    );
  }

}

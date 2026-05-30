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
import { insertExecutionRun } from "../execution/execution-runs.repository";

export class NewsToPostService {
  constructor(
    private readonly db: Database.Database,
    private readonly ideasRepository: IdeasRepository,
    private readonly skillRunnerService: SkillRunnerService = new SkillRunnerService(),
    private readonly getActiveStrategy?: () => StrategyBundle | null,
    private readonly getFoundationSummary?: () => string | null
  ) {}

  createDraftFromSource(
    input: {
      sourceTitle: string;
      sourceSummary: string;
    },
    sender?: WebContents
  ): WorkshopSession {
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

    emitPhaseStarted(sender, { runId, phase: "news", engine: "codex" });
    const result = this.skillRunnerService.execute(invocation);

    if (result.status !== "succeeded" || !result.data?.draft) {
      emitPhaseSettled(sender, {
        runId,
        phase: "news",
        engine: "codex",
        status: "failed",
        errorCode: result.error?.code
      });
      throw new Error(result.error?.message ?? result.summary);
    }

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

    for (const hook of result.data.hooks) {
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

    insertExecutionRun(this.db, {
      id: runId,
      ideaId: idea.id,
      draftId,
      skillName: invocation.skillName,
      skillVersion: invocation.skillVersion,
      status: result.status,
      summary: result.summary,
      inputJson: JSON.stringify(invocation),
      outputJson: JSON.stringify(result),
      outputMarkdown: result.artifacts?.[0]?.content ?? null,
      errorMessage: null,
      logPath: null,
      startedAt: createdAt,
      finishedAt: createdAt,
      createdAt
    });

    // "completed" emis apres la persistance reussie : si une ecriture echoue,
    // l'utilisateur ne voit pas un faux signal de succes.
    emitPhaseSettled(sender, {
      runId,
      phase: "news",
      engine: "codex",
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
      hooks: result.data.hooks.map((hook, index) => ({
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
        pillarLabel: "Veille",
        voiceGuardrail: runnerContext.voiceGuardrail,
        activeSkills: [invocation.skillName]
      }
    };
  }

  private buildRunnerContext() {
    const strategy = this.getActiveStrategy?.();

    if (!strategy) {
      throw new Error("No active strategy bundle is available.");
    }

    const antiStyleRule = strategy.voiceRules.find((rule) => rule.ruleType === "anti_style")?.ruleText;

    if (!strategy.profile.id) {
      throw new Error("Strategy profile is missing an id.");
    }

    if (!antiStyleRule) {
      throw new Error("Strategy is missing an anti-style rule.");
    }

    const foundation = this.getFoundationSummary?.() ?? null;

    return {
      profileId: strategy.profile.id,
      foundationSummary: foundation,
      strategyProfileName: strategy.profile.name,
      strategyPositioning: strategy.profile.positioning,
      pillarLabel: "Veille",
      voiceGuardrail: antiStyleRule
    };
  }
}

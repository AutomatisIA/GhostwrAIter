import Database from "better-sqlite3";
import { IdeasRepository } from "../ideas/ideas.repository";
import {
  SkillRunnerService,
  type SkillRunnerInvocation
} from "../execution/skill-runner.service";
import type { WorkshopSession } from "../../../shared/types/workshop";
import type { StrategyBundle } from "../../../shared/types/strategy";

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export class NewsToPostService {
  constructor(
    private readonly db: Database.Database,
    private readonly ideasRepository: IdeasRepository,
    private readonly skillRunnerService: SkillRunnerService = new SkillRunnerService(),
    private readonly getActiveStrategy?: () => StrategyBundle | null
  ) {}

  createDraftFromSource(input: {
    sourceTitle: string;
    sourceSummary: string;
  }): WorkshopSession {
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

    const result = this.skillRunnerService.execute(invocation);

    if (result.status !== "succeeded" || !result.data?.draft) {
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

    this.db
      .prepare(`
        INSERT INTO execution_runs (
          id, idea_id, draft_id, skill_name, skill_version, status, summary, input_json, output_json,
          output_markdown, error_message, log_path, started_at, finished_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        runId,
        idea.id,
        draftId,
        invocation.skillName,
        invocation.skillVersion,
        result.status,
        result.summary,
        JSON.stringify(invocation),
        JSON.stringify(result),
        result.artifacts?.[0]?.content ?? null,
        null,
        null,
        createdAt,
        createdAt,
        createdAt
      );

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

    return {
      profileId: strategy.profile.id,
      strategyProfileName: strategy.profile.name,
      strategyPositioning: strategy.profile.positioning,
      pillarLabel: "Veille",
      voiceGuardrail: antiStyleRule
    };
  }
}

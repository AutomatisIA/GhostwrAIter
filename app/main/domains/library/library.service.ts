import Database from "better-sqlite3";
import {
  SkillRunnerService,
  type SkillRunnerInvocation
} from "../execution/skill-runner.service";
import { recordExecutionRun } from "../execution/execution-runs.repository";
import type { StrategyBundle } from "../../../shared/types/strategy";
import type {
  LibraryEntry,
  LibrarySearchInput
} from "../../../shared/types/library";

type RawLibraryRow = {
  draftId: string;
  ideaId: string;
  headline: string;
  bodyPreview: string;
  bodyMarkdown: string;
  qualityScore: number;
  createdAt: string;
  status: LibraryEntry["status"];
  pillarLabel: string;
  sourceDraftId: string | null;
  tags: string | null;
};

type VariantSourceRow = {
  draftId: string;
  ideaId: string;
  headline: string;
  bodyMarkdown: string;
  qualityScore: number;
  pillarLabel: string;
  typology: string | null;
  objective: string | null;
  structureKey: string | null;
  structureLabel: string | null;
  selectedHookText: string | null;
};

export class LibraryService {
  constructor(
    private readonly db: Database.Database,
    private readonly skillRunnerService: SkillRunnerService = new SkillRunnerService(),
    private readonly getActiveStrategy?: () => StrategyBundle | null,
    private readonly getFoundationSummary?: () => string | null
  ) {}

  listEntries(): LibraryEntry[] {
    return this.readEntries({});
  }

  searchEntries(input: LibrarySearchInput): LibraryEntry[] {
    return this.readEntries(input);
  }

  createVariantFromDraft(draftId: string): LibraryEntry {
    const source = this.db
      .prepare(`
        SELECT
          d.id AS draftId,
          d.idea_id AS ideaId,
          d.headline,
          d.body_markdown AS bodyMarkdown,
          d.quality_score AS qualityScore,
          i.pillar_label AS pillarLabel,
          d.typology AS typology,
          d.objective AS objective,
          d.structure_key AS structureKey,
          d.structure_label AS structureLabel,
          d.selected_hook_text AS selectedHookText
        FROM drafts d
        INNER JOIN ideas i ON i.id = d.idea_id
        WHERE d.id = ?
      `)
      .get(draftId) as VariantSourceRow | undefined;

    if (!source) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const variantId = `draft_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const runId = `run_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    const invocation: SkillRunnerInvocation = {
      runId,
      skillName: "linkedin-repurpose",
      skillVersion: "1.0.0",
      context: this.buildRunnerContext(source.pillarLabel),
      payload: {
        headline: source.headline,
        bodyMarkdown: source.bodyMarkdown,
        sourceQualityScore: source.qualityScore,
        originalTypology: source.typology ?? "unknown",
        originalObjective: source.objective ?? "unknown",
        originalStructureKey: source.structureKey ?? "unknown",
        originalStructureLabel: source.structureLabel ?? "unknown",
        originalHook: source.selectedHookText ?? ""
      },
      attachments: []
    };
    const result = this.skillRunnerService.execute(invocation);

    if (result.status !== "succeeded" || !result.data?.draft) {
      throw new Error(result.error?.message ?? result.summary);
    }

    const headline = result.data.draft.headline;
    const bodyMarkdown = result.data.draft.bodyMarkdown;

    this.db
      .prepare(`
        INSERT INTO drafts (
          id, idea_id, headline, body_markdown, quality_score, created_at, status, source_draft_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'variant', ?)
      `)
      .run(variantId, source.ideaId, headline, bodyMarkdown, 0.84, createdAt, source.draftId);

    this.db
      .prepare(`
        INSERT INTO draft_versions (id, draft_id, body_markdown, quality_score, reason, created_at)
        VALUES (?, ?, ?, ?, 'variant', ?)
      `)
      .run(`version_${Date.now()}`, variantId, bodyMarkdown, 0.84, createdAt);

    recordExecutionRun(this.db, {
      invocation,
      result,
      ideaId: source.ideaId,
      draftId: variantId,
      createdAt
    });

    const sourceTags = this.db
      .prepare(`
        SELECT t.label, t.normalized_label AS normalizedLabel
        FROM tag_links tl
        INNER JOIN tags t ON t.id = tl.tag_id
        WHERE tl.draft_id = ?
      `)
      .all(source.draftId) as Array<{ label: string; normalizedLabel: string }>;

    const insertTag = this.db.prepare(`
      INSERT INTO tags (id, label, normalized_label)
      VALUES (?, ?, ?)
      ON CONFLICT(normalized_label) DO UPDATE SET label = excluded.label
    `);
    const readTag = this.db.prepare("SELECT id FROM tags WHERE normalized_label = ?");
    const linkTag = this.db.prepare(`
      INSERT OR IGNORE INTO tag_links (id, draft_id, tag_id)
      VALUES (?, ?, ?)
    `);

    for (const tag of [...sourceTags, { label: "variante", normalizedLabel: "variante" }]) {
      insertTag.run(`tag_${Date.now()}_${tag.normalizedLabel}`, tag.label, tag.normalizedLabel);
      const storedTag = readTag.get(tag.normalizedLabel) as { id: string } | undefined;

      if (storedTag) {
        linkTag.run(`tag_link_${Date.now()}_${storedTag.id}`, variantId, storedTag.id);
      }
    }

    const created = this.readEntries({ query: headline }).find((entry) => entry.draftId === variantId);

    if (!created) {
      throw new Error("Variant could not be reloaded");
    }

    return created;
  }

  updateEntryText(draftId: string, headline: string, bodyMarkdown: string): void {
    const draft = this.db
      .prepare("SELECT id, status FROM drafts WHERE id = ?")
      .get(draftId) as { id: string; status: string } | undefined;

    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    this.db
      .prepare("UPDATE drafts SET headline = ?, body_markdown = ? WHERE id = ?")
      .run(headline, bodyMarkdown, draftId);

    const qualityScore = (this.db
      .prepare("SELECT quality_score AS qualityScore FROM drafts WHERE id = ?")
      .get(draftId) as { qualityScore: number }).qualityScore;

    this.db
      .prepare(`
        INSERT INTO draft_versions (id, draft_id, body_markdown, quality_score, reason, created_at)
        VALUES (?, ?, ?, ?, 'manual_edit', ?)
      `)
      .run(`version_${Date.now()}`, draftId, bodyMarkdown, qualityScore, new Date().toISOString());
  }

  deleteEntry(draftId: string): void {
    const draft = this.db
      .prepare("SELECT id FROM drafts WHERE id = ?")
      .get(draftId) as { id: string } | undefined;
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }
    this.db.prepare("DELETE FROM tag_links WHERE draft_id = ?").run(draftId);
    this.db.prepare("DELETE FROM draft_versions WHERE draft_id = ?").run(draftId);
    this.db.prepare("DELETE FROM hooks WHERE draft_id = ?").run(draftId);
    this.db.prepare("DELETE FROM calendar_items WHERE draft_id = ?").run(draftId);
    this.db.prepare("DELETE FROM drafts WHERE id = ?").run(draftId);
  }

  createDivergentVariant(sourceDraftId: string): LibraryEntry {
    const source = this.db
      .prepare(`
        SELECT
          d.id AS draftId,
          d.idea_id AS ideaId,
          d.headline,
          d.body_markdown AS bodyMarkdown,
          d.quality_score AS qualityScore,
          i.pillar_label AS pillarLabel,
          d.typology AS typology,
          d.objective AS objective,
          d.structure_key AS structureKey,
          d.structure_label AS structureLabel,
          d.selected_hook_text AS selectedHookText
        FROM drafts d
        INNER JOIN ideas i ON i.id = d.idea_id
        WHERE d.id = ?
      `)
      .get(sourceDraftId) as VariantSourceRow | undefined;

    if (!source) {
      throw new Error(`Draft not found: ${sourceDraftId}`);
    }

    const variantId = `draft_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const runId = `run_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    const invocation: SkillRunnerInvocation = {
      runId,
      skillName: "linkedin-repurpose",
      skillVersion: "2.0.0",
      context: this.buildRunnerContext(source.pillarLabel),
      payload: {
        mode: "divergent",
        sourceHeadline: source.headline,
        sourceBodyMarkdown: source.bodyMarkdown,
        sourceTypology: source.typology ?? "unknown",
        sourceObjective: source.objective ?? "unknown",
        sourceStructureKey: source.structureKey ?? "unknown",
        sourceStructureLabel: source.structureLabel ?? "unknown",
        sourceHookText: source.selectedHookText ?? "",
        sourceQualityScore: source.qualityScore
      },
      attachments: []
    };
    const result = this.skillRunnerService.execute(invocation);

    if (result.status !== "succeeded" || !result.data?.draft) {
      throw new Error(result.error?.message ?? result.summary);
    }

    const headline = result.data.draft.headline;
    const bodyMarkdown = result.data.draft.bodyMarkdown;
    const qualityScore =
      result.data.qualitySignals
        ? (result.data.qualitySignals.clarity +
            result.data.qualitySignals.specificity +
            result.data.qualitySignals.antiHypeAlignment) / 3
        : 0.8;

    this.db
      .prepare(`
        INSERT INTO drafts (
          id, idea_id, headline, body_markdown, quality_score, created_at, status, source_draft_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'variant', ?)
      `)
      .run(variantId, source.ideaId, headline, bodyMarkdown, qualityScore, createdAt, source.draftId);

    this.db
      .prepare(`
        INSERT INTO draft_versions (id, draft_id, body_markdown, quality_score, reason, created_at)
        VALUES (?, ?, ?, ?, 'variant', ?)
      `)
      .run(`version_${Date.now()}`, variantId, bodyMarkdown, qualityScore, createdAt);

    recordExecutionRun(this.db, {
      invocation,
      result,
      ideaId: source.ideaId,
      draftId: variantId,
      createdAt
    });

    const created = this.readEntries({}).find((entry) => entry.draftId === variantId);
    if (!created) {
      throw new Error("Divergent variant could not be reloaded");
    }
    return created;
  }

  private buildRunnerContext(pillarLabel: string) {
    const strategy = this.getActiveStrategy?.();

    if (!strategy) {
      throw new Error("No active strategy bundle is available.");
    }

    if (!strategy.profile.id) {
      throw new Error("Strategy profile is missing an id.");
    }

    const foundation = this.getFoundationSummary?.() ?? null;

    return {
      profileId: strategy.profile.id,
      foundationSummary: foundation,
      strategyProfileName: strategy.profile.name,
      strategyPositioning: strategy.profile.positioning,
      strategyBio: strategy.profile.bio,
      strategyExpertiseSummary: strategy.profile.expertiseSummary,
      strategyOffersSummary: this.summarizeOffers(strategy),
      strategyIcpSummary: this.summarizeIcps(strategy),
      pillarLabel,
      pillarDescription:
        strategy.pillars.find((pillar) => pillar.label === pillarLabel)?.description ?? "",
      voiceRules: strategy.voiceRules.map((rule) => ({
        category: rule.category,
        ruleType: rule.ruleType,
        ruleText: rule.ruleText
      }))
    };
  }

  private summarizeOffers(strategy: StrategyBundle) {
    return strategy.offers
      .map((offer) => `${offer.name}: ${offer.promise}. Problemes: ${offer.problems}`)
      .join(" | ");
  }

  private summarizeIcps(strategy: StrategyBundle) {
    return strategy.icps
      .map((icp) => `${icp.segment}: douleurs=${icp.pains}. objections=${icp.objections ?? ""}`)
      .join(" | ");
  }

  private readEntries(input: LibrarySearchInput): LibraryEntry[] {
    const clauses: string[] = [];
    const values: string[] = [];

    if (input.query) {
      clauses.push("(lower(d.headline) LIKE ? OR lower(d.body_markdown) LIKE ?)");
      const lowered = `%${input.query.toLowerCase()}%`;
      values.push(lowered, lowered);
    }

    if (input.pillarLabel) {
      clauses.push("i.pillar_label = ?");
      values.push(input.pillarLabel);
    }

    if (input.status) {
      clauses.push("d.status = ?");
      values.push(input.status);
    }

    if (input.tag) {
      clauses.push(`
        EXISTS (
          SELECT 1
          FROM tag_links tl2
          INNER JOIN tags t2 ON t2.id = tl2.tag_id
          WHERE tl2.draft_id = d.id AND t2.normalized_label = ?
        )
      `);
      values.push(input.tag.toLowerCase());
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = this.db
      .prepare(`
        SELECT
          d.id AS draftId,
          d.idea_id AS ideaId,
          d.headline,
          substr(d.body_markdown, 1, 140) AS bodyPreview,
          d.body_markdown AS bodyMarkdown,
          d.quality_score AS qualityScore,
          d.created_at AS createdAt,
          d.status AS status,
          i.pillar_label AS pillarLabel,
          d.source_draft_id AS sourceDraftId,
          GROUP_CONCAT(t.label, '|') AS tags
        FROM drafts d
        INNER JOIN ideas i ON i.id = d.idea_id
        LEFT JOIN tag_links tl ON tl.draft_id = d.id
        LEFT JOIN tags t ON t.id = tl.tag_id
        ${whereClause}
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `)
      .all(...values) as RawLibraryRow[];

    return rows.map((row) => ({
      ...row,
      tags: row.tags ? row.tags.split("|").filter(Boolean) : []
    }));
  }
}

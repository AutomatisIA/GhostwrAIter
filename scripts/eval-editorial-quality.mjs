#!/usr/bin/env node
// Editorial quality evaluation harness — feature 006.
// Loads 12 fixtures, exercises every skill chain through real Codex CLI calls,
// applies the deterministic grading grid, and writes a markdown + JSON report
// pair under dist-eval/. Exit code: 0 (clean), 1 (any fixture failed),
// 2 (interrupted), 3 (could not start).
//
// Local-only — never wired to GitHub Actions CI per FR-017.

import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { _electron as electron } from "playwright";
import {
  strategyBundle,
  fixtures,
  validateFixtures,
  DESCOPED_SKILLS,
  DESCOPE_REASON
} from "./eval-editorial-fixtures.mjs";
import { gradeOutput } from "./eval-editorial-grader.mjs";
import { loadEditorialDoctrineFromFile } from "./eval-editorial-doctrine-parser.mjs";

const GRADING_CONFIG = {
  bodyLengthMin: 800,
  bodyLengthMax: 2200,
  qualityScoreThreshold: 0.8
};

function parseArgs(argv) {
  const result = { fixtureId: null, fixtureType: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fixture") {
      result.fixtureId = argv[++i];
    } else if (arg === "--fixture-type") {
      result.fixtureType = argv[++i];
    }
  }
  return result;
}

function selectFixtures(filter) {
  if (filter.fixtureId) {
    return fixtures.filter((f) => f.id === filter.fixtureId);
  }
  if (filter.fixtureType) {
    return fixtures.filter((f) => f.type === filter.fixtureType);
  }
  return fixtures;
}

function captureCodexVersion() {
  try {
    const result = spawnSync("codex", ["--version"], { encoding: "utf-8" });
    if (result.status === 0) {
      return (result.stdout || result.stderr || "").trim();
    }
  } catch {
    // ignored
  }
  return "unknown";
}

function isoTimestampForFilename() {
  const now = new Date();
  return now.toISOString().replace(/[:]/g, "-").replace(/\..+/, "");
}

function ensureReportDir() {
  const reportDir = join(process.cwd(), "dist-eval");
  mkdirSync(reportDir, { recursive: true });
  return reportDir;
}

function writeJsonReport(reportDir, timestamp, report) {
  const path = join(reportDir, `eval-report-${timestamp}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2), "utf-8");
  return path;
}

function writeMarkdownReport(reportDir, timestamp, report) {
  const lines = [];
  lines.push("# Editorial Quality Evaluation Report");
  lines.push("");
  lines.push("## Run metadata");
  lines.push("");
  lines.push(`- Started: ${report.metadata.runStartedAt}`);
  lines.push(`- Finished: ${report.metadata.runFinishedAt}`);
  lines.push(`- Duration: ${report.metadata.durationMs} ms`);
  lines.push(`- Codex CLI version: ${report.metadata.codexCliVersion}`);
  lines.push(`- Fixture count: ${report.metadata.fixtureCount}`);
  lines.push(`- Body length range: ${report.metadata.grader.bodyLengthMin}–${report.metadata.grader.bodyLengthMax} chars`);
  lines.push(`- Quality score threshold: ${report.metadata.grader.qualityScoreThreshold}`);
  lines.push(`- Doctrine file: ${report.metadata.doctrineFile}`);
  lines.push(`- Interrupted: ${report.metadata.interrupted}`);
  if (report.metadata.descopedFixtures && report.metadata.descopedFixtures.length > 0) {
    lines.push(
      `- Descoped fixtures (non executees): ${report.metadata.descopedFixtures.join(", ")}`
    );
    lines.push(`- Descope reason: ${report.metadata.descopeReason}`);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total fixtures: ${report.summary.totalFixtures}`);
  lines.push(`- Pass: ${report.summary.passCount}`);
  lines.push(`- Fail: ${report.summary.failCount}`);
  lines.push(`- Pass rate: ${(report.summary.passRate * 100).toFixed(0)}%`);
  lines.push(`- **Overall verdict: ${report.summary.overallVerdict.toUpperCase()}**`);
  lines.push("");
  lines.push("## Per-rule failure counts");
  lines.push("");
  const ruleEntries = Object.entries(report.summary.perRuleFailureCounts);
  if (ruleEntries.length === 0) {
    lines.push("- (no rule violations)");
  } else {
    for (const [rule, count] of ruleEntries) {
      lines.push(`- ${rule}: ${count}`);
    }
  }
  lines.push("");
  lines.push("## Per-fixture results");
  lines.push("");
  for (const fx of report.fixtures) {
    lines.push(`### Fixture ${fx.fixtureId} (${fx.fixtureType}) — ${fx.grading.verdict.toUpperCase()}`);
    lines.push("");
    lines.push(`- Skill: ${fx.skill}`);
    lines.push(`- Invocation duration: ${fx.invocationDurationMs} ms`);
    if (fx.grading.verdict === "pass") {
      lines.push("- OK — every grading rule passed");
    } else {
      for (const v of fx.grading.violatedRules) {
        lines.push(`- **${v.rule}** — ${v.detail}`);
        if (v.excerpt) {
          lines.push("  ```");
          lines.push("  " + v.excerpt.replace(/\n/g, "\n  "));
          lines.push("  ```");
        }
      }
    }
    lines.push("");
  }
  lines.push("## Footer");
  lines.push("");
  lines.push(
    "Automated grading is necessary but not sufficient. The ultimate gate is the human litmus test: does the output sound like something the maintainer would actually publish? See `docs/editorial-iteration-playbook.md` for the iteration loop."
  );
  lines.push("");
  const path = join(reportDir, `eval-report-${timestamp}.md`);
  writeFileSync(path, lines.join("\n"), "utf-8");
  return path;
}

function buildSummary(fixtureResults) {
  const total = fixtureResults.length;
  const passCount = fixtureResults.filter((r) => r.grading.verdict === "pass").length;
  const failCount = total - passCount;
  const perRuleFailureCounts = {};
  for (const fr of fixtureResults) {
    for (const v of fr.grading.violatedRules) {
      perRuleFailureCounts[v.rule] = (perRuleFailureCounts[v.rule] || 0) + 1;
    }
  }
  return {
    totalFixtures: total,
    passCount,
    failCount,
    passRate: total === 0 ? 0 : passCount / total,
    perRuleFailureCounts,
    overallVerdict: failCount === 0 ? "pass" : "fail"
  };
}

async function exerciseFixture(page, fixture) {
  const t0 = Date.now();
  let rawOutput;
  try {
    if (fixture.skill === "linkedin-post-writer") {
      rawOutput = await page.evaluate(async (input) => {
        const idea = await globalThis.window.linkedinPoster.ideas.createIdea(input);
        const structures = await globalThis.window.linkedinPoster.workshop.getSuggestedStructures(
          idea.id,
          "expertise",
          "awareness"
        );
        const hooks = await globalThis.window.linkedinPoster.workshop.generateHooks(
          idea.id,
          "expertise",
          structures[0].key
        );
        const draft = await globalThis.window.linkedinPoster.workshop.generateFinalDraft(
          idea.id,
          "expertise",
          "awareness",
          structures[0].key,
          structures[0].label,
          hooks[0].id,
          hooks[0].text,
          hooks
        );
        return draft;
      }, fixture.payload);
    } else if (fixture.skill === "linkedin-news-to-post") {
      rawOutput = await page.evaluate(async (input) => {
        return await globalThis.window.linkedinPoster.ideas.createFromNewsSource(input);
      }, fixture.payload);
    } else {
      throw new Error(`Unsupported fixture skill: ${fixture.skill}`);
    }
  } catch (err) {
    rawOutput = {
      status: "failed",
      summary: "bench harness error",
      error: { code: "BENCH_HARNESS_ERROR", message: String(err) }
    };
  }
  const durationMs = Date.now() - t0;

  if (rawOutput && typeof rawOutput === "object" && !rawOutput.status) {
    rawOutput.status = "succeeded";
  }
  if (rawOutput && typeof rawOutput === "object") {
    rawOutput.fixtureId = fixture.id;
    rawOutput.fixtureType = fixture.type;
    rawOutput.skillName = fixture.skill;
  }

  return { rawOutput, durationMs };
}

async function main() {
  let exitCode = 0;
  const filter = parseArgs(process.argv.slice(2));

  // Pre-requis : l app packagee doit exister (le harnais lance dist-electron).
  const mainEntry = join(process.cwd(), "dist-electron", "main", "index.js");
  if (!existsSync(mainEntry)) {
    console.error(
      `Application non compilee : ${mainEntry} introuvable.\n` +
        `Lancez d abord \`npm run build\`, puis relancez \`node scripts/eval-editorial-quality.mjs\`.`
    );
    process.exit(3);
  }

  let doctrine;
  try {
    doctrine = loadEditorialDoctrineFromFile();
  } catch (err) {
    console.error(`Failed to load editorial doctrine: ${err.message}`);
    process.exit(3);
  }

  try {
    validateFixtures();
  } catch (err) {
    console.error(`Fixture catalogue invalid: ${err.message}`);
    process.exit(3);
  }

  const inScope = selectFixtures(filter);
  if (inScope.length === 0) {
    console.error(`No fixtures matched the filter ${JSON.stringify(filter)}`);
    process.exit(3);
  }

  // Partition : les fixtures dont le skill est descope sont signalees mais non
  // executees (aucun chemin d entree public). Jamais de troncature silencieuse.
  const runnable = inScope.filter((f) => !DESCOPED_SKILLS.includes(f.skill));
  const descoped = inScope.filter((f) => DESCOPED_SKILLS.includes(f.skill));
  for (const f of descoped) {
    console.log(`Fixture ${f.id} (${f.type}): DESCOPE (${f.skill}) - ${DESCOPE_REASON}`);
  }
  if (runnable.length === 0) {
    console.error(
      `Aucune fixture executable apres descope (${descoped.length} descopee(s)). ${DESCOPE_REASON}`
    );
    process.exit(3);
  }

  const codexVersion = captureCodexVersion();
  const runStartedAt = new Date().toISOString();
  const runStartedMs = Date.now();
  const benchmarkHome = mkdtempSync(join(tmpdir(), "ghostwraiter-eval-"));

  const app = await electron.launch({
    args: ["dist-electron/main/index.js"],
    env: {
      ...process.env,
      LINKEDIN_POSTER_WORKSPACE_ROOT: join(benchmarkHome, "workspace")
    }
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(120000);
  await page.waitForTimeout(1500);

  const fixtureResults = [];
  let interrupted = false;

  try {
    await page.evaluate(async (bundle) => {
      await globalThis.window.linkedinPoster.strategy.saveBundle(bundle);
    }, strategyBundle);

    for (const fixture of runnable) {
      const startedAt = new Date().toISOString();
      const { rawOutput, durationMs } = await exerciseFixture(page, fixture);
      const grading = gradeOutput(rawOutput, doctrine, GRADING_CONFIG);
      fixtureResults.push({
        fixtureId: fixture.id,
        fixtureType: fixture.type,
        skill: fixture.skill,
        invocationStartedAt: startedAt,
        invocationDurationMs: durationMs,
        rawOutput,
        grading
      });
      const verdictTag = grading.verdict.toUpperCase();
      console.log(`Fixture ${fixture.id} (${fixture.type}): ${verdictTag} (${durationMs} ms)`);
    }
  } catch (err) {
    interrupted = true;
    console.error(`Bench interrupted: ${err.message}`);
  } finally {
    try {
      await app.evaluate(async ({ app: ea }) => ea.quit());
    } catch {
      // ignored
    }
  }

  const runFinishedAt = new Date().toISOString();
  const durationMs = Date.now() - runStartedMs;

  const summary = buildSummary(fixtureResults);
  const report = {
    metadata: {
      runStartedAt,
      runFinishedAt,
      durationMs,
      codexCliVersion: codexVersion,
      fixtureCount: runnable.length,
      descopedFixtures: descoped.map((f) => f.id),
      descopeReason: descoped.length > 0 ? DESCOPE_REASON : null,
      grader: GRADING_CONFIG,
      doctrineFile: "docs/editorial-doctrine.md",
      interrupted
    },
    fixtures: fixtureResults,
    summary
  };

  const reportDir = ensureReportDir();
  const timestamp = isoTimestampForFilename();
  const mdPath = writeMarkdownReport(reportDir, timestamp, report);
  const jsonPath = writeJsonReport(reportDir, timestamp, report);
  console.log(`Report written:\n  ${mdPath}\n  ${jsonPath}`);

  if (interrupted) {
    exitCode = 2;
  } else if (summary.overallVerdict === "fail") {
    exitCode = 1;
  } else {
    exitCode = 0;
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`Bench crashed: ${err}`);
  process.exit(3);
});

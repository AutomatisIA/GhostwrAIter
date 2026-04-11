# Contract — Evaluation Report

This document defines the on-disk shape of the report pair produced by every benchmark run.

## File pair location

`dist-eval/eval-report-<ISOtimestamp>.md` and `dist-eval/eval-report-<ISOtimestamp>.json`. Both files MUST be written by the same run, atomically (markdown first, JSON second; if the JSON fails to write, the markdown is left in place but the bench reports the failure and exits non-zero).

The `dist-eval/` directory MUST be created if it does not exist. The directory MUST be added to `.gitignore` so reports never enter the repository.

## ISO timestamp format

`YYYY-MM-DDTHH-MM-SS` (colons replaced with dashes for filename safety). Example: `eval-report-2026-04-11T23-15-42.md`.

## JSON shape

```ts
type EvalReport = {
  metadata: {
    runStartedAt: string;        // ISO 8601 with timezone
    runFinishedAt: string;       // ISO 8601 with timezone
    durationMs: number;
    codexCliVersion: string;     // captured by running `codex --version` once at startup
    fixtureCount: number;        // 12 for a full run, 1 for --fixture, 3 for --fixture-type
    grader: {
      bodyLengthMin: number;
      bodyLengthMax: number;
      qualityScoreThreshold: number;
    };
    doctrineFile: string;        // path to the doctrine markdown that was loaded
    interrupted: boolean;        // true if the run did not complete every fixture
  };
  fixtures: Array<{
    fixtureId: string;           // "A1", "B2", etc.
    fixtureType: "A" | "B" | "C" | "D";
    skill: string;               // e.g. "linkedin-post-writer"
    invocationStartedAt: string; // ISO 8601
    invocationDurationMs: number;
    rawOutput: {
      status: "succeeded" | "failed";
      summary?: string;
      headline?: string;
      bodyMarkdown?: string;
      qualityScore?: number;
      error?: { code: string; message: string };
    };
    grading: {
      verdict: "pass" | "fail";
      violatedRules: Array<{
        rule:
          | "skill-refused"
          | "banned-opening"
          | "banned-meta-phrase"
          | "headline-repeated"
          | "body-length-out-of-range"
          | "no-concrete-element"
          | "quality-score-below-threshold";
        detail: string;
        excerpt?: string;
      }>;
      bodyLength: number | null;
      qualityScore: number | null;
    };
  }>;
  summary: {
    totalFixtures: number;
    passCount: number;
    failCount: number;
    passRate: number;            // 0..1
    perRuleFailureCounts: Record<string, number>;
    overallVerdict: "pass" | "fail";
  };
};
```

## Markdown shape

The markdown file is generated from the same `EvalReport` structure but rendered for human reading. Required sections in order:

1. `# Editorial Quality Evaluation Report` — top heading.
2. `## Run metadata` — bullet list of `runStartedAt`, `durationMs`, `codexCliVersion`, fixture count, grader config, doctrine file path.
3. `## Summary` — bullet list of total / pass / fail counts and pass rate, plus overall verdict in bold.
4. `## Per-rule failure counts` — bullet list of `<ruleName>: <count>` for every rule that had at least one violation across the run.
5. `## Per-fixture results` — for each fixture, an `### Fixture <id> (<type>) — <verdict>` heading followed by:
   - The skill name and invocation duration.
   - If the verdict is `pass`: a one-line "OK" confirmation.
   - If the verdict is `fail`: a bulleted list of every violated rule with `detail` and `excerpt` (excerpts are fenced with triple backticks).
6. `## Footer` — a paragraph reminding the reader that automated grading is necessary but not sufficient, and pointing them at `docs/editorial-iteration-playbook.md` for the human "litmus test" guidance.

## Exit code rules

| Condition | Exit code |
|---|---|
| Every fixture in scope passes every rule | 0 |
| At least one fixture fails any rule | 1 |
| Bench was interrupted before finishing every in-scope fixture (Ctrl-C, uncaught exception) | 2 |
| Bench could not start (Codex CLI not authenticated, doctrine file missing, fixture file malformed, etc.) | 3 |

The exit code is the contract that lets a contributor wire `npm run eval:editorial && echo OK || echo KO` into a shell loop without parsing the report file.

## Determinism guarantees

- The report pair is written atomically: the markdown lands first, then the JSON. If the JSON write fails, the markdown is removed before the process exits with code 3.
- The report includes a `runStartedAt` timestamp captured at the very beginning of the bench so a contributor can correlate the file with their git commit at the moment they pressed enter.
- The Codex CLI version footer makes Codex output variance auditable: if two runs against an unchanged prompt produce different verdicts, comparing the version strings tells the contributor whether Codex itself changed.

## Filesystem hygiene

- Reports older than 30 days are NOT auto-deleted by the bench. The maintainer is expected to clean `dist-eval/` periodically by hand or with `find dist-eval -type f -mtime +30 -delete` (documented in the playbook).
- Two runs that complete inside the same second produce two reports with the same timestamp filename — the second overwrites the first. This is acceptable because the maintainer never runs the bench twice in the same second during normal iteration.

## Test coverage

The exact JSON shape is asserted by `tests/unit/eval-editorial-grader.test.ts` indirectly (through the `GradingResult` type) and by a small additional test in the bench script's own startup that validates the report writer can serialise a synthetic report and round-trip it through `JSON.parse`. The markdown shape is NOT unit-tested (formatting is incidental); it is manually verified during quickstart Step 5.

# Data Model — Feature 006: Editorial Quality Evaluation Infrastructure

This feature introduces no database tables, no schema migration, and no IPC channel. It introduces five file-system entities and three in-memory record shapes used by the loader, the parser, and the grader. Each entity is defined here once and referenced from the contracts and the implementation tasks.

## File-system entities

### `skills/linkedin-<name>/SKILL.md`

A per-skill markdown document. Owned by the editor (Philippe), read by the runner at every Codex invocation.

| Section | Required? | Content |
|---|---|---|
| `# linkedin-<name>` | yes | Title heading. Identifies the skill. Must match the directory name. |
| `## Purpose` | yes | One-paragraph description of what the skill does in the editorial workflow. Pre-existing content from the stub is preserved. |
| `## Inputs` | yes | Bulleted list of the inputs the skill expects (idea, hook, structure, strategy bundle, etc.). Pre-existing. |
| `## Outputs` | yes | Bulleted list of the outputs the skill produces (draft markdown, hooks, quality signals, etc.). Pre-existing. |
| `## Prompt` | **NEW (yes)** | Free-text body containing the exact text that today corresponds to one `case "linkedin-..."` arm of `buildSkillPrompt()` in the runner. Byte-for-byte identical to the inline content per FR-002. |

**Eight instances**, one per skill: `linkedin-strategy-foundation`, `linkedin-topic-generator`, `linkedin-structure-selector`, `linkedin-hook-engine`, `linkedin-post-writer`, `linkedin-post-editor`, `linkedin-repurpose`, `linkedin-news-to-post`.

### `docs/editorial-doctrine.md`

A single markdown document holding the canonical editorial rules. Read by the grader and by the unit tests.

| Section | Required? | Content |
|---|---|---|
| `# Editorial doctrine` | yes | Title heading and one-paragraph orientation pointing the reader at the playbook. |
| `## Banned Openings` | yes | Bulleted list of soft-opener phrases the grader rejects unless rescued by an immediately following concrete fact. |
| `## Banned Meta Phrases` | yes | Bulleted list of meta phrases the grader rejects unconditionally. |
| `## Voice Rules` | yes | Bulleted list of voice rules. Documentation only — the grader does not enforce them programmatically (they are read by the human iteration loop). |
| `## Concrete-Element Heuristics` | yes | Sub-sectioned bulleted lists for the four categories (numbers/units, operational-cost keywords, business-consequence keywords, arbitrage keywords). The grader loads these to evaluate the concrete-element rule. |

The parser tolerates leading and trailing whitespace inside list items, ignores empty lines, and treats sub-headings as comments. Anything outside the four labelled sections is informational and ignored by the parser.

### `scripts/eval-editorial-fixtures.mjs`

The fixture catalogue + the strategy bundle. ES module exporting:

- `strategyBundle` — the existing object structure from `scripts/benchmark-editorial-quality.mjs` (profile, offers, icps, voice rules, content pillars), moved here verbatim.
- `fixtures` — an array of exactly twelve `EditorialFixture` records (see in-memory shape below).

### `scripts/eval-editorial-quality.mjs`

The bench harness. Imports `strategyBundle` and `fixtures` from the file above, imports the doctrine via the parser, exercises the skill chain through Electron + Playwright + the existing IPC surface, captures every output, runs the grader against each output, writes the report pair under `dist-eval/`, and exits with the appropriate status code.

### `dist-eval/eval-report-<ISOtimestamp>.{md,json}`

Per-run output. Pair of files. Markdown is for human reading; JSON has the same content for tooling. Path is excluded from git via `.gitignore`. See `contracts/eval-report.md` for the exact shape.

## In-memory shapes

### `EditorialFixture`

```ts
type EditorialFixture = {
  id: string;                    // "A1", "A2", ..., "D3"
  type: "A" | "B" | "C" | "D";   // canonical input type
  label: string;                 // short human description for the report
  skill:                         // which skill chain to invoke
    | "linkedin-post-writer"
    | "linkedin-news-to-post"
    | "linkedin-post-editor";
  payload: Record<string, unknown>; // shape depends on the targeted skill
};
```

**Validation rules** enforced at bench startup:

- `id` matches `/^[A-D][1-9][0-9]?$/`.
- `type` matches the first character of `id`.
- Exactly twelve fixtures total, exactly three per type.
- For type A: `payload` includes `title`, `angle`, `pillarLabel`, `persona`.
- For type B: `payload` includes `title`, `sourceText`, `pillarLabel`.
- For type C: `payload` includes `clientContext`, `problem`, `intervention`, `outcome`, `pillarLabel`.
- For type D: `payload` includes `draftMarkdown`, `qualityIssue`.

### `EditorialDoctrine`

```ts
type EditorialDoctrine = {
  bannedOpenings: string[];           // exact substrings to scan for
  bannedMetaPhrases: string[];        // exact substrings to scan for
  voiceRules: string[];               // documentation only, not enforced programmatically
  concreteHeuristics: {
    numberRegex: RegExp;              // hardcoded in the parser, not editable from .md
    operationalCostKeywords: string[];
    businessConsequenceKeywords: string[];
    arbitrageKeywords: string[];
  };
};
```

The parser returns this shape from `parseEditorialDoctrine(markdown: string): EditorialDoctrine`. The number regex is constructed in the parser itself (it does not come from the markdown) because numeric detection is a fixed pattern that does not change with editorial taste — see research D2.

### `GradingResult`

```ts
type GradingResult = {
  fixtureId: string;
  fixtureType: "A" | "B" | "C" | "D";
  skill: string;
  verdict: "pass" | "fail";
  violatedRules: Array<{
    rule:
      | "banned-opening"
      | "banned-meta-phrase"
      | "headline-repeated"
      | "body-length-out-of-range"
      | "no-concrete-element"
      | "quality-score-below-threshold"
      | "skill-refused";
    detail: string;       // short reason, e.g., "Detected banned opening 'En réalité' at sentence 1"
    excerpt?: string;     // up to 200 characters of the offending output
  }>;
  durationMs: number;
  qualityScore: number | null;
  bodyLength: number;
};
```

Every grading rule check produces zero or one `violatedRules` entry. The verdict is `pass` if and only if `violatedRules` is empty. The grader is a pure function `gradeOutput(output: SkillOutput, doctrine: EditorialDoctrine, config: GradingConfig): GradingResult`.

### `GradingConfig`

```ts
type GradingConfig = {
  bodyLengthMin: number;            // default 800
  bodyLengthMax: number;            // default 2200
  qualityScoreThreshold: number;    // default 0.80
};
```

Tunable defaults exposed as constants at the top of `eval-editorial-quality.mjs`.

## Lifecycle and ownership

| Entity | Created by | Modified by | Read by |
|---|---|---|---|
| `skills/linkedin-<name>/SKILL.md` | feature 006 (extraction) | maintainer (post-ship iteration) | runner (every invocation), unit tests |
| `docs/editorial-doctrine.md` | feature 006 | maintainer (when doctrine evolves) | grader, unit tests, playbook reader |
| `eval-editorial-fixtures.mjs` | feature 006 | maintainer (adding new fixtures) | bench script, fixture-shape unit tests |
| `eval-editorial-quality.mjs` | feature 006 | rare — only for grader changes | maintainer (every iteration) |
| `dist-eval/eval-report-*.{md,json}` | bench (per run) | never | maintainer (review), future tooling |

No entity has a database identity. No entity participates in a state machine. The lifecycle is "edited by humans, read by code".

# Contract — Grading Grid

This document defines the deterministic grading grid that the bench applies to every captured Codex output. The contract is enforced by `tests/unit/eval-editorial-grader.test.ts`.

## Module location

`scripts/eval-editorial-grader.mjs` (ES module imported by `eval-editorial-quality.mjs` and tested directly by Vitest via dynamic import).

## Public function

```ts
export function gradeOutput(
  output: SkillOutput,
  doctrine: EditorialDoctrine,
  config: GradingConfig
): GradingResult;
```

`SkillOutput` is the JSON shape returned by a successful skill invocation: at minimum it has `status`, `summary`, `data.draft.headline`, `data.draft.bodyMarkdown`, and `data.qualitySignals` (or the equivalent for the post-editor and news-to-post skills).

The grader is a pure function: same input, same output, every time. No filesystem access, no clock, no network.

## Rules in order of evaluation

The grader applies every rule and collects every violation. It does NOT short-circuit on the first failure — the report should list every reason a fixture failed so the maintainer can fix multiple issues per iteration.

### Rule 1 — Skill did not refuse

- **Check**: `output.status !== "failed"`.
- **On fail**: append `{ rule: "skill-refused", detail: output.error?.message ?? "Skill returned failed status" }`.
- **Note**: If this rule fails, every other rule MUST be skipped because there is no draft body to grade. The verdict is `fail` with a single violation.

### Rule 2 — No banned opening

- **Check**: For each `phrase` in `doctrine.bannedOpenings`, scan the first sentence (everything up to the first `.`, `!`, or `?`) of `data.draft.bodyMarkdown`. If the phrase appears (case-insensitive substring match), evaluate the rescue clause.
- **Rescue clause**: The match is rescued (not a violation) if the SAME first sentence ALSO matches at least one of the four concrete-element categories defined in Rule 5. The rationale: the doctrine allows banned openings only when immediately anchored in a concrete fact.
- **On fail (no rescue)**: append `{ rule: "banned-opening", detail: "Detected banned opening '<phrase>' at sentence 1 with no concrete anchor", excerpt: <first 200 chars of sentence> }`.

### Rule 3 — No banned meta phrase

- **Check**: For each `phrase` in `doctrine.bannedMetaPhrases`, scan the entire `data.draft.bodyMarkdown` (case-insensitive substring match).
- **No rescue clause**: meta phrases are unconditional bans.
- **On fail**: append `{ rule: "banned-meta-phrase", detail: "Detected banned meta phrase '<phrase>'", excerpt: <200 chars around the match> }`.

### Rule 4 — Headline not repeated in opening

- **Check**: The `data.draft.headline` MUST NOT appear verbatim (case-insensitive) inside the first two sentences of `data.draft.bodyMarkdown`. Sentence boundaries are `.`, `!`, `?`.
- **On fail**: append `{ rule: "headline-repeated", detail: "Headline appears verbatim in first two sentences", excerpt: <first 200 chars of body> }`.

### Rule 5 — Body length within range

- **Check**: `config.bodyLengthMin <= data.draft.bodyMarkdown.length <= config.bodyLengthMax`.
- **On fail**: append `{ rule: "body-length-out-of-range", detail: "Body is <N> chars, expected <min>-<max>" }`.

### Rule 6 — At least one concrete element

- **Check**: At least ONE of the four categories matches the body:
  - **Numbers** — `doctrine.concreteHeuristics.numberRegex.test(body)`.
  - **Operational cost** — at least one keyword from `doctrine.concreteHeuristics.operationalCostKeywords` appears in the body (case-insensitive substring).
  - **Business consequence** — at least one keyword from `doctrine.concreteHeuristics.businessConsequenceKeywords` appears.
  - **Arbitrage** — at least one keyword from `doctrine.concreteHeuristics.arbitrageKeywords` appears.
- **On fail (zero categories matched)**: append `{ rule: "no-concrete-element", detail: "Body contains no number, operational cost, business consequence, or arbitrage keyword" }`.
- **On pass**: the report MAY record which category(ies) matched, for diagnostic value.

### Rule 7 — Quality score above threshold

- **Check**: The skill output's reported quality score (`data.qualitySignals.clarity`, `data.qualitySignals.specificity`, `data.qualitySignals.antiHypeAlignment` averaged, or `data.qualityScore` directly if the skill returns a single number — the grader normalises both shapes) is `>= config.qualityScoreThreshold`.
- **On fail**: append `{ rule: "quality-score-below-threshold", detail: "Quality score <X> is below threshold <Y>" }`.

## Verdict aggregation

- If `violatedRules.length === 0`, `verdict = "pass"`.
- Otherwise `verdict = "fail"`.
- The grader does not weight rules — any single violation flips the verdict to fail. This is the "strict gate" mode chosen during clarification.

## Skill-specific quirks

| Skill | Body source | Headline source |
|---|---|---|
| `linkedin-post-writer` | `data.draft.bodyMarkdown` | `data.draft.headline` |
| `linkedin-news-to-post` | `data.draft.bodyMarkdown` | `data.draft.headline` |
| `linkedin-post-editor` | `data.editedDraft.bodyMarkdown` | `data.editedDraft.headline` |

The grader normalises these via a small adapter so the rule code only sees `body` and `headline` strings.

## Test fixtures expected by `tests/unit/eval-editorial-grader.test.ts`

The test file constructs synthetic `SkillOutput` records and a synthetic `EditorialDoctrine` (no file IO) and feeds them to `gradeOutput()`. Cases covered, one per rule plus integration:

1. Output with `status: "failed"` returns `verdict: "fail"` with a single `skill-refused` violation, no other rules evaluated.
2. Output with banned opening "En réalité" but no rescue → fails with `banned-opening`.
3. Output with banned opening "En réalité" followed by a number "42%" → passes Rule 2 (rescue clause).
4. Output with meta phrase "Structure retenue" anywhere in body → fails with `banned-meta-phrase`.
5. Output where headline appears verbatim in sentence 1 → fails with `headline-repeated`.
6. Output where headline appears in sentence 3 → passes Rule 4.
7. Body of 500 chars (below min 800) → fails with `body-length-out-of-range`.
8. Body of 2500 chars (above max 2200) → fails with `body-length-out-of-range`.
9. Body of 1500 chars (in range) → passes Rule 5.
10. Body containing the operational cost keyword "supervision" → passes Rule 6 via the operational cost category.
11. Body containing only generic prose with no numbers and no doctrine keywords → fails with `no-concrete-element`.
12. Quality score 0.75 → fails with `quality-score-below-threshold`.
13. Quality score 0.85 → passes Rule 7.
14. Output that violates two rules (banned opening + body too short) → returns both violations in the result.
15. Output that passes every rule → returns `verdict: "pass"` with empty `violatedRules`.

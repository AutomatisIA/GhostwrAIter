# Research — Feature 006: Editorial Quality Evaluation Infrastructure

## D1 — Storage format and location of the editorial doctrine

**Decision**: A single human-readable markdown file at `docs/editorial-doctrine.md` with four labelled sections (`## Banned Openings`, `## Banned Meta Phrases`, `## Voice Rules`, `## Concrete-Element Heuristics`). Each section is a standard markdown bulleted list. A small line-based parser (≈30 lines) under `app/main/domains/execution/editorial-doctrine-parser.ts` extracts the four lists at runtime and exposes them as typed arrays to the grader and the unit tests.

**Rationale**: Resolved by Clarification Q1. The doctrine evolves continuously as Philippe iterates on the editorial line. Storing it as TypeScript constants would force every doctrine edit through typecheck, lint, and recompilation, defeating the purpose of the feature. Storing it as JSON would lose the human readability that the playbook needs to link to. Markdown with labelled sections gives both: contributors can read and edit the file directly, the playbook can link to it as-is, and the parser is trivially auditable. The parser is dedicated rather than a generic markdown library because it only needs to recognise four well-known headings and the bullets under each.

**Alternatives considered**:

- TypeScript constants file (`editorial-doctrine.ts`) — rejected, requires recompilation on every doctrine edit and is not readable to non-technical contributors.
- JSON file (`_doctrine.json`) — rejected, less readable than markdown and out of place under `docs/`.
- Inline lists in the bench script — rejected, violates the single source of truth principle and makes the doctrine invisible to the playbook reader.
- A real markdown library (`remark`, `marked`) — rejected, adds a runtime dependency for a parsing job that fits in 30 lines of regex.

## D2 — Concrete-element detection heuristic

**Decision**: Multi-pattern detection across four named categories: (1) numbers via regex matching digits with optional units, (2) operational-cost keywords, (3) business-consequence keywords, (4) arbitrage keywords. At least one of the four categories must match the output body for the rule to pass. The keyword lists for categories 2, 3, and 4 live in `docs/editorial-doctrine.md` under `## Concrete-Element Heuristics` so doctrine edits never require code changes. The number regex is hardcoded in the grader because it is a fixed pattern (digits + optional unit) that does not change with editorial taste.

**Rationale**: Resolved by Clarification Q2. The doctrine talks about "elements concrets" qualitatively — number, business consequence, operational cost, arbitrage. A grader needs a programmatic substitute. Multi-category detection captures the four flavours separately so the report can say which kind of concrete element saved the fixture, which is useful for prompt iteration. Detection by keyword (categories 2-4) is editable doctrine. Detection by regex (category 1) is fixed because numbers are an objective signal. At least one category match is the threshold because requiring all four would be unrealistic for any single LinkedIn post.

**Alternatives considered**:

- Number-only detection — rejected, would reject good qualitative posts that talk about operational costs without numbers.
- Single flat keyword list with no categories — rejected, the report would lose the diagnostic value of knowing why a fixture passed or failed the rule.
- Per-fixture annotation of the expected concrete element — rejected, couples each fixture to its expectation and makes adding new fixtures expensive.
- Sentiment analysis or NLP classifier — rejected, introduces non-determinism and a runtime dependency for a job that is fundamentally a keyword scan.

## D3 — Default body length range and quality score threshold

**Decision**: Body length 800–2200 characters, quality score threshold ≥ 0.80. Both values live as exported constants at the top of `scripts/eval-editorial-quality.mjs` so they are tunable in one place after the feature ships.

**Rationale**: Resolved by Clarification Q3. 800 characters is roughly 120 words — the minimum credible length for an opinion post on LinkedIn. 2200 characters maps to LinkedIn's mobile "see more" truncation window, after which the reader has to click to keep going; this is a natural ceiling for an editorial post. The 0.80 threshold mirrors the doctrine "refuse rather than ship a weak draft" — letting 0.7 through would be too permissive for a post-feature gate. The values are starting defaults, not optima; the maintainer will tune them as part of the post-ship editorial iteration loop.

**Alternatives considered**:

- 600–3000 chars / quality ≥ 0.75 — rejected, too permissive for a strict gate.
- 1000–1800 chars / quality ≥ 0.85 — rejected, too strict for the first run; risk that all twelve fixtures fail at the start, making the bench unusable.
- 800–2500 chars / quality ≥ 0.80 (range from the original brief) — close to the chosen value but the 2500 ceiling exceeds the LinkedIn mobile truncation window, so it would let through posts the reader cannot see in full.

## D4 — Test compatibility strategy for `codex-cli-runner.test.ts`

**Decision**: The `CodexCliRunner` constructor accepts a third dependency `SkillPromptLoader`. The default loader reads `skills/linkedin-<name>/SKILL.md` from the repo at every invocation. The existing `tests/unit/codex-cli-runner.test.ts` tests instantiate the runner with the default loader (no stub) so the assertions like `expect(prompt).toContain("Anti-hype")` continue to match because the migrated `SKILL.md` content is byte-for-byte identical to today's inline content (FR-002). Negative-path tests (missing file, empty prompt section) instantiate the runner with a stub loader that throws or returns the simulated condition.

**Rationale**: Resolved by Clarification Q4. This is the only strategy that simultaneously satisfies (a) FR-007 — no assertion text changes, (b) FR-003 — invocation reads from disk, (c) Constitution IV — tests still observe failures before implementation, and (d) the byte-for-byte rule from FR-002. The default loader path is the primary execution path in tests, mirroring production exactly. The stub loader is reserved for the negative cases. Dependency injection through the constructor is consistent with how `executor` and `filesystem` are already injected today.

**Alternatives considered**:

- Stub loader with copy-pasted prompt strings in tests — rejected, violates DRY and creates two sources of truth for the same prompt content.
- Static load at runner startup — rejected, breaks FR-003 (editing a `SKILL.md` would require restarting the application).
- Test helper module that loads the prompts — rejected, adds indirection for the same outcome as default-loader injection.
- Mocking `node:fs.readFileSync` globally — rejected, fragile, leaks across tests, and breaks parallelisation.

## D5 — Per-fixture filter UX for the bench

**Decision**: CLI flag passed through the npm script wrapper: `npm run eval:editorial -- --fixture A1` runs only fixture A1, `npm run eval:editorial -- --fixture-type A` runs all three fixtures of type A, and an absent flag runs all twelve. Fixture identifiers follow the convention `<TypeLetter><Index>` (A1, A2, A3, B1, ..., D3) so they are stable across runs and easy to mention in commit messages and the playbook.

**Rationale**: Resolved by Clarification Q5. The double-dash convention is the npm-standard way to forward arguments to the underlying script and it is documented in npm-cli-docs, so contributors do not need a project-specific shell trick. Explicit flags beat environment variables because they show up in the shell history and in the CI logs (when the bench is run from a script). The fixture identifier convention `<TypeLetter><Index>` is short enough to type live during iteration and unambiguous enough to grep across reports.

**Alternatives considered**:

- Environment variable `EVAL_FIXTURE=A1` — rejected, less discoverable, invisible in shell history, harder to grep.
- A `.eval-config.json` file with a `fixtureFilter` field — rejected, too heavy for a toggle used dozens of times per iteration.
- No filter — rejected, makes a single-fixture iteration loop impossible.

## D6 — Skill prompt extraction granularity

**Decision**: Migrate ONLY the contents of `buildSkillPrompt()` (the per-skill switch arms, lines ~192-300 of `codex-cli-runner.ts`) to the eight `SKILL.md` files. The wrapping `buildPrompt()` method (lines ~156-190) — which prepends the premium runner system prompt and appends the JSON-serialised invocation block — STAYS IN THE RUNNER. Each `SKILL.md` `## Prompt` section contains exactly the text that today corresponds to one `case "linkedin-..."` arm of the switch.

**Rationale**: The system prompt envelope is invariant across skills. It encodes the runner contract (status / summary / data / error fields, anti-hype doctrine, no partial status, no inventing facts) and is the same string regardless of which skill is being invoked. Pushing it into every `SKILL.md` would duplicate it eight times and create a synchronisation hazard. Pushing it into a separate "envelope.md" file would create a third reading layer that the maintainer would have to context-switch through. Keeping the envelope in the runner and only externalising the per-skill arm gives the cleanest split: one file per skill, identical structure, and the runner stays responsible for "how to talk to Codex" while the SKILL.md files become "what each skill is for".

**Alternatives considered**:

- Migrate the full `buildPrompt()` body into each `SKILL.md` — rejected, eight-fold duplication of the envelope.
- Add an `envelope.md` file referenced by every `SKILL.md` — rejected, introduces a templating layer for no benefit.
- Migrate to a single `skills.md` master file with all eight prompts — rejected, defeats the point of having one file per skill.

## D7 — Strategy bundle reuse for the bench

**Decision**: Reuse the `strategyBundle` already defined in the existing `scripts/benchmark-editorial-quality.mjs` (positionnement, ICPs, voice rules, content pillars). Move it into `scripts/eval-editorial-fixtures.mjs` next to the fixture list so the bench script imports both from the same module. Do not extend the bundle for this feature — the doctrine in the bundle is already aligned with `docs/editorial-doctrine.md` (which is itself derived from the cabinet's source documents) and any further alignment is post-ship editorial work.

**Rationale**: The existing bundle has been validated by the existing real-app audit and matches the cabinet doctrine. Re-deriving it from scratch for this feature would be wasted work and risk drift from the existing audit. Moving it next to the fixtures keeps the bench script lean.

**Alternatives considered**:

- Inline the bundle in `eval-editorial-quality.mjs` — rejected, mixes responsibilities (test data lives next to test runner, not in the runner itself).
- Read the bundle from a JSON file — rejected, the existing bundle is already TypeScript-typed via the IPC schemas of feature 003; staying in JavaScript with the same shape costs nothing.
- Generate the bundle from the doctrine file — rejected, the bundle and the doctrine cover overlapping but distinct concerns (the bundle is the maintainer's *own* persona settings, the doctrine is the universal editorial rules).

## D8 — Report format and on-disk location

**Decision**: Each benchmark run produces two files under `dist-eval/`: a markdown file `eval-report-<ISOtimestamp>.md` for human reading, and a JSON file `eval-report-<ISOtimestamp>.json` with the same content for diff and tooling. The timestamp uses ISO 8601 in the filename so reports sort chronologically when listed. `dist-eval/` is added to `.gitignore` so reports never land in the repository.

**Rationale**: Markdown is what the maintainer will read in 95% of cases — the playbook is built around it. JSON is the parallel format for any future tooling (CI ingestion, history diff, prompt-iteration trend tracking) without imposing it on the immediate iteration loop. ISO timestamps give natural sorting in `ls dist-eval/`. `dist-eval/` matches the project's existing convention (`dist-app/`, `dist-launcher/`, `dist-electron/`) for build outputs that should not be committed.

**Alternatives considered**:

- A single JSON file overwritten on each run — rejected, loses iteration history.
- A SQLite database under `dist-eval/` — rejected, overkill for what is essentially append-only run history.
- A markdown-only report — rejected, blocks future tooling that needs structured input.
- Reports under `tmp/` or `/tmp` — rejected, less discoverable than `dist-eval/` and inconsistent with the existing `dist-*` convention.

## D9 — Bench exclusion from CI

**Decision**: The bench is invoked exclusively by `npm run eval:editorial` from the operator's local machine. It is NOT added to any GitHub Actions workflow. The CI matrix from feature 005 (`ci.yml`) continues to gate the loader, the parser, and the grader unit tests, but never the bench itself.

**Rationale**: The bench fires real Codex CLI calls against the operator's authenticated OAuth session, which (a) requires a credential that cannot live on a CI runner without committing a secret (FR-025), (b) costs real LLM tokens on every run (a non-trivial budget item if pull requests trigger it automatically), and (c) is slow (~30-60 seconds per fixture × 12 fixtures). The unit tests for the loader, parser, and grader are pure, fast, deterministic, and CI-safe — they cover everything that can be checked without invoking Codex.

**Alternatives considered**:

- Run the bench on a self-hosted runner with a Codex token — rejected, introduces a secret into the infrastructure and a runner the maintainer would have to manage.
- Run the bench in a special manual `workflow_dispatch` workflow — rejected, the bench is intended as part of the local iteration loop, not an event the maintainer triggers from the GitHub UI.
- Mock the Codex CLI in a CI run — rejected, defeats the purpose of measuring real editorial quality.

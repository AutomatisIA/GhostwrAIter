# Editorial Iteration Playbook

This playbook is the daily working document for iterating on the LinkedIn Poster editorial prompts. Read it once end to end before your first iteration session, then keep it open as a reference.

The playbook assumes you have already cloned the repository, run `npm ci`, run `npm run rebuild:native:electron`, run `npm run build`, and authenticated the Codex CLI on your local machine. None of those one-time setup steps repeat between iterations.

## 1. Running the benchmark

The benchmark is invoked via:

```bash
npm run eval:editorial
```

This launches the Electron app in headless mode through Playwright, exercises every fixture against the appropriate skill chain through real Codex CLI calls, applies the deterministic grading grid to each output, writes a markdown + JSON report pair under `dist-eval/`, and exits with a status code reflecting the verdict.

A full run of all 12 fixtures takes approximately 12 to 15 minutes depending on Codex latency. A single-fixture run takes about 30 to 60 seconds.

The four exit codes are:

| Code | Meaning |
|---|---|
| 0 | Every in-scope fixture passed every grading rule |
| 1 | At least one fixture failed at least one rule |
| 2 | The bench was interrupted before finishing every in-scope fixture |
| 3 | The bench could not start (Codex CLI not authenticated, doctrine file invalid, fixture catalogue malformed) |

You can chain the bench into a shell loop with `npm run eval:editorial && echo OK || echo KO`.

## 2. Reading the report

Reports are written to `dist-eval/eval-report-<ISOtimestamp>.{md,json}` in pairs. The markdown file is for human reading; the JSON sibling is for tooling and history diff.

The markdown report has six sections:

1. **Run metadata** — when the run started and finished, how long it took, the Codex CLI version that produced the outputs, the grader configuration, and the path to the doctrine file used.
2. **Summary** — total / pass / fail counts and the overall verdict in bold.
3. **Per-rule failure counts** — a histogram showing which grading rules failed how many times across the run. This is the fastest way to spot a systemic prompt issue (for example "every fixture failed `banned-opening`" means the prompt is teaching Codex a banned phrase).
4. **Per-fixture results** — one block per fixture, with the verdict, the skill name, the duration, and (for fails) every violated rule with its detail and excerpt.
5. **Footer** — a reminder that automated grading is necessary but not sufficient, with a pointer back to this playbook.

To find the failing skill from a failing fixture: each fixture's `skill` field in the report names the Codex skill that produced the output. Open `skills/<skill>/SKILL.md` and look at the `## Prompt` section — that is the file you will edit.

## 3. Editing a `SKILL.md` without recompilation

Open `skills/linkedin-<name>/SKILL.md` in any text editor. Find the `## Prompt` section near the bottom. Edit the prompt body. Save the file.

That's it. **No rebuild step is required**. The `CodexCliRunner` reads the prompt from disk on every invocation, so the next time the bench (or the application itself) calls that skill, it will see your new prompt.

This is the key infrastructure shipped by feature 006. Before this feature, editing a prompt required `npm run rebuild:native:electron && npm run build`, which took about 30 seconds per iteration and made fast experimentation impractical.

The byte-for-byte content of the prompt is whatever you save to the file. Be careful with whitespace at the end of the prompt body — trailing whitespace is preserved as-is by the loader.

## 4. Re-running the bench on a single fixture

During iteration you rarely want to re-run all 12 fixtures. Use the `--fixture` flag to target one:

```bash
npm run eval:editorial -- --fixture A1
```

Or `--fixture-type` to target all three fixtures of a given type:

```bash
npm run eval:editorial -- --fixture-type C
```

The fixture identifier follows the convention `<TypeLetter><Index>`:

- `A1`, `A2`, `A3` — manual leadership ideas (post-writer)
- `B1`, `B2`, `B3` — external news / article sources (news-to-post)
- `C1`, `C2`, `C3` — anonymized client cases (post-writer)
- `D1`, `D2`, `D3` — existing drafts to correct (post-editor)

The `--` is the npm-standard way to forward arguments to the underlying script.

## 5. Adding a new fixture

Open `scripts/eval-editorial-fixtures.mjs` and append a new entry to the `fixtures` array. Pick the next available identifier in the relevant type series (e.g., `A4` if the manual idea series already has `A1`, `A2`, `A3`). Each fixture record needs:

- `id` — unique identifier matching `^[A-D][1-9][0-9]?$`
- `type` — `"A"`, `"B"`, `"C"`, or `"D"` (matching the first letter of the id)
- `label` — short human description for the report
- `skill` — `"linkedin-post-writer"`, `"linkedin-news-to-post"`, or `"linkedin-post-editor"`
- `payload` — an object containing all the fields required by the targeted skill (see the existing fixtures of the same type as a template)

The `validateFixtures()` helper at the bottom of the file enforces the per-type required fields. If you forget one, the bench fails fast at startup with a clear error pointing at the missing field.

If your addition pushes the total above 12 fixtures, also update FR-010 of `specs/006-editorial-quality-evaluation/spec.md` and the `validateFixtures()` count check. The "exactly 12" constraint is intentional but not sacred — adjust deliberately, with a spec update.

## 6. Deciding when a prompt is production-ready

A green bench is necessary but not sufficient. The grader catches the obvious failures (banned phrases, body length, missing concrete elements), but it does NOT measure originality, factual accuracy, persona fit, or audience match. Those still need human judgment.

The **litmus test**: read the output as if it were posted on your LinkedIn feed by you, today. Does it sound like something you would actually publish under your own name? If you hesitate, it is not ready. If you would proudly share it, it is.

Concretely, before declaring a prompt production-ready:

1. Run the full bench with `npm run eval:editorial` and confirm the overall verdict is **pass**.
2. Read the body of every fixture's output in the markdown report.
3. For each output, ask the litmus test question.
4. If even one output fails the litmus test, the prompt is not ready — even if every grading rule passed.

Programmatic gates and human judgment work together. Neither is enough on its own.

## 7. Limits of automated grading

The grading grid intentionally measures only what can be measured deterministically:

- Banned opening / banned meta phrase regex matches
- Body length within range
- Headline not repeated in the first two sentences
- Presence of at least one concrete element (number or doctrine keyword)
- Quality score reported by the skill
- Skill not refusing the task

It does **not** measure:

- **Originality** — whether the angle is fresh or recycled.
- **Factual accuracy** — whether the claims are true. Codex can confidently state false numbers; the grader cannot tell.
- **Persona alignment** — whether the voice matches Philippe's specific style versus a generic "consultant IA" tone.
- **Audience match** — whether the post will land for SME decision-makers or just look smart to other consultants.
- **Editorial freshness** — whether the post would be redundant against last week's content.
- **Tone-deaf timing** — whether the angle is appropriate for the current news cycle.

These are all dimensions where the human reader is irreplaceable. The grader exists to catch mechanical failures cheaply so the human can focus attention on the dimensions that actually matter.

If you find yourself wishing the grader caught one of these qualitative dimensions, **don't try to encode it in the grader**. The right move is either to update the doctrine in `docs/editorial-doctrine.md` (if the rule can be stated as a deterministic check) or to rely on the litmus test from section 6 (if it can't).

## See also

- [`docs/editorial-doctrine.md`](editorial-doctrine.md) — the canonical list of banned openings, banned meta phrases, voice rules, and concrete-element heuristics. Edit this when the doctrine evolves.
- [`specs/006-editorial-quality-evaluation/contracts/grading-grid.md`](../specs/006-editorial-quality-evaluation/contracts/grading-grid.md) — the formal specification of every grading rule, useful when extending the grader.
- [`specs/006-editorial-quality-evaluation/contracts/skill-prompt-loader.md`](../specs/006-editorial-quality-evaluation/contracts/skill-prompt-loader.md) — the contract of the runtime prompt loader, useful when troubleshooting `SKILL_PROMPT_NOT_FOUND` errors.

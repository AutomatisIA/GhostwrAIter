# Quickstart — Verifying Feature 006 End-to-End

This document is the verification sequence to run after implementing every task in `tasks.md`. It is designed to give a clear pass/fail outcome for every user story and success criterion in `spec.md`.

## Prerequisites

- You are on branch `006-editorial-quality-evaluation` with all tasks from `tasks.md` completed.
- Local gates were green before this branch was opened: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --audit-level=high --omit=dev`.
- Codex CLI is installed locally and authenticated via `codex login`.
- You have at least 12 minutes of Codex CLI quota available (one full bench run consumes ~12 invocations).

## Step 1 — Validate the unit tests

```bash
npm test -- skill-prompt-loader editorial-doctrine-parser eval-editorial-grader codex-cli-runner
```

Expected:

- `tests/unit/skill-prompt-loader.test.ts` — 8 cases pass.
- `tests/unit/editorial-doctrine-parser.test.ts` — 10 cases pass.
- `tests/unit/eval-editorial-grader.test.ts` — 15 cases pass.
- `tests/unit/codex-cli-runner.test.ts` — every existing case still passes with no assertion text changes.

If any unit test fails, the implementation does not match the contracts under `specs/006-editorial-quality-evaluation/contracts/`. Fix before proceeding.

## Step 2 — Run the full regression suite

```bash
npm run rebuild:native:electron
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high --omit=dev
```

Expected: every command exits 0. The test count is at least `298 + 33` (the 33 new cases from the four test files in Step 1). If a previously passing test now fails, the migration broke something — fix before proceeding.

## Step 3 — Verify the eight SKILL.md files are valid

```bash
for skill in linkedin-strategy-foundation linkedin-topic-generator linkedin-structure-selector linkedin-hook-engine linkedin-post-writer linkedin-post-editor linkedin-repurpose linkedin-news-to-post; do
  test -f "skills/$skill/SKILL.md" && grep -q "^## Prompt$" "skills/$skill/SKILL.md" && echo "OK $skill" || echo "MISSING $skill"
done
```

Expected: 8 lines starting with `OK`. If any line says `MISSING`, the migration is incomplete.

## Step 4 — Verify the doctrine file is parsable

```bash
node -e "
const { loadEditorialDoctrineFromFile } = require('./app/main/domains/execution/editorial-doctrine-parser.ts');
const doctrine = loadEditorialDoctrineFromFile();
console.log('bannedOpenings:', doctrine.bannedOpenings.length);
console.log('bannedMetaPhrases:', doctrine.bannedMetaPhrases.length);
console.log('voiceRules:', doctrine.voiceRules.length);
console.log('operationalCost:', doctrine.concreteHeuristics.operationalCostKeywords.length);
console.log('businessConsequence:', doctrine.concreteHeuristics.businessConsequenceKeywords.length);
console.log('arbitrage:', doctrine.concreteHeuristics.arbitrageKeywords.length);
"
```

Note: if the runner is compiled to `dist-electron/`, run the JS-compiled equivalent instead. Either way, every count MUST be `>= 1`.

Expected output (numbers may differ as doctrine evolves):

```
bannedOpenings: 7
bannedMetaPhrases: 5
voiceRules: 7
operationalCost: 10
businessConsequence: 10
arbitrage: 8
```

## Step 5 — Run a single fixture through the bench

```bash
npm run eval:editorial -- --fixture A1
```

Expected:

- The bench launches Electron in headless mode.
- The Codex CLI is invoked once with the post-writer skill.
- A report pair appears under `dist-eval/eval-report-<timestamp>.md` and `.json`.
- The terminal prints a one-line summary `Fixture A1: pass` or `Fixture A1: fail`.
- Open the markdown report and verify it has the six required sections (Run metadata, Summary, Per-rule failure counts, Per-fixture results, Footer with playbook link).
- Verify the JSON file parses with `node -e "JSON.parse(require('fs').readFileSync('dist-eval/<filename>.json'))"` without error.
- Exit code: 0 if the fixture passed, 1 if it failed.

## Step 6 — Run the full benchmark (12 fixtures)

```bash
npm run eval:editorial
```

Expected:

- The bench exercises all 12 fixtures (A1, A2, A3, B1, B2, B3, C1, C2, C3, D1, D2, D3).
- Each fixture takes ~30-60 seconds depending on Codex latency.
- Total run time ~10-15 minutes.
- A report pair appears under `dist-eval/`.
- Exit code: 0 if every fixture passed every rule, 1 if any failed.

**Note**: This is the FIRST baseline run. Many fixtures may fail because the prompts have not yet been editorially optimised. That is expected — the failures are the input to the post-ship iteration loop, not a defect of the bench. The feature ships when the infrastructure is correct, not when the prompts are perfect.

## Step 7 — Verify the deliberate-failure path (SC-007)

Create a fixture that deliberately injects a banned opening into a stub output and run the grader unit test against it. This is already covered by `tests/unit/eval-editorial-grader.test.ts` Case 2 ("banned opening with no rescue → fails"). Verify that case is green:

```bash
npm test -- eval-editorial-grader -t "banned opening"
```

Expected: at least one test case matches and passes.

## Step 8 — Test the iteration loop end-to-end (SC-001, SC-002)

This step measures whether editing a `SKILL.md` and re-running the bench actually takes effect without recompilation.

1. Open `skills/linkedin-post-writer/SKILL.md` in a text editor.
2. Add a recognisable marker to the `## Prompt` section (e.g., a single line `EDITED FOR QUICKSTART STEP 8` somewhere safe).
3. Save the file.
4. Run `npm run eval:editorial -- --fixture A1`.
5. After the bench finishes, open the JSON report and search for `EDITED FOR QUICKSTART STEP 8` in the captured prompt or in the Codex output. Either appearance proves the file was loaded fresh.
6. Restore the original `SKILL.md` content (use `git checkout skills/linkedin-post-writer/SKILL.md`).
7. **Time the loop**: from saving the edited file to seeing the report, the elapsed time should be under 3 seconds + the Codex CLI invocation time. This satisfies SC-001.

## Step 9 — Verify the playbook discoverability (US3)

- Open `CONTRIBUTING.md` in a text editor and search for `editorial-iteration-playbook`. There MUST be at least one link.
- Open `docs/exploitation.md` and search for the same string. There MUST be at least one link.
- Open `docs/editorial-iteration-playbook.md` and verify it contains seven `## ` sections matching the seven topics from FR-020.

## Step 10 — Final regression gate (SC-006, FR-023)

```bash
npm run rebuild:native:electron
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high --omit=dev
node scripts/real-app-audit.mjs
node scripts/verify-hardening.mjs
```

Expected: all eight commands exit 0. Test count is `298 + N` where N is the count added by feature 006. Real-app audit completes its 14 steps. Verify-hardening completes its 6 checks.

## Step 11 — Commit hygiene check (SC-008, FR-026)

```bash
git log main..HEAD --pretty=format:"%h %an <%ae> | %s" | head -20
git log main..HEAD --grep="Claude" --oneline
```

Expected:

- Every commit on the feature branch is authored by `Philippe Cohen <contact@AutomatisIA.fr>`.
- Zero commits match `Claude`.
- Zero commits contain `Co-Authored-By` in their body (verifiable with `git log main..HEAD --pretty=full | grep -F Co-Authored-By`, expected to return nothing).

## Sign-off criteria

Feature 006 is considered complete when:

- [x] Steps 1 through 11 above all pass.
- [x] Every FR listed in `spec.md` is satisfied.
- [x] Every SC listed in `spec.md` is measured as satisfied.
- [x] No new files contain placeholder text.
- [x] Every commit on the branch is authored solely by Philippe Cohen with no AI-related trailer.
- [x] The bench is local-only and is NOT wired to any GitHub Actions workflow (verifiable by `grep -r eval:editorial .github/workflows/` returning no match).

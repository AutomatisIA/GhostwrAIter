# Quickstart — verifying the IPC validation layer

**Feature**: Systematic IPC schema validation
**Audience**: reviewer, future contributor
**Time budget**: 10 minutes

This quickstart lets a contributor verify, on a fresh checkout of the `003-ipc-validation` branch, that every IPC channel is validated, that malformed payloads are refused with a typed error, that the renderer API surface is unchanged, and that the hardening of feature 002 is intact.

## Prerequisites

- Node 20+ installed (matches Electron 41's runtime).
- `codex` CLI authenticated (optional but required for the end-to-end user journey step).

## Step 1 — Install and audit

```bash
npm install
npm audit
```

**Expected**: install completes, audit reports zero vulnerabilities at any severity level. (Matches the posture of feature 002.)

## Step 2 — Unit tests

```bash
npm test
```

**Expected**: every unit and component test passes. In particular, the seven `tests/unit/*-ipc.test.ts` files all pass, and the new `tests/unit/register-validated-handler.test.ts` passes its wrapper-contract suite.

If a test fails in a handler file, the failure isolates the channel: the test file name identifies the handler, and the case name identifies the channel and the outcome being tested.

## Step 3 — Typecheck and lint

```bash
npm run typecheck
npm run lint
```

**Expected**: both pass. If typecheck flags a mismatch between a schema and a handwritten TypeScript type, that handwritten type was not properly replaced with a schema-derived import and must be fixed.

## Step 4 — Feature 002 regression

```bash
node scripts/verify-hardening.mjs
```

**Expected**: all six hardening checks pass, unchanged from feature 002. The new wrapper must not weaken webPreferences, CSP, navigation guards, DevTools gating, or workspace validation.

## Step 5 — End-to-end regression

```bash
npm run build
node scripts/real-app-audit.mjs
```

**Expected**: every step of the canonical user journey passes. The envelope is invisible to the renderer because the preload unwraps it, so screens behave exactly as they did at the end of feature 002.

## Step 6 — Manual verification of a typed error surface

The purpose of this step is to prove that a malformed payload produces a typed error, not a crash.

Launch the built application:

```bash
npm run dev
```

Open the developer tools console and execute the following (paste as a single block):

```js
await window.linkedinPoster.ideas.createIdea({
  title: "",
  angle: "",
  pillarLabel: ""
})
```

**Expected**: the promise rejects with a thrown `Error`. The browser console shows an Error whose `name` is `"IPC_INPUT_INVALID"` and whose `message` describes which required field was empty. The main process is still alive; navigating to other screens continues to work.

Then try:

```js
await window.linkedinPoster.calendar.scheduleDraft({
  draftId: 42,
  plannedDate: "not a date",
  status: "invalid-status"
})
```

**Expected**: same pattern — a thrown Error with `name === "IPC_INPUT_INVALID"` and a message that describes one of the invalid fields.

Close the app.

## Step 7 — Verify the preload surface is unchanged

From the repository root, check that the renderer source tree has zero modifications beyond schema-derived type imports:

```bash
git diff 002-security-hardening -- app/renderer/src/
```

**Expected**: the output is either empty, or shows only import-line changes where a handwritten type (e.g., `StrategyBundleInput`) is now imported from `app/shared/schemas/<domain>.ts` instead of `app/shared/types/<domain>.ts`. No component file (`.tsx`) is modified.

## Step 8 — Add a new IPC channel in 5 minutes

This step is the pattern-discovery exercise that SC-007 promises: a contributor should be able to add a new channel in under five minutes by reading any existing handler file. To verify:

1. Open `app/main/ipc/calendar-ipc.ts`. Read the registration block.
2. Open `app/shared/schemas/calendar.ts`. Read the schema declaration and the `z.infer` type derivation.
3. Open `tests/unit/calendar-ipc.test.ts`. Read the four-case pattern.
4. Without reading any documentation, describe out loud (or in a notebook) the steps to add a new channel `calendar:unschedule-draft` that takes a single draft id and calls a new service method. The expected answer is: define a `draftIdSchema` (or reuse it), derive the type, add the runtime-service method, call `registerValidatedHandler(ipc, "calendar:unschedule-draft", draftIdSchema, handler)`, add a preload method that pipes through `unwrap`, add the four test cases.

If the steps are not obvious after reading those three files, the pattern is not discoverable and the feature has failed SC-007.

## What is NOT in the quickstart

- Load testing the validation layer under high IPC throughput. Not in scope.
- Cross-platform verification on Windows or Linux. Scope of chantier 3.
- i18n of error messages. Scope of a later chantier.
- Inspection of the `skills/linkedin-<name>/SKILL.md` files. Scope of chantier 4, unrelated to this feature.

## If a step fails

Stop and investigate. Do not weaken the validation layer or the hardening of feature 002 to make a step pass. The validation layer is either correct and the step must be fixed to match, or the validation is wrong and the spec or plan must be updated in a new commit. Silent loosening of error handling is the opposite of what this feature is trying to achieve.

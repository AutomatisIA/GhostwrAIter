# Pull Request

## Description

<!-- Summarize the change in one or two sentences. What does this PR do and why? -->

## Linked user story / FR

<!--
If this change relates to a spec-kit feature, reference the feature number and the user story or functional requirement (e.g., "feature 005, US1, FR-003"). For one-off fixes, link to the issue being fixed.
-->

## Checklist

- [ ] **Description** above clearly explains the change and its motivation.
- [ ] **User story / FR** is linked, or a GitHub issue number is referenced.
- [ ] **Tests added** — new tests cover the behavior this PR introduces or fixes. TDD was followed per Constitution IV (test observed failing before implementation).
- [ ] **Screenshots** — if this PR touches the UI, screenshots of before and after are attached. If not applicable, write "N/A".
- [ ] **Manual verification** — I have manually exercised the affected code paths at least once locally.
- [ ] **No regression on macOS** — I have run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and (for UI/security-sensitive changes) `node scripts/real-app-audit.mjs` and `npm run verify-hardening` on macOS.
- [ ] **Conventional commit messages** — every commit in this PR follows the Conventional Commits convention.
- [ ] **No secrets committed** — I have not added credentials, tokens, private keys, or other secrets to the repository.

## Additional notes

<!-- Anything else reviewers should know: deployment considerations, follow-up work, known limitations. -->

# LinkedIn Poster Development Guidelines

Auto-generated from active specifications. Last updated: 2026-04-10

## Active Technologies

- To be confirmed during `/speckit.plan`

## Project Structure

```text
docs/
.specify/
specs/
```

## Commands

- `specify check`
- `specify version`

## Code Style

Project standards will be finalized from approved implementation plans.

## Recent Changes

- 001-linkedin-editorial-cockpit: Added initial spec-kit project scaffolding and product specification draft

<!-- MANUAL ADDITIONS START -->
- Development rule: TDD is mandatory for all testable behavior. Write the test first, observe failure, implement the minimum passing code, then refactor.
- Product direction: local-first LinkedIn editorial cockpit for a solo AI consultant, with Codex-driven generation and human validation before publication.
- Source of truth for the MVP is the spec in `specs/001-linkedin-editorial-cockpit/spec.md` plus the detailed brief in `docs/cahier_des_charges_linkedin_codex_local_v1.docx`.
<!-- MANUAL ADDITIONS END -->

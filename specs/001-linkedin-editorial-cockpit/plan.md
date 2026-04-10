# Implementation Plan: LinkedIn Editorial Cockpit MVP

**Branch**: `001-linkedin-editorial-cockpit` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-linkedin-editorial-cockpit/spec.md`

## Summary

Construire un cockpit editorial local-first pour un consultant en IA PME, sous forme d'application desktop Electron + React. Le MVP doit couvrir quatre blocs de valeur: base strategique persistante, atelier de production guide par skills, bibliotheque locale reutilisable et calendrier editorial simple. Les executions cognitives sont deleguees a Codex via un runner local, tandis que l'application reste responsable du stockage, de l'orchestration, des logs et de la reprise.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20+, React 19)
**Primary Dependencies**: Electron, Vite, React, React Router, better-sqlite3, Drizzle ORM, Zod
**Storage**: SQLite local + fichiers workspace (`content/`, `skills/`, `logs/`, `config/`)
**Testing**: Vitest pour unit/integration, Playwright pour parcours desktop critiques
**Target Platform**: macOS en priorite MVP, extensible Windows/Linux
**Project Type**: application desktop locale mono-utilisateur
**Performance Goals**: demarrage local < 3 secondes hors run Codex ; navigation instantanee entre ecrans ; recherche locale < 10 secondes sur 100 contenus
**Constraints**: local-first, fonctionnement hors ligne pour les fonctions non generatives, aucune dependance a un backend SaaS du produit, contrats JSON canoniques pour les skills
**Scale/Scope**: 1 utilisateur actif, 100 a 1000 contenus, 8 skills editoriales MVP, 6 a 8 ecrans principaux

## Clarified Assumptions

- Plateforme prioritaire MVP: macOS desktop
- Un seul profil actif en V1
- Sauvegarde automatique par snapshots aux transitions de workflow
- Aucun auto-posting LinkedIn en V1
- Aucun moteur semantique ni synchronisation calendrier externe en V1
- JSON valide des skills = source de verite applicative
- Toute logique metier testable sera implemente en TDD strict

## Constitution Check

Le plan respecte la constitution du projet:

- **I. Local-First and Confidential by Default** ✅
  Stockage SQLite + fichiers locaux, aucun backend produit.
- **II. Workflow Before Prompting** ✅
  Le MVP est structure autour des etapes strategie, idees, atelier, bibliotheque, calendrier.
- **III. Specialized Skills with Structured I/O** ✅
  Les skills passent par un contrat runner explicite avec validation JSON.
- **IV. Test-First Development Is Mandatory** ✅
  Le plan prevoit des tests unitaires et d'integration ecrits avant les implementations metier.
- **V. Human Validation Over Autonomous Publishing** ✅
  L'utilisateur relit, corrige, valide et planifie; aucune publication automatique n'est engagee.
- **VI. Simplicity for MVP, Extensibility for the System** ✅
  Le plan limite la V1 au coeur de valeur et reporte les integrations avancees.

## Project Structure

### Documentation (this feature)

```text
specs/001-linkedin-editorial-cockpit/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── runner-skill-io.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── main/
│   ├── db/
│   ├── domains/
│   │   ├── strategy/
│   │   ├── ideas/
│   │   ├── content/
│   │   ├── library/
│   │   ├── calendar/
│   │   ├── export/
│   │   └── privacy/
│   ├── ipc/
│   ├── logging/
│   ├── runner/
│   └── workspace/
├── preload/
└── renderer/
    └── src/
        ├── app/
        ├── components/
        └── features/
            ├── strategy/
            ├── ideas/
            ├── workshop/
            ├── library/
            ├── calendar/
            └── settings/

app/shared/
└── schemas/

content/
├── strategy/
├── ideas/
├── drafts/
├── published/
├── research/
└── exports/

data/
├── linkedin-poster.db
└── migrations/

logs/
└── executions/

skills/
├── linkedin-strategy-foundation/
├── linkedin-topic-generator/
├── linkedin-hook-engine/
├── linkedin-structure-selector/
├── linkedin-post-writer/
├── linkedin-post-editor/
├── linkedin-repurpose/
└── linkedin-news-to-post/

tests/
├── unit/
├── integration/
└── e2e/
```

**Structure Decision**: Une application desktop unique avec decoupage interne par domaines et une separation nette entre processus principal, UI renderer et schemas partages. Cette structure maintient la simplicite MVP tout en isolant les responsabilites critiques: stockage, runner, UI et workspace editorial.

## Delivery slices

### Slice 1: Strategic foundation

- Persistence locale du socle editorial
- Ecran Strategie
- Export des fichiers de contexte

### Slice 2: Guided production workshop

- Generation d'idees
- Selection typologie / structure / hooks
- Redaction et correction
- Trace d'execution

### Slice 3: Reusable content library

- Recherche locale
- Tags et filtres
- Reouverture et variantes

### Slice 4: Editorial planning

- Calendrier simple
- Statuts et dates

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Architecture desktop Electron | Required for local filesystem, Codex runner, and offline workflow | A browser-only local app would complicate OS access and runner orchestration |
| SQLite + filesystem hybrid storage | Required to balance structured querying and portable editorial assets | Files-only storage would be too fragile for search, relations, and logs |

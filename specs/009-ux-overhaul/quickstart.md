# Quickstart: 009 UX Overhaul

## Prerequisites

- Node 20+
- npm 10+
- Electron 41+ (bundled)
- Au moins un CLI installé : Codex, Claude Code, ou Gemini CLI

## Setup

```bash
cd /Users/philippe/Dev/LinkedIn-poster
git checkout 009-ux-overhaul
npm install
npm run rebuild:native:node   # for tests
npm run rebuild:native:electron  # for dev
```

## Development

```bash
npm run dev          # Lance Electron en mode dev (Vite HMR)
npm run test         # Vitest unit + component tests
npm run typecheck    # TypeScript strict check
npm run lint         # ESLint
```

## Key Files to Edit (by phase)

### Phase A — Theme
- `app/main/db/init-database.ts` (add app_settings table)
- `app/main/domains/settings/settings.service.ts` (new)
- `app/main/ipc/settings-ipc.ts` (add channels)
- `app/preload/index.ts` (expose channels)
- `app/renderer/src/styles.css` (CSS custom properties)

### Phase B — Navigation
- `app/renderer/src/app/App.tsx` (routes, sections, headers)

### Phase C — Create Screen
- `app/renderer/src/features/create/CreateScreen.tsx` (new)
- `app/renderer/src/features/create/components/IdeaSelector.tsx` (new)

### Phase D — Cockpit
- `app/renderer/src/features/cockpit/CockpitScreen.tsx` (new)

### Phase E — Library + Planning
- `app/renderer/src/features/library/LibraryScreen.tsx` (modify)

### Phase F — Settings
- `app/renderer/src/features/settings/SettingsScreen.tsx` (major rewrite)

### Phase G — Multi-CLI
- `app/main/domains/execution/cli-engine.ts` (new interface)
- `app/main/domains/execution/codex-engine.ts` (refactor)
- `app/main/domains/execution/claude-engine.ts` (new)
- `app/main/domains/execution/gemini-engine.ts` (new)
- `app/main/domains/execution/engine-registry.ts` (new)

## Verification

```bash
npm run test         # All tests pass
npm run typecheck    # Zero errors
npm run lint         # Zero warnings
npm run dev          # Visual check: 5 nav items, theme switch, no empty pages
```

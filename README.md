# GhostwrAIter

Write professional LinkedIn posts locally, with the AI of your choice.

GhostwrAIter is a desktop application that guides editorial production end to end: strategy, ideation, structured writing, correction, reuse and scheduling. Your content stays on your machine. No cloud backend, no account to create, no data leaving your computer.

The application drives an external AI assistant (Codex, Claude Code or Antigravity) through your own subscription. You keep editorial control at every step.

> The application interface is in French, because the product is aimed at French-speaking users. This README, the documentation and the release notes are in English, because the repository is public.
>
> Code comments and commit messages are in English too. Most existing files still carry French comments, from an earlier convention: they are translated as the files are modified, rather than in one sweep. See [CONTRIBUTING.md](CONTRIBUTING.md#language).

---

## Installation

### Option A: installer (recommended)

Download the latest version from [GitHub Releases](https://github.com/AutomatisIA/GhostwrAIter/releases):

| Platform | File |
|----------|------|
| **macOS (Apple Silicon)** | `GhostwrAIter-x.x.x-arm64.dmg` |
| **Windows** | `GhostwrAIter-x.x.x-setup.exe` |
| **Linux** | `GhostwrAIter-x.x.x.AppImage` |

Open the `.dmg`, drag the application into your Applications folder, and launch it from the Dock or Spotlight.

macOS builds are Apple Silicon only. They are produced on GitHub's macOS runners, which are Apple Silicon, and no Intel target is requested. Intel Macs need [Option B](#option-b-from-source-developers).

### Option B: from source (developers)

Requirements: [Node.js 20+](https://nodejs.org/) and [Git](https://git-scm.com/).

```bash
git clone https://github.com/AutomatisIA/GhostwrAIter.git
cd GhostwrAIter
npm ci
npm run dev
```

---

## Setting up an AI engine

The application needs an AI assistant to generate content. Install the one that matches your subscription.

**Codex** (ChatGPT Plus or Team)

```bash
npm install -g @openai/codex
codex login
```

**Claude Code** (Claude Pro or Team)

```bash
npm install -g @anthropic-ai/claude-code
claude auth login
```

**Antigravity** (Google)

Antigravity ships the `agy` command as part of the Antigravity suite. There is no npm package and no separate login command: install the suite from [antigravity.google](https://antigravity.google), then rerun detection from Settings.

The application detects installed CLIs automatically. You can install several and switch between them in Settings, under Engine.

Whatever the engine, GhostwrAIter pins its own execution policy on every call: read only, no external tools, your machine's CLI configuration ignored, and an empty working directory. It asks the model for text and nothing else.

> **No subscription yet?** The application works with a free account on some services, but generation limits will be lower. A paid subscription is recommended for regular editorial use.

---

## What the application does

| Screen | Purpose |
|--------|---------|
| **Cockpit** | Overview of the editorial pipeline, recommended next action, metrics |
| **Strategy** | Positioning, offers, target audiences, editorial pillars, voice rules |
| **Create** | Capture an idea (manual, news item, generated) then turn it into a post through a four-step workflow |
| **Library** | Triage drafts by what is left to do, read the post itself, create variants, schedule publication |
| **Settings** | Light and dark theme, AI engine selection, diagnostics, backup and restore |

The production workflow follows four guided steps:

1. **Framing**: choose the post typology, its objective and its target audience
2. **Structure**: pick a narrative pattern
3. **Hook**: generate and choose the opening line
4. **Writing**: produce the full post, correct it, iterate

Editorial doctrine requires a single target audience per post. The audience you pick at framing follows the post through structure, hook, writing, variants and correction, so every stage writes for the same reader.

---

## Architecture

- **Electron** 41: cross-platform desktop shell
- **React** 19 and **Vite** 7: user interface
- **SQLite**: local storage, no server
- **Eight AI skills**: each workflow step is a specialised prompt with a structured input and output contract

Data is stored in the application's user data folder: `~/Library/Application Support/GhostwrAIter/workspace` on macOS, `~/.config/GhostwrAIter/workspace` on Linux, `%APPDATA%\GhostwrAIter\workspace` on Windows. To move that folder (onto an external drive, or out of a cloud-synced directory), set the `LINKEDIN_POSTER_WORKSPACE_ROOT` environment variable to an absolute path of your choice.

### Backups

Settings writes a backup wherever you choose: a `.zip` holding a consistent snapshot of the database and your workspace files. Restoring it from the same screen replaces the current workspace, after a confirmation naming what the archive contains, and after the current database has been copied aside.

Execution logs are excluded. They are raw CLI transcripts, reproducible, and Settings has a button to purge them, so shipping them into a file you may store or send would work against that.

---

## Developer commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run in development mode with hot reload |
| `npm run build` | Compile main, preload and renderer |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:watch` | Same suite, re-running on change |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint check |
| `npm run audit:contraste` | WCAG AA contrast audit of the palette, both themes |
| `npm run audit:geometrie` | Layout gates, measured on the running application |
| `npm run verify-hardening` | Electron hardening checks, including the served CSP |
| `npm run captures` | Screenshots of every screen in both themes |
| `npm run package:mac` | Build the macOS `.app` only, unsigned. The `dmg` target is skipped on purpose: this is the fast local loop, and installers come from CI |
| `npm run package:win` | Build the Windows installer (`.exe`) |
| `npm run package:linux` | Build for Linux (`.AppImage` and `.deb`) |

Released installers are always built and signed by CI, never locally. See `.github/workflows/auto-release.yml`.

---

## Documentation

Reference documents under `docs/` are currently written in French, alongside the application interface. New documentation is written in English.

| Document | Contents |
|----------|----------|
| [Guide de decouverte](docs/guide-decouverte.md) | Product overview |
| [Fonctionnalites](docs/fonctionnalites.md) | Per-screen reference |
| [Parcours utilisateur](docs/parcours-utilisateur.md) | First launch, step by step |
| [Architecture](docs/architecture.md) | Technical architecture |
| [Skills Codex](docs/skills-codex.md) | Contracts of the eight AI skills |
| [Exploitation](docs/exploitation.md) | Diagnostics, logs, audits |

---

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR. The project follows a strict TDD workflow and uses spec-kit for feature specification. [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) applies to every exchange around the project.

Code comments, release notes and this README are written in English. The application interface and its user-facing messages are in French.

To report a security issue, follow the process described in [`SECURITY.md`](SECURITY.md).

The version log lives on the [GitHub Releases](https://github.com/AutomatisIA/GhostwrAIter/releases) page.

---

## License

MIT. Copyright (c) 2026 Philippe Cohen ([AutomatisIA](https://automatisia.fr))

# LinkedIn Poster

A local-first Electron editorial cockpit for LinkedIn. LinkedIn Poster helps AI consultants and independent writers orchestrate the full production workflow of high-quality posts — from editorial strategy to hook engineering, drafting, and scheduling — through a library of specialized skills powered by OpenAI Codex. Every piece of content stays on your machine. No SaaS backend, no remote database, no vendor lock-in on your editorial IP.

## Stack

- **Electron** 41 for the desktop shell
- **TypeScript** 6 for the main, preload, and renderer processes
- **React** 19 + **Vite** 7 for the renderer UI
- **SQLite** (via `better-sqlite3`) for local workspace storage
- **Codex CLI** as the external AI execution engine (each skill is a structured prompt contract)

The application is built with electron-vite, tested with Vitest, and packaged with electron-builder for macOS, Windows, and Linux.

## Prerequisites

- **Node.js 20** (the exact version targeted by every CI runner and the Electron runtime)
- **Git** for cloning the repository
- **Codex CLI** installed and authenticated on your machine (the application expects `codex` to be available on PATH or in a standard platform location — see `docs/exploitation.md` for the full detection logic)
- A writable workspace directory where local data will live (typically `~/LinkedInPoster` on macOS and Linux, `%USERPROFILE%\LinkedInPoster` on Windows)

## Installation

### macOS

```bash
git clone https://github.com/AutomatisIA/LinkedIn-Poster.git
cd LinkedIn-Poster
npm ci
npm run rebuild:native:electron
npm run dev
```

For a packaged `.app` build, run `npm run package:mac`. See `docs/exploitation.md` for notarization and distribution details.

### Windows

```bash
git clone https://github.com/AutomatisIA/LinkedIn-Poster.git
cd LinkedIn-Poster
npm ci
npm run rebuild:native:electron
npm run dev
```

For a packaged NSIS installer or portable executable, run `npm run package:win`.

### Linux

```bash
git clone https://github.com/AutomatisIA/LinkedIn-Poster.git
cd LinkedIn-Poster
npm ci
npm run rebuild:native:electron
npm run dev
```

For a packaged AppImage or `.deb`, run `npm run package:linux`.

For detailed operational guidance — diagnostics, log locations, Codex configuration, audit scripts, and known limitations — see [`docs/exploitation.md`](docs/exploitation.md).

## Documentation

The full project documentation lives under `docs/`:

- `docs/guide-decouverte.md` — product overview for new users
- `docs/fonctionnalites.md` — page-by-page feature reference
- `docs/parcours-utilisateur.md` — hands-on walkthrough of a first session
- `docs/architecture.md` — technical architecture and data flow
- `docs/skills-codex.md` — Codex skill contracts and failure modes
- `docs/exploitation.md` — installation, diagnostics, real audits, known limits

## Contributing

Contributions are welcome. Before opening a pull request, please read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development workflow, commit convention, test-driven development expectations, and spec-kit authoring process.

By contributing you agree to abide by the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Security

To report a security vulnerability, please follow the private disclosure process described in [`SECURITY.md`](SECURITY.md). Do not open a public issue for suspected vulnerabilities.

## License

LinkedIn Poster is released under the [MIT License](LICENSE). Copyright (c) 2026 Philippe Cohen.

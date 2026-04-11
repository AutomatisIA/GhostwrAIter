# Phase 0 — Research

**Feature**: Cross-platform portability and responsive renderer baseline
**Branch**: `004-cross-platform-portability`
**Date**: 2026-04-11

Five decisions required before implementation. Each in **Decision / Rationale / Alternatives considered** format.

## D1 — electron-builder Windows target

**Decision**: Use `nsis` and `portable` as Windows targets.

```json
"win": {
  "target": ["nsis", "portable"],
  "icon": "resources/icons/icon.ico"
}
```

**Rationale**: NSIS produces a standard installer (`.exe`) that users recognize and that integrates with Windows uninstall workflows. Portable produces a single-file executable that requires no installation, useful for contributors who want to test the build without affecting their system. Together they cover the two main Windows consumption patterns. No code signing in this feature; signing is chantier 5 territory.

**Alternatives considered**:
- `msi` (Windows installer package) — adds a tooling dependency (WiX toolset) and is overkill for the initial Windows target. Rejected.
- `squirrel.windows` — used by Electron's own auto-update flow but adds more moving parts. Rejected as premature.

## D2 — electron-builder Linux target

**Decision**: Use `AppImage` and `deb` as Linux targets.

```json
"linux": {
  "target": ["AppImage", "deb"],
  "icon": "resources/icons/icon.png",
  "category": "Office"
}
```

**Rationale**: AppImage runs on most mainstream distributions without requiring package-manager integration and is the simplest "download and run" option. `.deb` covers the large Debian/Ubuntu family, which represents a substantial share of Linux developer machines. Together they cover the vast majority of Linux contributors. RPM support (`.rpm` for Fedora/RHEL) is deferred.

**Alternatives considered**:
- `rpm` — can be added as a third target but requires `rpmbuild` on the host. Rejected as unnecessary for the initial target set.
- `snap` — heavier build pipeline, requires snapcraft. Rejected.
- Flatpak — separate build system entirely. Rejected.

## D3 — Cross-OS Codex binary detection strategy

**Decision**: introduce a new pure helper `findCodexBinary(env, platform, fs)` in `app/main/domains/execution/find-codex-binary.ts` that takes three injectable dependencies for testability:

- `env`: a `NodeJS.ProcessEnv` (defaults to `process.env`)
- `platform`: a `NodeJS.Platform` (defaults to `process.platform`)
- `fs`: an object with a single `existsSync(path)` method (defaults to `node:fs.existsSync`)

The helper returns either an absolute path to a Codex binary (preferred if found in any lookup location) or `null` when no binary is found.

**Lookup order per platform**:

- **darwin**: PATH entries → `/opt/homebrew/bin` → `/usr/local/bin` → `$HOME/.local/bin`. Binary name: `codex`. This preserves the exact current behavior documented in `codex-cli-runner.ts` line 47.
- **linux**: PATH entries → `/usr/local/bin` → `/usr/bin` → `$HOME/.local/bin`. Binary name: `codex`.
- **win32**: PATH entries (split on `;`) → `%ProgramFiles%\Codex\bin` → `%LOCALAPPDATA%\Programs\codex`. Binary name: `codex.exe`.
- any other platform (`aix`, `freebsd`, `openbsd`, `sunos`, `android`, `haiku`, `netbsd`, `cygwin`): treated like linux (PATH + conventional Unix directories).

**Rationale**: the three-argument dependency injection makes the helper fully testable without touching the host filesystem. The lookup order is ordered by specificity: PATH first (contributor-controlled), then the conventional directories. The function separates **finding the binary path** (this helper) from **invoking the binary** (the existing `defaultExecutor` in `codex-cli-runner.ts`), which is a simpler split than trying to branch platform logic inside the existing executor.

The helper's **integration with the existing runner**: `codex-cli-runner.ts`'s `buildCodexCliPath()` function is replaced. The executor continues to pass `PATH=<enriched path>` to `spawnSync("codex", ...)` as it does today. The enrichment now comes from `findCodexBinary()` which returns the **containing directory** of the found binary (or the original PATH unchanged if no binary is found). `spawnSync` then resolves `codex` (or `codex.exe` on Windows — `spawnSync` handles the extension automatically when `shell: false`, which is our case) via the enriched PATH.

Actually, simpler: we can skip the "find first, then modify PATH" dance entirely. The helper returns the full binary path, and `codex-cli-runner.ts` passes that full path as the first argument to `spawnSync` instead of the bare name `codex`. This removes the PATH enrichment dance altogether and is even more explicit.

**Final decision**: `findCodexBinary()` returns the full absolute path to the binary (or `null`). `codex-cli-runner.ts`'s `defaultExecutor` passes that full path to `spawnSync` as argv[0]. If the helper returns `null`, the executor can still attempt `spawnSync("codex", ...)` with the current `PATH` as a last-ditch fallback, matching the "try the user's shell setup even if we don't recognize the location" spirit.

**Alternatives considered**:
- Keep the PATH enrichment pattern and just make it platform-branched. Rejected — more indirection, less explicit. Finding the binary once is clearer than twice (in the helper and again in `spawnSync`).
- Use `which-cmd` or `which` npm package. Rejected — adds a dependency, contradicts FR-021.
- Let `spawnSync("codex")` rely entirely on the shell PATH. Rejected because the current behavior explicitly extends PATH with Homebrew paths on macOS, which users have grown to rely on.

## D4 — Icon placeholders

**Decision**: commit three placeholder icon files under `resources/icons/`:

- `icon.icns` for macOS (existing feature 002 may already have one; if not, generate a minimal one from a PNG)
- `icon.ico` for Windows
- `icon.png` (512×512) for Linux

All three are derived from the same source PNG (a plain-colored square with "LP" text, generated in-session using `sips` or a tiny Node script). A `resources/icons/README.md` explicitly labels them as placeholders and points to chantier 5 / chantier 6 for real artwork.

**Rationale**: electron-builder requires the referenced icon files to exist at build time; a missing reference fails the build with a confusing error. Committing placeholders is the minimum to make the build command succeed on each platform, even if the visual result is ugly.

**Alternatives considered**:
- Generate the icons at build time with a predraw script. Rejected — adds build-time work and a generation script, when a committed placeholder is simpler.
- Omit the icon references and let electron-builder use its defaults. Rejected — the electron-builder default icons look like unfinished scaffolding and ship with the word "Electron" visible, which is worse than a plain placeholder.

## D5 — Responsive breakpoint implementation

**Decision**: add a single `@media (max-width: 768px)` block at the end of `app/renderer/src/styles.css`. The block:

1. Changes `.shell` from `grid-template-columns: 320px 1fr` to `grid-template-columns: 1fr` and adds `grid-template-rows: auto 1fr`, so the sidebar stacks above the content instead of beside it.
2. Reduces `.shell` gap and padding to fit the narrower viewport.
3. Makes `.brand` and `.nav-panel` compact (smaller padding, smaller font).
4. Keeps the existing desktop layout completely untouched by wrapping everything inside the `@media` rule.

Above 768px, nothing changes.

**Rationale**: the simplest possible responsive behavior that satisfies FR-013 (usable below 768px) and FR-016 (identical above 768px). The sidebar becomes a stacked top area instead of a side column; the user sees the navigation, then the content below. No JavaScript needed, no React component change, no touch-first redesign.

**Alternatives considered**:
- Drawer pattern (sidebar hidden, opens on hamburger click). Rejected because it requires a React state and a toggle button, which is out of scope ("responsive baseline", not "mobile redesign").
- Horizontal scroll sidebar (320px sidebar stays but becomes horizontally scrollable). Rejected because it leaves the content area squeezed on narrow windows.
- Full mobile-first rewrite of the layout grid. Rejected as massive scope creep.

## Open items deferred to implementation

None. All five decisions required for implementation are closed.

## Follow-up chantiers

- **Chantier 5 (CI/CD)** validates the Windows and Linux builds by actually running `npm run package:win` and `npm run package:linux` on GitHub Actions matrix jobs.
- **Chantier 6 (UX debt)** refines the responsive breakpoint into a proper mobile-friendly drawer navigation if the product direction moves toward mobile/web.
- **Designer pass** replaces the placeholder icons with real artwork before any public release announcement.

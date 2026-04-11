# Quickstart — cross-platform installation verification

**Feature**: Cross-platform portability and responsive renderer baseline
**Audience**: reviewer, future contributor on any of the three supported operating systems
**Time budget**: 15 minutes per operating system

This quickstart describes how to verify, on a fresh checkout of the `004-cross-platform-portability` branch, that the project installs, tests, and packages correctly on your operating system.

## Operational limitation notice

The feature was developed on a macOS machine. The Windows and Linux paths of this quickstart describe the **expected** behavior and have **not** been validated end-to-end in the development session that introduced portability. The continuous integration chantier (chantier 5) will add a GitHub Actions matrix job that runs the same steps on Windows and Linux hosts. Until then, a Windows or Linux contributor who hits an issue should open an issue rather than assume their setup is wrong.

## macOS (validated in-session)

### Prerequisites

- macOS 12 or later
- Node.js 20 or later
- Xcode command-line tools (for the native SQLite rebuild, usually installed automatically)
- Optional: Codex CLI at `/opt/homebrew/bin/codex` or `/usr/local/bin/codex` for Codex-driven generation

### Install, run, test, package

```bash
npm install
npm run dev           # opens the development window
npm test              # runs the unit + component test suite
npm run build         # builds the production bundle
npm run package:mac   # produces a packaged .app under dist-app/
```

**Expected**: every command succeeds. `dist-app/mac-arm64/LinkedIn Poster.app` exists at the end of `package:mac`.

### Verify the security posture

```bash
node scripts/real-app-audit.mjs        # 14 canonical steps
node scripts/verify-hardening.mjs      # 6 security checks
```

**Expected**: both scripts exit 0 with success summaries.

## Windows (unvalidated in-session — CI coverage pending)

### Prerequisites

- Windows 10 or later
- Node.js 20 or later (from https://nodejs.org or via nvm-windows)
- Visual Studio Build Tools with the "Desktop development with C++" workload (for the native SQLite rebuild, if no prebuilt binary is available)
- Python 3 (node-gyp dependency, usually bundled with Visual Studio Build Tools)
- Optional: Codex CLI on the PATH (anywhere), or installed under `%ProgramFiles%\Codex\bin\` or `%LOCALAPPDATA%\Programs\codex\`

### Install, run, test, package

```cmd
npm install
npm run dev
npm test
npm run build
npm run package:win
```

**Expected**: every command succeeds. Under `dist-app\`, a Windows installer (`.exe` NSIS) and a portable executable appear.

### Codex detection

Windows contributors typically install Codex into `%LOCALAPPDATA%\Programs\codex\codex.exe`. The application's cross-platform detection finds the binary via PATH if the installer added it, or via the conventional Windows directories as a fallback.

### What is NOT expected to work on Windows in this session

- The macOS-only launcher script `scripts/open-mac-latest.sh` prints an advisory and exits without error. No Windows equivalent exists yet; Windows users double-click the packaged `.exe` directly.
- `npm run package:mac` is expected to fail on Windows (electron-builder will report the missing macOS toolchain). This is by design.

## Linux (unvalidated in-session — CI coverage pending)

### Prerequisites

- A mainstream Linux distribution (Ubuntu 22.04 or later, Debian 12 or later, Fedora 38 or later, Arch)
- Node.js 20 or later (from your distribution's package manager or via nvm)
- `build-essential`, `libtool`, `python3` (for the native SQLite rebuild, if no prebuilt binary is available)
- Optional: Codex CLI on the PATH (anywhere), or installed under `/usr/local/bin/`, `/usr/bin/`, or `$HOME/.local/bin/`

### Install, run, test, package

```bash
npm install
npm run dev
npm test
npm run build
npm run package:linux
```

**Expected**: every command succeeds. Under `dist-app/`, an AppImage and a Debian package (`.deb`) appear.

### Codex detection

Linux contributors typically install Codex via a distribution package manager (binary lands in `/usr/bin/codex` or `/usr/local/bin/codex`) or via a per-user installer (binary lands in `$HOME/.local/bin/codex`). The application's cross-platform detection finds the binary in any of those locations.

### What is NOT expected to work on Linux in this session

- The macOS-only launcher script `scripts/open-mac-latest.sh` prints an advisory and exits without error.
- `npm run package:mac` is expected to fail on Linux (missing macOS toolchain). This is by design.

## Responsive layout verification (any operating system)

1. Start the application with `npm run dev`.
2. Open the developer tools and click the device-toolbar icon (or resize the window manually).
3. Resize the viewport below 768 pixels wide (try 600×900).

**Expected**: the sidebar collapses above the content instead of sitting beside it. Every navigation item remains reachable. No horizontal scroll is needed.

4. Resize the viewport back above 768 pixels.

**Expected**: the original sidebar-beside-content layout is restored exactly as before. No visual drift.

## What is NOT in this quickstart

- A signed Windows installer (code signing is a chantier 5 concern).
- An auto-update flow.
- A snap or Flatpak Linux package.
- A cross-compile step (each `package:*` command runs on its native host).
- Automated cross-browser / cross-device testing.

## If a step fails

Stop and investigate. Do not weaken the macOS invariants to make a Windows or Linux step pass. The macOS path is the one validated in-session; anything that regresses it is a real regression that must be fixed before continuing. If the Windows or Linux path fails, the fix belongs either to chantier 4 (code quality) or to chantier 5 (CI/CD infrastructure), depending on whether the failure is in the project code or in the build infrastructure.

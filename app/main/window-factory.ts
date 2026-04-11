import type { WebPreferences } from "electron";

export type NavigationGuardDeps = {
  openExternal: (url: string) => void | Promise<void>;
};

export type WebContentsLike = {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  setWindowOpenHandler: (
    handler: (details: { url: string }) => { action: "allow" | "deny" }
  ) => void;
  openDevTools?: (options?: unknown) => void;
  closeDevTools?: () => void;
};

/**
 * Returns the hardened webPreferences object to pass to BrowserWindow.
 * Every security-relevant flag is explicit, per contracts/webpreferences-baseline.md.
 */
export function buildHardenedWebPreferences(preloadPath: string): WebPreferences {
  return {
    preload: preloadPath,
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true
  };
}

/**
 * Detects whether the application is running in development mode.
 * True if ELECTRON_RENDERER_URL is set to a non-empty value
 * (electron-vite dev server is serving the renderer), false otherwise.
 */
export function isDevMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.ELECTRON_RENDERER_URL;
  return typeof value === "string" && value.length > 0;
}

function parseOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function isAllowedOrigin(targetUrl: string, allowedOrigins: readonly string[]): boolean {
  const origin = parseOrigin(targetUrl);
  if (origin === null) {
    return false;
  }
  for (const allowed of allowedOrigins) {
    if (origin === allowed || targetUrl.startsWith(allowed)) {
      return true;
    }
  }
  return false;
}

function isDelegatableExternal(targetUrl: string): boolean {
  const origin = parseOrigin(targetUrl);
  if (origin === null) {
    return false;
  }
  return origin.startsWith("http://") || origin.startsWith("https://");
}

/**
 * Attaches the will-navigate and setWindowOpenHandler guards to a BrowserWindow's
 * webContents. Any navigation or window-open targeting an origin outside the
 * allowlist is denied; http/https external URLs are delegated to the user's
 * default browser via shell.openExternal.
 */
export function attachNavigationGuards(
  webContents: WebContentsLike,
  allowedOrigins: readonly string[],
  deps: NavigationGuardDeps
): void {
  const frozenAllowlist = Object.freeze([...allowedOrigins]);

  webContents.on("will-navigate", (...args: unknown[]) => {
    const event = args[0] as { preventDefault: () => void };
    const targetUrl = typeof args[1] === "string" ? args[1] : "";

    if (isAllowedOrigin(targetUrl, frozenAllowlist)) {
      return;
    }

    event.preventDefault();

    if (isDelegatableExternal(targetUrl)) {
      void deps.openExternal(targetUrl);
    }
  });

  webContents.setWindowOpenHandler((details) => {
    if (isDelegatableExternal(details.url)) {
      void deps.openExternal(details.url);
    }
    return { action: "deny" };
  });
}

/**
 * Attaches the DevTools gating guard. In development mode, DevTools are opened
 * automatically. In production mode, DevTools are not opened, and any attempt
 * to open them via keyboard shortcut is closed immediately as defense in depth.
 */
export function attachDevToolsGuard(
  webContents: WebContentsLike,
  devMode: boolean
): void {
  if (devMode) {
    webContents.openDevTools?.({ mode: "detach" });
    return;
  }

  webContents.on("devtools-opened", () => {
    webContents.closeDevTools?.();
  });
}

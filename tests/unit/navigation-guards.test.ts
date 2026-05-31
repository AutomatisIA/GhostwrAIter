import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachNavigationGuards,
  type WebContentsLike
} from "../../app/main/window-factory";

type CapturedWebContents = WebContentsLike & {
  events: Map<string, Array<(...args: unknown[]) => void>>;
  windowOpenHandler: ((details: { url: string }) => { action: "allow" | "deny" }) | null;
};

function createCapturedWebContents(): CapturedWebContents {
  const events = new Map<string, Array<(...args: unknown[]) => void>>();
  const captured: CapturedWebContents = {
    events,
    windowOpenHandler: null,
    on(event, listener) {
      const list = events.get(event) ?? [];
      list.push(listener);
      events.set(event, list);
    },
    setWindowOpenHandler(handler) {
      captured.windowOpenHandler = handler;
    }
  };
  return captured;
}

function fireWillNavigate(
  webContents: CapturedWebContents,
  targetUrl: string
): { prevented: boolean } {
  const listeners = webContents.events.get("will-navigate") ?? [];
  let prevented = false;
  const event = {
    preventDefault: () => {
      prevented = true;
    }
  };
  for (const listener of listeners) {
    listener(event, targetUrl);
  }
  return { prevented };
}

describe("navigation guards", () => {
  let openExternalMock: ReturnType<typeof vi.fn>;
  let webContents: CapturedWebContents;
  const allowedOrigins = ["file://"] as const;

  beforeEach(() => {
    openExternalMock = vi.fn();
    webContents = createCapturedWebContents();
    attachNavigationGuards(webContents, allowedOrigins, {
      openExternal: openExternalMock as unknown as (url: string) => void
    });
  });

  describe("will-navigate", () => {
    it("allows navigation to an allowed origin", () => {
      const { prevented } = fireWillNavigate(
        webContents,
        "file:///Users/user/app/out/renderer/index.html"
      );
      expect(prevented).toBe(false);
      expect(openExternalMock).not.toHaveBeenCalled();
    });

    it("prevents navigation to an http external origin and delegates to the shell", () => {
      const { prevented } = fireWillNavigate(webContents, "https://evil.example/");
      expect(prevented).toBe(true);
      expect(openExternalMock).toHaveBeenCalledWith("https://evil.example/");
    });

    it("prevents navigation to an opaque origin without delegating", () => {
      const { prevented } = fireWillNavigate(webContents, "javascript:alert(1)");
      expect(prevented).toBe(true);
      expect(openExternalMock).not.toHaveBeenCalled();
    });

    it("prevents navigation to a malformed URL without crashing", () => {
      const { prevented } = fireWillNavigate(webContents, "not a url");
      expect(prevented).toBe(true);
      expect(openExternalMock).not.toHaveBeenCalled();
    });
  });

  describe("setWindowOpenHandler", () => {
    it("denies same-origin window.open because the current UI never opens extra windows", () => {
      const result = webContents.windowOpenHandler?.({
        url: "file:///Users/user/app/out/renderer/index.html"
      });
      expect(result).toEqual({ action: "deny" });
      expect(openExternalMock).not.toHaveBeenCalled();
    });

    it("denies external http window.open and delegates the URL to the shell", () => {
      const result = webContents.windowOpenHandler?.({
        url: "https://example.com/linkedin-profile"
      });
      expect(result).toEqual({ action: "deny" });
      expect(openExternalMock).toHaveBeenCalledWith("https://example.com/linkedin-profile");
    });

    it("denies opaque window.open without delegating", () => {
      const result = webContents.windowOpenHandler?.({
        url: "about:blank"
      });
      expect(result).toEqual({ action: "deny" });
      expect(openExternalMock).not.toHaveBeenCalled();
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachDevToolsGuard,
  isDevMode,
  type WebContentsLike
} from "../../app/main/window-factory";

type CapturedDevToolsWebContents = WebContentsLike & {
  events: Map<string, Array<(...args: unknown[]) => void>>;
  openDevToolsMock: ReturnType<typeof vi.fn>;
  closeDevToolsMock: ReturnType<typeof vi.fn>;
};

function createDevToolsWebContents(): CapturedDevToolsWebContents {
  const events = new Map<string, Array<(...args: unknown[]) => void>>();
  const openMock = vi.fn();
  const closeMock = vi.fn();
  return {
    events,
    openDevToolsMock: openMock,
    closeDevToolsMock: closeMock,
    on(event, listener) {
      const list = events.get(event) ?? [];
      list.push(listener);
      events.set(event, list);
    },
    setWindowOpenHandler() {
      // not used in this test
    },
    openDevTools: openMock,
    closeDevTools: closeMock
  };
}

function fireDevToolsOpened(webContents: CapturedDevToolsWebContents) {
  const listeners = webContents.events.get("devtools-opened") ?? [];
  for (const listener of listeners) {
    listener();
  }
}

describe("isDevMode", () => {
  it("returns true when ELECTRON_RENDERER_URL is set in the env", () => {
    expect(isDevMode({ ELECTRON_RENDERER_URL: "http://localhost:5173" })).toBe(true);
  });

  it("returns false when ELECTRON_RENDERER_URL is absent", () => {
    expect(isDevMode({})).toBe(false);
  });

  it("returns false when ELECTRON_RENDERER_URL is an empty string", () => {
    expect(isDevMode({ ELECTRON_RENDERER_URL: "" })).toBe(false);
  });
});

describe("attachDevToolsGuard", () => {
  let webContents: CapturedDevToolsWebContents;

  beforeEach(() => {
    webContents = createDevToolsWebContents();
  });

  describe("development mode", () => {
    beforeEach(() => {
      attachDevToolsGuard(webContents, true);
    });

    it("opens DevTools immediately", () => {
      expect(webContents.openDevToolsMock).toHaveBeenCalledTimes(1);
    });

    it("does not attach a devtools-opened listener", () => {
      expect(webContents.events.get("devtools-opened") ?? []).toHaveLength(0);
    });

    it("does not close DevTools when they open", () => {
      fireDevToolsOpened(webContents);
      expect(webContents.closeDevToolsMock).not.toHaveBeenCalled();
    });
  });

  describe("production mode", () => {
    beforeEach(() => {
      attachDevToolsGuard(webContents, false);
    });

    it("does not open DevTools", () => {
      expect(webContents.openDevToolsMock).not.toHaveBeenCalled();
    });

    it("attaches a devtools-opened listener that closes DevTools", () => {
      expect(webContents.events.get("devtools-opened") ?? []).toHaveLength(1);
      fireDevToolsOpened(webContents);
      expect(webContents.closeDevToolsMock).toHaveBeenCalledTimes(1);
    });
  });
});

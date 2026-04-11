import { describe, expect, it, vi } from "vitest";
import {
  findCodexBinary,
  type FindCodexBinaryDeps
} from "../../app/main/domains/execution/find-codex-binary";

function makeDeps(overrides: Partial<FindCodexBinaryDeps> = {}): FindCodexBinaryDeps {
  return {
    env: {},
    platform: "linux",
    existsSync: () => false,
    homedir: () => "/home/contributor",
    ...overrides
  };
}

describe.skipIf(process.platform === "win32")("findCodexBinary — darwin", () => {
  it("returns the binary found in a PATH entry (preferred over fallbacks)", () => {
    const existsSync = vi.fn((path: string) => path === "/custom/bin/codex");
    const result = findCodexBinary(
      makeDeps({
        platform: "darwin",
        env: { PATH: "/custom/bin:/opt/homebrew/bin" },
        existsSync,
        homedir: () => "/Users/philippe"
      })
    );
    expect(result).toBe("/custom/bin/codex");
  });

  it("falls back to /opt/homebrew/bin when PATH has no codex", () => {
    const existsSync = vi.fn((path: string) => path === "/opt/homebrew/bin/codex");
    const result = findCodexBinary(
      makeDeps({
        platform: "darwin",
        env: { PATH: "/usr/bin" },
        existsSync,
        homedir: () => "/Users/philippe"
      })
    );
    expect(result).toBe("/opt/homebrew/bin/codex");
  });

  it("falls back to /usr/local/bin when no Homebrew binary exists", () => {
    const existsSync = vi.fn((path: string) => path === "/usr/local/bin/codex");
    const result = findCodexBinary(
      makeDeps({
        platform: "darwin",
        env: {},
        existsSync,
        homedir: () => "/Users/philippe"
      })
    );
    expect(result).toBe("/usr/local/bin/codex");
  });

  it("falls back to the user local bin as the last resort on darwin", () => {
    const existsSync = vi.fn(
      (path: string) => path === "/Users/philippe/.local/bin/codex"
    );
    const result = findCodexBinary(
      makeDeps({
        platform: "darwin",
        env: {},
        existsSync,
        homedir: () => "/Users/philippe"
      })
    );
    expect(result).toBe("/Users/philippe/.local/bin/codex");
  });
});

describe.skipIf(process.platform === "win32")("findCodexBinary — linux", () => {
  it("returns the binary found in a PATH entry", () => {
    const existsSync = vi.fn((path: string) => path === "/usr/local/bin/codex");
    const result = findCodexBinary(
      makeDeps({
        platform: "linux",
        env: { PATH: "/usr/local/bin:/usr/bin" },
        existsSync
      })
    );
    expect(result).toBe("/usr/local/bin/codex");
  });

  it("falls back to $HOME/.local/bin when nothing else matches", () => {
    const existsSync = vi.fn(
      (path: string) => path === "/home/contributor/.local/bin/codex"
    );
    const result = findCodexBinary(
      makeDeps({
        platform: "linux",
        env: {},
        existsSync,
        homedir: () => "/home/contributor"
      })
    );
    expect(result).toBe("/home/contributor/.local/bin/codex");
  });

  it("handles undefined PATH without throwing", () => {
    const existsSync = vi.fn(() => false);
    expect(() =>
      findCodexBinary(
        makeDeps({ platform: "linux", env: {}, existsSync })
      )
    ).not.toThrow();
  });
});

describe("findCodexBinary — win32", () => {
  it("returns the binary found in a PATH entry with the .exe extension", () => {
    const existsSync = vi.fn(
      (path: string) => path === "C:\\Users\\dev\\bin\\codex.exe"
    );
    const result = findCodexBinary(
      makeDeps({
        platform: "win32",
        env: { PATH: "C:\\Users\\dev\\bin;C:\\Windows" },
        existsSync,
        homedir: () => "C:\\Users\\dev"
      })
    );
    expect(result).toBe("C:\\Users\\dev\\bin\\codex.exe");
  });

  it("also accepts a bare codex (without .exe) found on PATH", () => {
    const existsSync = vi.fn((path: string) => path === "C:\\Users\\dev\\bin\\codex");
    const result = findCodexBinary(
      makeDeps({
        platform: "win32",
        env: { PATH: "C:\\Users\\dev\\bin" },
        existsSync,
        homedir: () => "C:\\Users\\dev"
      })
    );
    expect(result).toBe("C:\\Users\\dev\\bin\\codex");
  });

  it("falls back to %ProgramFiles%\\Codex\\bin\\codex.exe", () => {
    const existsSync = vi.fn(
      (path: string) => path === "C:\\Program Files\\Codex\\bin\\codex.exe"
    );
    const result = findCodexBinary(
      makeDeps({
        platform: "win32",
        env: {
          PATH: "",
          ProgramFiles: "C:\\Program Files"
        },
        existsSync,
        homedir: () => "C:\\Users\\dev"
      })
    );
    expect(result).toBe("C:\\Program Files\\Codex\\bin\\codex.exe");
  });

  it("falls back to %LOCALAPPDATA%\\Programs\\codex\\codex.exe", () => {
    const existsSync = vi.fn(
      (path: string) =>
        path === "C:\\Users\\dev\\AppData\\Local\\Programs\\codex\\codex.exe"
    );
    const result = findCodexBinary(
      makeDeps({
        platform: "win32",
        env: {
          LOCALAPPDATA: "C:\\Users\\dev\\AppData\\Local"
        },
        existsSync,
        homedir: () => "C:\\Users\\dev"
      })
    );
    expect(result).toBe(
      "C:\\Users\\dev\\AppData\\Local\\Programs\\codex\\codex.exe"
    );
  });
});

describe("findCodexBinary — fallback behavior", () => {
  it("returns null when no binary exists anywhere on darwin", () => {
    const result = findCodexBinary(
      makeDeps({
        platform: "darwin",
        env: { PATH: "/usr/bin:/bin" },
        existsSync: () => false,
        homedir: () => "/Users/nobody"
      })
    );
    expect(result).toBeNull();
  });

  it("returns null when no binary exists anywhere on linux", () => {
    const result = findCodexBinary(
      makeDeps({
        platform: "linux",
        env: { PATH: "/usr/bin" },
        existsSync: () => false
      })
    );
    expect(result).toBeNull();
  });

  it("returns null when no binary exists anywhere on win32", () => {
    const result = findCodexBinary(
      makeDeps({
        platform: "win32",
        env: { PATH: "", ProgramFiles: "C:\\Program Files" },
        existsSync: () => false,
        homedir: () => "C:\\Users\\dev"
      })
    );
    expect(result).toBeNull();
  });
});

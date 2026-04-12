import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const REPO_ROOT = join(__dirname, "..", "..");

export function readFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf-8");
}

export function fileExists(relativePath: string): boolean {
  return existsSync(join(REPO_ROOT, relativePath));
}

export function parseYaml(content: string): unknown {
  return parse(content);
}

export function parseFrontMatter(markdown: string): Record<string, unknown> | null {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return null;
  const parsed = parse(match[1]);
  return typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, unknown>)
    : null;
}

function labelsContain(frontMatter: Record<string, unknown>, needle: string): boolean {
  const labels = frontMatter.labels;
  if (typeof labels === "string") return labels.includes(needle);
  if (Array.isArray(labels)) return labels.some((l) => String(l).includes(needle));
  return false;
}

describe(".gitattributes", () => {
  it("exists at repo root", () => {
    expect(fileExists(".gitattributes")).toBe(true);
  });

  it("enforces LF as the default and CRLF for .bat files", () => {
    const content = readFile(".gitattributes");
    expect(content).toContain("* text=auto eol=lf");
    expect(content).toContain("*.bat text eol=crlf");
  });
});

describe("LICENSE", () => {
  it("exists at repo root", () => {
    expect(fileExists("LICENSE")).toBe(true);
  });

  it("carries the MIT copyright line for 2026 Philippe Cohen", () => {
    const content = readFile("LICENSE");
    expect(content).toContain("Copyright (c) 2026 Philippe Cohen <contact@AutomatisIA.fr>");
  });

  it("contains the standard MIT permission paragraph", () => {
    const content = readFile("LICENSE");
    expect(content).toContain(
      "Permission is hereby granted, free of charge, to any person obtaining a copy"
    );
  });

  it("contains the MIT warranty disclaimer", () => {
    const content = readFile("LICENSE");
    expect(content).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  });

  it("is within the standard MIT length range (800-1500 chars)", () => {
    const content = readFile("LICENSE");
    expect(content.length).toBeGreaterThanOrEqual(800);
    expect(content.length).toBeLessThanOrEqual(1500);
  });
});

describe("README.md", () => {
  const content = readFile("README.md");

  it("starts with the canonical project name heading", () => {
    expect(content.split("\n")[0]).toBe("# GhostwrAIter");
  });

  it("mentions the project's local nature and Electron", () => {
    expect(content.toLowerCase()).toMatch(/local/);
    expect(content).toMatch(/Electron/);
  });

  it("lists the core stack", () => {
    expect(content).toMatch(/Electron/);
    expect(content).toMatch(/React/);
    expect(content).toMatch(/SQLite/);
  });

  it("has a quick start section mentioning Node.js 20", () => {
    expect(content).toMatch(/Node(\.js)?\s*20/);
  });

  it("has installation instructions with npm ci and npm run dev", () => {
    expect(content).toMatch(/npm ci/);
    expect(content).toMatch(/npm run dev/);
  });

  it("documents packaging for macOS, Windows and Linux", () => {
    expect(content).toMatch(/package:mac/);
    expect(content).toMatch(/package:win/);
    expect(content).toMatch(/package:linux/);
  });

  it("links to docs/exploitation.md", () => {
    expect(content).toMatch(/docs\/exploitation\.md/);
  });

  it("has a License section and references MIT", () => {
    expect(content).toMatch(/##\s+Licence/);
    expect(content).toMatch(/MIT/);
  });

  it("links to CONTRIBUTING.md", () => {
    expect(content).toMatch(/CONTRIBUTING\.md/);
  });

  it("contains no placeholder tokens", () => {
    expect(content).not.toMatch(/TODO|TKTK|<placeholder>|LOREM IPSUM/i);
  });
});

describe("CONTRIBUTING.md", () => {
  const content = readFile("CONTRIBUTING.md");

  it("explains how to clone and install", () => {
    expect(content.toLowerCase()).toMatch(/clone/);
    expect(content).toMatch(/npm ci/);
  });

  it("explains how to run tests", () => {
    expect(content).toMatch(/npm test/);
  });

  it("mentions conventional commits", () => {
    expect(content.toLowerCase()).toMatch(/conventional commits/);
  });

  it("mentions TDD", () => {
    expect(content).toMatch(/test-driven|TDD/i);
  });
});

describe("CODE_OF_CONDUCT.md", () => {
  const content = readFile("CODE_OF_CONDUCT.md");

  it("identifies itself as the Contributor Covenant v2.1", () => {
    expect(content).toMatch(/Contributor Covenant/);
    expect(content).toMatch(/(version 2\.1|v2\.1|2\.1)/);
  });

  it("lists the contact email for enforcement", () => {
    expect(content).toContain("contact@AutomatisIA.fr");
  });
});

describe("SECURITY.md", () => {
  const content = readFile("SECURITY.md");

  it("has a Reporting a Vulnerability section", () => {
    expect(content).toMatch(/##\s+Reporting a Vulnerability/i);
  });

  it("names a private reporting channel", () => {
    expect(content).toContain("contact@AutomatisIA.fr");
  });

  it("references docs/exploitation.md for known limitations", () => {
    expect(content).toMatch(/docs\/exploitation\.md/);
  });

  it("documents an expected response-time window", () => {
    expect(content.toLowerCase()).toMatch(/72\s*hours|acknowledg/);
  });
});

describe(".github/ISSUE_TEMPLATE/bug_report.md", () => {
  const content = readFile(".github/ISSUE_TEMPLATE/bug_report.md");
  const fm = parseFrontMatter(content);

  it("has front matter identifying it as a Bug report", () => {
    expect(fm).not.toBeNull();
    expect(fm?.name).toBe("Bug report");
  });

  it("labels the issue as bug", () => {
    expect(fm).not.toBeNull();
    expect(labelsContain(fm as Record<string, unknown>, "bug")).toBe(true);
  });

  it("contains required sections", () => {
    expect(content.toLowerCase()).toMatch(/operating system/);
    expect(content.toLowerCase()).toMatch(/version/);
    expect(content.toLowerCase()).toMatch(/steps to reproduce/);
    expect(content.toLowerCase()).toMatch(/expected/);
    expect(content.toLowerCase()).toMatch(/actual/);
    expect(content.toLowerCase()).toMatch(/logs/);
  });
});

describe(".github/ISSUE_TEMPLATE/feature_request.md", () => {
  const content = readFile(".github/ISSUE_TEMPLATE/feature_request.md");
  const fm = parseFrontMatter(content);

  it("has front matter identifying it as a Feature request", () => {
    expect(fm).not.toBeNull();
    expect(fm?.name).toBe("Feature request");
  });

  it("labels the issue as enhancement", () => {
    expect(fm).not.toBeNull();
    expect(labelsContain(fm as Record<string, unknown>, "enhancement")).toBe(true);
  });

  it("contains required sections", () => {
    expect(content.toLowerCase()).toMatch(/use case/);
    expect(content.toLowerCase()).toMatch(/proposed solution/);
    expect(content.toLowerCase()).toMatch(/alternatives/);
    expect(content.toLowerCase()).toMatch(/additional context/);
  });
});

describe(".github/ISSUE_TEMPLATE/config.yml", () => {
  const content = readFile(".github/ISSUE_TEMPLATE/config.yml");
  const doc = parseYaml(content) as { blank_issues_enabled?: boolean };

  it("disables blank issues", () => {
    expect(doc.blank_issues_enabled).toBe(false);
  });
});

describe(".github/PULL_REQUEST_TEMPLATE.md", () => {
  const content = readFile(".github/PULL_REQUEST_TEMPLATE.md");

  it("contains a checklist covering required PR items", () => {
    const lowered = content.toLowerCase();
    expect(lowered).toMatch(/description/);
    expect(lowered).toMatch(/user story|fr-/);
    expect(lowered).toMatch(/tests added|test/);
    expect(lowered).toMatch(/screenshot/);
    expect(lowered).toMatch(/manual verification|manual check/);
    expect(lowered).toMatch(/no regression|regression/);
    expect(lowered).toMatch(/macos/);
  });
});

describe(".github/dependabot.yml", () => {
  const content = readFile(".github/dependabot.yml");
  const doc = parseYaml(content) as {
    version?: number;
    updates?: Array<{
      "package-ecosystem"?: string;
      directory?: string;
      schedule?: { interval?: string };
      labels?: string[];
      ignore?: Array<{ "dependency-name"?: string; "update-types"?: string[] }>;
      groups?: Record<string, { "dependency-type"?: string; "update-types"?: string[] }>;
    }>;
  };

  it("uses version 2", () => {
    expect(doc.version).toBe(2);
  });

  it("declares exactly two update entries", () => {
    expect(doc.updates).toBeDefined();
    expect(doc.updates).toHaveLength(2);
  });

  describe("npm ecosystem entry", () => {
    const entry = doc.updates?.find((u) => u["package-ecosystem"] === "npm");

    it("is present with root directory", () => {
      expect(entry).toBeDefined();
      expect(entry?.directory).toBe("/");
    });

    it("runs weekly", () => {
      expect(entry?.schedule?.interval).toBe("weekly");
    });

    it("labels PRs with 'dependencies'", () => {
      expect(entry?.labels).toContain("dependencies");
    });

    it("ignores all major updates via a wildcard", () => {
      const ignoreEntries = entry?.ignore ?? [];
      const hasWildcardMajorIgnore = ignoreEntries.some(
        (i) =>
          i["dependency-name"] === "*" &&
          (i["update-types"] ?? []).includes("version-update:semver-major")
      );
      expect(hasWildcardMajorIgnore).toBe(true);
    });

    it("groups updates into production-dependencies and development-dependencies", () => {
      const groups = entry?.groups ?? {};
      expect(Object.keys(groups).sort()).toEqual([
        "development-dependencies",
        "production-dependencies"
      ]);
      expect(groups["production-dependencies"]?.["dependency-type"]).toBe("production");
      expect(groups["development-dependencies"]?.["dependency-type"]).toBe("development");
      expect(groups["production-dependencies"]?.["update-types"]).toEqual(
        expect.arrayContaining(["minor", "patch"])
      );
      expect(groups["development-dependencies"]?.["update-types"]).toEqual(
        expect.arrayContaining(["minor", "patch"])
      );
    });
  });

  describe("github-actions ecosystem entry", () => {
    const entry = doc.updates?.find((u) => u["package-ecosystem"] === "github-actions");

    it("is present with root directory", () => {
      expect(entry).toBeDefined();
      expect(entry?.directory).toBe("/");
    });

    it("runs monthly", () => {
      expect(entry?.schedule?.interval).toBe("monthly");
    });

    it("labels PRs with 'dependencies'", () => {
      expect(entry?.labels).toContain("dependencies");
    });

    it("ignores all major updates via a wildcard", () => {
      const ignoreEntries = entry?.ignore ?? [];
      const hasWildcardMajorIgnore = ignoreEntries.some(
        (i) =>
          i["dependency-name"] === "*" &&
          (i["update-types"] ?? []).includes("version-update:semver-major")
      );
      expect(hasWildcardMajorIgnore).toBe(true);
    });
  });
});

describe("global metadata invariants", () => {
  const files = [
    "LICENSE",
    "README.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md",
    ".github/ISSUE_TEMPLATE/bug_report.md",
    ".github/ISSUE_TEMPLATE/feature_request.md",
    ".github/PULL_REQUEST_TEMPLATE.md"
  ];

  it.each(files)("has %s with at least 200 characters", (file) => {
    expect(fileExists(file)).toBe(true);
    expect(readFile(file).length).toBeGreaterThanOrEqual(200);
  });
});

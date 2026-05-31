import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const WORKFLOWS_DIR = join(__dirname, "..", "..", ".github", "workflows");

type WorkflowDocument = {
  name?: string;
  on?: unknown;
  permissions?: Record<string, string>;
  jobs?: Record<string, WorkflowJob>;
};

type WorkflowJob = {
  "runs-on"?: string;
  strategy?: { matrix?: { os?: string[] }; "fail-fast"?: boolean };
  steps?: WorkflowStep[];
  if?: string;
};

type WorkflowStep = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  if?: string;
};

export function loadWorkflow(name: string): WorkflowDocument {
  const path = join(WORKFLOWS_DIR, name);
  const raw = readFileSync(path, "utf-8");
  return parse(raw) as WorkflowDocument;
}

export function loadWorkflowRaw(name: string): string {
  const path = join(WORKFLOWS_DIR, name);
  return readFileSync(path, "utf-8");
}

function getOnlyJob(doc: WorkflowDocument): WorkflowJob {
  const jobs = doc.jobs ?? {};
  const keys = Object.keys(jobs);
  expect(keys).toHaveLength(1);
  return jobs[keys[0]!]!;
}

function findStep(steps: WorkflowStep[], predicate: (s: WorkflowStep) => boolean): WorkflowStep {
  const match = steps.find(predicate);
  expect(match, "expected matching step not found").toBeDefined();
  return match as WorkflowStep;
}

describe("ci.yml", () => {
  const doc = loadWorkflow("ci.yml");
  const raw = loadWorkflowRaw("ci.yml");

  it("declares a top-level name", () => {
    expect(typeof doc.name).toBe("string");
    expect((doc.name as string).length).toBeGreaterThan(0);
  });

  it("triggers only on push and pull_request targeting main", () => {
    const on = doc.on as Record<string, unknown>;
    expect(on).toBeDefined();
    expect(on.push).toBeDefined();
    expect(on.pull_request).toBeDefined();
    expect((on.push as { branches: string[] }).branches).toContain("main");
    expect((on.pull_request as { branches: string[] }).branches).toContain("main");
    expect(on.workflow_dispatch).toBeUndefined();
    expect(on.schedule).toBeUndefined();
    expect(on.tags).toBeUndefined();
  });

  it("declares permissions: contents: read at the top level", () => {
    expect(doc.permissions).toBeDefined();
    expect(doc.permissions?.contents).toBe("read");
  });

  it("has exactly one job with a 3-OS matrix and fail-fast false", () => {
    const job = getOnlyJob(doc);
    expect(job.strategy?.matrix?.os).toEqual(
      expect.arrayContaining(["macos-latest", "ubuntu-latest", "windows-latest"])
    );
    expect(job.strategy?.matrix?.os).toHaveLength(3);
    expect(job.strategy?.["fail-fast"]).toBe(false);
    expect(job["runs-on"]).toBe("${{ matrix.os }}");
  });

  it("runs the ordered command sequence: checkout, setup-node, npm ci, rebuild native, typecheck, lint, test, build, audit", () => {
    const steps = getOnlyJob(doc).steps ?? [];
    const runIndex = (needle: string) =>
      steps.findIndex((s) => typeof s.run === "string" && s.run.includes(needle));
    const usesIndex = (needle: string) =>
      steps.findIndex((s) => typeof s.uses === "string" && s.uses.startsWith(needle));

    const checkout = usesIndex("actions/checkout@");
    const setupNode = usesIndex("actions/setup-node@");
    const npmCi = runIndex("npm ci");
    const rebuild = runIndex("npm run rebuild:native:electron");
    const typecheck = runIndex("npm run typecheck");
    const lint = runIndex("npm run lint");
    const test = runIndex("npm test");
    const build = runIndex("npm run build");
    const audit = runIndex("npm audit --audit-level=high --omit=dev");

    expect(checkout).toBeGreaterThanOrEqual(0);
    expect(setupNode).toBeGreaterThan(checkout);
    expect(npmCi).toBeGreaterThan(setupNode);
    expect(rebuild).toBeGreaterThan(npmCi);
    expect(typecheck).toBeGreaterThan(rebuild);
    expect(lint).toBeGreaterThan(typecheck);
    expect(test).toBeGreaterThan(lint);
    expect(build).toBeGreaterThan(test);
    expect(audit).toBeGreaterThan(build);
  });

  it("configures setup-node with node 20 and npm cache", () => {
    const steps = getOnlyJob(doc).steps ?? [];
    const setupNode = findStep(steps, (s) => s.uses?.startsWith("actions/setup-node@") ?? false);
    expect(String(setupNode.with?.["node-version"])).toBe("20");
    expect(setupNode.with?.cache).toBe("npm");
  });

  it("runs verify-hardening only on macOS", () => {
    const steps = getOnlyJob(doc).steps ?? [];
    const hardening = findStep(
      steps,
      (s) => typeof s.run === "string" && s.run.includes("verify-hardening")
    );
    expect(hardening.if).toBeDefined();
    expect(hardening.if).toMatch(/runner\.os\s*==\s*'macOS'/);
  });

  it("never uses continue-on-error", () => {
    expect(raw).not.toMatch(/continue-on-error/);
  });

  it("never references any secret", () => {
    expect(raw).not.toMatch(/secrets\./);
  });
});

describe("package.yml", () => {
  const doc = loadWorkflow("package.yml");
  const raw = loadWorkflowRaw("package.yml");

  it("declares a top-level name", () => {
    expect(typeof doc.name).toBe("string");
    expect((doc.name as string).length).toBeGreaterThan(0);
  });

  it("triggers only on tag push matching v*", () => {
    const on = doc.on as Record<string, unknown>;
    expect(on).toBeDefined();
    expect(on.push).toBeDefined();
    const pushTags = (on.push as { tags?: string[] }).tags ?? [];
    expect(pushTags.some((t) => t.startsWith("v"))).toBe(true);
    expect(on.pull_request).toBeUndefined();
    expect(on.workflow_dispatch).toBeUndefined();
    expect(on.schedule).toBeUndefined();
  });

  it("declares permissions: contents: read", () => {
    expect(doc.permissions?.contents).toBe("read");
  });

  it("has one job with the 3-OS matrix and fail-fast false", () => {
    const job = getOnlyJob(doc);
    expect(job.strategy?.matrix?.os).toEqual(
      expect.arrayContaining(["macos-latest", "ubuntu-latest", "windows-latest"])
    );
    expect(job.strategy?.matrix?.os).toHaveLength(3);
    expect(job.strategy?.["fail-fast"]).toBe(false);
    expect(job["runs-on"]).toBe("${{ matrix.os }}");
  });

  it("runs the ordered base steps: checkout, setup-node, npm ci, rebuild native", () => {
    const steps = getOnlyJob(doc).steps ?? [];
    const runIndex = (needle: string) =>
      steps.findIndex((s) => typeof s.run === "string" && s.run.includes(needle));
    const usesIndex = (needle: string) =>
      steps.findIndex((s) => typeof s.uses === "string" && s.uses.startsWith(needle));

    const checkout = usesIndex("actions/checkout@");
    const setupNode = usesIndex("actions/setup-node@");
    const npmCi = runIndex("npm ci");
    const rebuild = runIndex("npm run rebuild:native:electron");

    expect(checkout).toBeGreaterThanOrEqual(0);
    expect(setupNode).toBeGreaterThan(checkout);
    expect(npmCi).toBeGreaterThan(setupNode);
    expect(rebuild).toBeGreaterThan(npmCi);
  });

  it("runs the per-OS packaging commands guarded by matrix.os", () => {
    const steps = getOnlyJob(doc).steps ?? [];
    const mac = steps.find(
      (s) => typeof s.run === "string" && s.run.includes("--mac")
    );
    const linux = steps.find(
      (s) => typeof s.run === "string" && s.run.includes("--linux")
    );
    const win = steps.find(
      (s) => typeof s.run === "string" && s.run.includes("--win")
    );

    expect(mac).toBeDefined();
    expect(linux).toBeDefined();
    expect(win).toBeDefined();
    expect(mac?.if).toMatch(/macos-latest|macOS/);
    expect(linux?.if).toMatch(/ubuntu-latest|Linux/);
    expect(win?.if).toMatch(/windows-latest|Windows/);
  });

  it("uploads artifacts with the tag+OS naming convention", () => {
    const steps = getOnlyJob(doc).steps ?? [];
    const upload = findStep(
      steps,
      (s) => s.uses?.startsWith("actions/upload-artifact@") ?? false
    );
    const name = String(upload.with?.name ?? "");
    expect(name).toContain("ghostwraiter");
    expect(name).toContain("${{ github.ref_name }}");
    expect(name).toContain("${{ matrix.os }}");
    expect(upload.with?.["if-no-files-found"]).toBe("error");
    expect(upload.with?.path).toBeDefined();
  });

  it("never uses continue-on-error", () => {
    expect(raw).not.toMatch(/continue-on-error/);
  });

  it("references only the expected mac code-signing secrets", () => {
    // Le build macOS est signe (Developer ID) + notarise : les secrets de
    // signature sont attendus. On verrouille l ensemble exact pour forcer une
    // revue si la liste change.
    const used = [...new Set([...raw.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]))].sort();
    expect(used).toEqual([
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_ID",
      "APPLE_TEAM_ID",
      "MAC_CSC_KEY_PASSWORD",
      "MAC_CSC_LINK"
    ]);
  });

  it("never interpolates a secret inside a run: command (anti-injection)", () => {
    // Les secrets ne doivent apparaitre que dans des blocs env:, jamais splices
    // dans une commande shell run:.
    for (const line of raw.split(/\r?\n/)) {
      if (/^\s*run:/.test(line)) {
        expect(line).not.toMatch(/secrets\./);
      }
    }
  });
});

describe("release.yml", () => {
  const doc = loadWorkflow("release.yml");
  const raw = loadWorkflowRaw("release.yml");

  it("declares a top-level name", () => {
    expect(typeof doc.name).toBe("string");
    expect((doc.name as string).length).toBeGreaterThan(0);
  });

  it("triggers via workflow_run on package.yml completion", () => {
    const on = doc.on as Record<string, unknown>;
    expect(on.workflow_run).toBeDefined();
    const wr = on.workflow_run as { workflows?: string[]; types?: string[] };
    expect(wr.workflows).toContain("Package");
    expect(wr.types).toContain("completed");
  });

  it("also supports manual workflow_dispatch with a tag input", () => {
    const on = doc.on as Record<string, unknown>;
    expect(on.workflow_dispatch).toBeDefined();
    const wd = on.workflow_dispatch as { inputs?: Record<string, unknown> };
    expect(wd.inputs).toBeDefined();
    expect(wd.inputs?.tag).toBeDefined();
  });

  it("does NOT trigger on tag push directly", () => {
    const on = doc.on as Record<string, unknown>;
    const push = on.push as { tags?: string[] } | undefined;
    expect(push?.tags).toBeUndefined();
  });

  it("declares permissions: contents: write", () => {
    expect(doc.permissions?.contents).toBe("write");
  });

  it("runs on ubuntu-latest", () => {
    const job = getOnlyJob(doc);
    expect(job["runs-on"]).toBe("ubuntu-latest");
  });

  it("gates the workflow_run path on a successful upstream run", () => {
    expect(raw).toMatch(/github\.event\.workflow_run\.conclusion\s*==\s*'success'/);
  });

  it("downloads artifacts and creates a draft release", () => {
    const steps = getOnlyJob(doc).steps ?? [];
    const download = steps.find(
      (s) => s.uses?.startsWith("actions/download-artifact@") ?? false
    );
    const release = steps.find(
      (s) => s.uses?.startsWith("softprops/action-gh-release@") ?? false
    );
    expect(download).toBeDefined();
    expect(release).toBeDefined();
    expect(release?.with?.draft).toBe(true);
  });

  it("only references the GITHUB_TOKEN secret (no other secrets)", () => {
    const secretRefs = raw.match(/secrets\.[A-Z_]+/g) ?? [];
    const unique = Array.from(new Set(secretRefs));
    expect(unique).toEqual(["secrets.GITHUB_TOKEN"]);
  });

  it("never uses continue-on-error", () => {
    expect(raw).not.toMatch(/continue-on-error/);
  });
});

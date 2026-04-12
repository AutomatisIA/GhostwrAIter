// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "../../app/renderer/src/app/App";

describe("CockpitScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  // jsdom doesn't implement matchMedia
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  });

  it("displays pipeline, next action, and metrics for an active workspace", async () => {
    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn().mockResolvedValue({
          profile: { id: "p1", name: "Philippe", positioning: "Consultant IA", bio: "", expertiseSummary: "" },
          offers: [{ id: "o1", name: "Audit", promise: "", problems: "" }],
          icps: [],
          pillars: [{ id: "p1", label: "Adoption IA", position: 0, isDefault: true }],
          voiceRules: [{ id: "r1", category: "Anti-style", ruleText: "Pas de hype", ruleType: "anti_style" }]
        }),
        saveBundle: vi.fn(),
        generateFoundation: vi.fn()
      },
      ideas: {
        listIdeas: vi.fn().mockResolvedValue([
          { id: "idea_1", title: "Sujet 1", angle: "Angle", pillarLabel: "Adoption IA", createdAt: new Date().toISOString() }
        ]),
        createIdea: vi.fn(),
        createFromNewsSource: vi.fn(),
        generateFromStrategy: vi.fn()
      },
      workshop: {
        getSessionByIdeaId: vi.fn(),
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSuggestedStructures: vi.fn(),
        generateHooks: vi.fn(),
        generateFinalDraft: vi.fn(),
        createVariant: vi.fn(),
        updateDraftText: vi.fn()
      },
      library: {
        listEntries: vi.fn().mockResolvedValue([
          { draftId: "d1", headline: "Post 1", bodyPreview: "", qualityScore: 0.8, createdAt: new Date().toISOString(), tags: [], status: "draft", pillarLabel: "Adoption IA", sourceDraftId: null }
        ]),
        searchEntries: vi.fn(),
        createVariantFromDraft: vi.fn(),
        updateEntryText: vi.fn(),
        createDivergentVariant: vi.fn()
      },
      calendar: {
        listItems: vi.fn().mockResolvedValue([]),
        scheduleDraft: vi.fn()
      },
      execution: {
        getDiagnostics: vi.fn().mockResolvedValue({
          activeEngine: "codex",
          engines: [],
          availableSkills: ["linkedin-post-writer"],
          message: "Codex disponible"
        }),
        listRuns: vi.fn().mockResolvedValue([]),
        openRunLog: vi.fn()
      },
      settings: {
        exportWorkspace: vi.fn(),
        countExecutionLogs: vi.fn().mockResolvedValue({ count: 0 }),
        purgeExecutionLogs: vi.fn(),
        getPreference: vi.fn().mockResolvedValue({ key: "theme", value: null }),
        setPreference: vi.fn(),
        getAllPreferences: vi.fn().mockResolvedValue({}),
        detectEngines: vi.fn().mockResolvedValue({ engines: [] }),
        getActiveEngine: vi.fn().mockResolvedValue({ engine: "codex", status: {} }),
        setActiveEngine: vi.fn()
      }
    };

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Cockpit" })).toBeTruthy();
    expect(await screen.findByText("idee dans le backlog")).toBeTruthy();
    expect(await screen.findByText("draft en bibliotheque")).toBeTruthy();
  });
});

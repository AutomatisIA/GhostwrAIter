// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/renderer/src/app/App";

describe("DashboardScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("guides a first-time user with live workspace stats and next steps", async () => {
    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn().mockResolvedValue({
          profile: {
            id: "profile_active",
            name: "Philippe",
            positioning: "Consultant IA PME",
            bio: "",
            expertiseSummary: ""
          },
          offers: [{ id: "offer_1", name: "Audit IA", promise: "", problems: "" }],
          icps: [],
          pillars: [{ id: "pillar_1", label: "Adoption IA", position: 0, isDefault: true }],
          voiceRules: [{ id: "rule_1", category: "Anti-style", ruleText: "Pas de hype", ruleType: "anti_style" }]
        })
      },
      ideas: {
        listIdeas: vi.fn().mockResolvedValue([
          {
            id: "idea_1",
            title: "Pourquoi les PME bloquent",
            angle: "Le cadrage avant l'outil",
            pillarLabel: "Adoption IA",
            createdAt: new Date().toISOString()
          }
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
        createVariant: vi.fn()
      },
      library: {
        listEntries: vi.fn().mockResolvedValue([
          {
            draftId: "draft_1",
            headline: "Post 1",
            bodyPreview: "Preview",
            qualityScore: 0.82,
            createdAt: new Date().toISOString(),
            tags: ["ia"],
            status: "draft",
            pillarLabel: "Adoption IA",
            sourceDraftId: null
          }
        ]),
        searchEntries: vi.fn(),
        createVariantFromDraft: vi.fn()
      },
      calendar: {
        listItems: vi.fn().mockResolvedValue([
          {
            id: "cal_1",
            draftId: "draft_1",
            draftHeadline: "Post 1",
            pillarLabel: "Adoption IA",
            plannedDate: "2026-04-18",
            status: "planned"
          }
        ]),
        scheduleDraft: vi.fn()
      },
      execution: {
        getDiagnostics: vi.fn().mockResolvedValue({
          runnerMode: "codex",
          codexAvailable: true,
          message: "Runner operationnel en mode codex.",
          availableSkills: ["linkedin-post-writer"]
        }),
        listRuns: vi.fn()
      },
      settings: {
        exportWorkspace: vi.fn(),
        purgeExecutionLogs: vi.fn()
      }
    };

    window.history.replaceState({}, "", "/");

    render(<App />);

    expect(await screen.findByText("Commencer sans se perdre")).toBeTruthy();
    expect(screen.getByText("1 idee")).toBeTruthy();
    expect(screen.getByText("1 draft")).toBeTruthy();
    expect(screen.getByText("1 contenu planifie")).toBeTruthy();
    expect(screen.getByText("Mode codex")).toBeTruthy();
    expect(screen.getByText("Strategie: OK")).toBeTruthy();
    expect(screen.getByText("Si c'est ta premiere ouverture")).toBeTruthy();
    expect(screen.getByText("Va d'abord dans Strategie.")).toBeTruthy();
    expect(
      screen.getByText("Remplis au moins le positionnement, une offre et deux piliers.")
    ).toBeTruthy();
  });
});

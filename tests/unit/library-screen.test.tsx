// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryScreen } from "../../app/renderer/src/features/library/LibraryScreen";

function mockEntry(overrides: Record<string, unknown> = {}) {
  return {
    draftId: "draft_1",
    headline: "Le premier draft",
    bodyPreview: "Preview 1",
    bodyMarkdown: "Full body 1",
    qualityScore: 0.75,
    createdAt: new Date().toISOString(),
    tags: ["ia"],
    status: "draft",
    pillarLabel: "Technical",
    sourceDraftId: null,
    ...overrides
  };
}

function mockLibrary(overrides: Record<string, unknown> = {}) {
  return {
    listEntries: vi.fn().mockResolvedValue([mockEntry()]),
    searchEntries: vi.fn().mockResolvedValue([]),
    createVariantFromDraft: vi.fn(),
    updateEntryText: vi.fn().mockResolvedValue(undefined),
    createDivergentVariant: vi.fn().mockResolvedValue(mockEntry({ draftId: "draft_variant" })),
    ...overrides
  };
}

describe("LibraryScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders persisted drafts from the local library and filters them", async () => {
    const user = userEvent.setup();
    const searchEntries = vi.fn().mockResolvedValue([
      mockEntry({ draftId: "draft_2", headline: "Le second draft", pillarLabel: "Strategy" })
    ]);

    window.linkedinPoster = {
      platform: "darwin",
      appName: "GhostwrAIter",
      strategy: { getActiveBundle: vi.fn(), saveBundle: vi.fn() },
      ideas: { listIdeas: vi.fn(), createIdea: vi.fn() },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      },
      library: mockLibrary({ searchEntries }),
      calendar: { listItems: vi.fn().mockResolvedValue([]), scheduleDraft: vi.fn() },
      execution: { listRuns: vi.fn().mockResolvedValue([]), getDiagnostics: vi.fn().mockResolvedValue({ activeEngine: "codex", engines: [], availableSkills: [], message: "" }), openRunLog: vi.fn() },
      settings: { exportWorkspace: vi.fn(), countExecutionLogs: vi.fn(), purgeExecutionLogs: vi.fn(), getPreference: vi.fn().mockResolvedValue({ key: "theme", value: null }), setPreference: vi.fn(), getAllPreferences: vi.fn(), detectEngines: vi.fn(), getActiveEngine: vi.fn(), setActiveEngine: vi.fn() }
    };

    render(
      <MemoryRouter>
        <LibraryScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText("Le premier draft")).toBeTruthy();

    await user.type(screen.getByLabelText("Recherche"), "second");

    expect(await screen.findByText("Le second draft")).toBeTruthy();
    expect(searchEntries).toHaveBeenCalledWith({ query: "second" });
  });

  it("shows a busy state while creating a divergent variant and supports local status filtering", async () => {
    const user = userEvent.setup();
    let resolveVariant: (() => void) | undefined;

    window.linkedinPoster = {
      platform: "darwin",
      appName: "GhostwrAIter",
      strategy: { getActiveBundle: vi.fn(), saveBundle: vi.fn() },
      ideas: { listIdeas: vi.fn(), createIdea: vi.fn() },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      },
      library: mockLibrary({
        listEntries: vi
          .fn()
          .mockResolvedValueOnce([
            mockEntry({
              draftId: "draft_1",
              headline: "Draft planifie",
              status: "scheduled",
              pillarLabel: "Adoption IA"
            }),
            mockEntry({
              draftId: "draft_2",
              headline: "Draft en cours",
              status: "draft",
              pillarLabel: "ROI"
            })
          ])
          .mockResolvedValueOnce([
            mockEntry({
              draftId: "draft_1",
              headline: "Draft planifie",
              status: "scheduled",
              pillarLabel: "Adoption IA"
            }),
            mockEntry({
              draftId: "draft_2",
              headline: "Draft en cours",
              status: "draft",
              pillarLabel: "ROI"
            }),
            mockEntry({
              draftId: "draft_3",
              headline: "Variante",
              status: "variant",
              pillarLabel: "ROI",
              sourceDraftId: "draft_2"
            })
          ]),
        createDivergentVariant: vi.fn().mockReturnValue(
          new Promise<void>((resolve) => {
            resolveVariant = resolve;
          })
        )
      }),
      calendar: { listItems: vi.fn().mockResolvedValue([]), scheduleDraft: vi.fn() },
      execution: { listRuns: vi.fn().mockResolvedValue([]), getDiagnostics: vi.fn().mockResolvedValue({ activeEngine: "codex", engines: [], availableSkills: [], message: "" }), openRunLog: vi.fn() },
      settings: { exportWorkspace: vi.fn(), countExecutionLogs: vi.fn(), purgeExecutionLogs: vi.fn(), getPreference: vi.fn().mockResolvedValue({ key: "theme", value: null }), setPreference: vi.fn(), getAllPreferences: vi.fn(), detectEngines: vi.fn(), getActiveEngine: vi.fn(), setActiveEngine: vi.fn() }
    };

    render(
      <MemoryRouter>
        <LibraryScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText("Draft planifie")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Statut"), "draft");
    expect(screen.getByText("Draft en cours")).toBeTruthy();
    expect(screen.queryByText("Draft planifie")).toBeNull();

    const variantButton = screen.getByRole("button", { name: "Variante" });
    await user.click(variantButton);
    expect(await screen.findByRole("button", { name: "Confirmer ?" })).toBeTruthy();

    resolveVariant?.();
  });
});

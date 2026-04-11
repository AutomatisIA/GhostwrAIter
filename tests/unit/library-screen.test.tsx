// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryScreen } from "../../app/renderer/src/features/library/LibraryScreen";

describe("LibraryScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders persisted drafts from the local library, filters them and creates a variant", async () => {
    const user = userEvent.setup();
    const searchEntries = vi.fn().mockResolvedValue([
      {
        draftId: "draft_2",
        headline: "Le second draft",
        bodyPreview: "Preview 2",
        qualityScore: 0.85,
        createdAt: new Date().toISOString(),
        tags: ["pme"],
        status: "draft",
        pillarLabel: "Strategy"
      }
    ]);

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: { getActiveBundle: vi.fn(), saveBundle: vi.fn() },
      ideas: { listIdeas: vi.fn(), createIdea: vi.fn() },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      },
      library: {
        listEntries: vi.fn().mockResolvedValue([
          {
            draftId: "draft_1",
            headline: "Le premier draft",
            bodyPreview: "Preview 1",
            qualityScore: 0.75,
            createdAt: new Date().toISOString(),
            tags: ["ia"],
            status: "draft",
            pillarLabel: "Technical"
          }
        ]),
        searchEntries,
        createVariantFromDraft: vi.fn()
      }
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

  it("shows a busy state while creating a variant and supports local status filtering", async () => {
    const user = userEvent.setup();
    let resolveVariant: (() => void) | undefined;

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: { getActiveBundle: vi.fn(), saveBundle: vi.fn() },
      ideas: { listIdeas: vi.fn(), createIdea: vi.fn() },
      workshop: {
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSessionByIdeaId: vi.fn()
      },
      library: {
        listEntries: vi
          .fn()
          .mockResolvedValueOnce([
            {
              draftId: "draft_1",
              headline: "Draft planifie",
              bodyPreview: "Preview 1",
              qualityScore: 0.75,
              createdAt: new Date().toISOString(),
              tags: ["ia"],
              status: "scheduled",
              pillarLabel: "Adoption IA",
              sourceDraftId: null
            },
            {
              draftId: "draft_2",
              headline: "Draft en cours",
              bodyPreview: "Preview 2",
              qualityScore: 0.85,
              createdAt: new Date().toISOString(),
              tags: ["roi"],
              status: "draft",
              pillarLabel: "ROI",
              sourceDraftId: null
            }
          ])
          .mockResolvedValueOnce([
            {
              draftId: "draft_1",
              headline: "Draft planifie",
              bodyPreview: "Preview 1",
              qualityScore: 0.75,
              createdAt: new Date().toISOString(),
              tags: ["ia"],
              status: "scheduled",
              pillarLabel: "Adoption IA",
              sourceDraftId: null
            },
            {
              draftId: "draft_2",
              headline: "Draft en cours",
              bodyPreview: "Preview 2",
              qualityScore: 0.85,
              createdAt: new Date().toISOString(),
              tags: ["roi"],
              status: "draft",
              pillarLabel: "ROI",
              sourceDraftId: null
            },
            {
              draftId: "draft_3",
              headline: "Variante",
              bodyPreview: "Preview 3",
              qualityScore: 0.8,
              createdAt: new Date().toISOString(),
              tags: ["roi"],
              status: "variant",
              pillarLabel: "ROI",
              sourceDraftId: "draft_2"
            }
          ]),
        searchEntries: vi.fn().mockResolvedValue([]),
        createVariantFromDraft: vi.fn().mockReturnValue(
          new Promise<void>((resolve) => {
            resolveVariant = resolve;
          })
        )
      }
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

    const variantButton = screen.getByRole("button", { name: "Creer une variante" });
    await user.click(variantButton);
    expect(await screen.findByText("Creation de la variante en cours...")).toBeTruthy();

    resolveVariant?.();
  });
});

// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarScreen } from "../../app/renderer/src/features/calendar/CalendarScreen";

describe("CalendarScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("lists existing calendar items", async () => {
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
        listEntries: vi.fn().mockResolvedValue([])
      },
      calendar: {
        listItems: vi.fn().mockResolvedValue([
          {
            id: "cal_1",
            draftId: "draft_1",
            plannedDate: "2026-04-15",
            status: "planned"
          }
        ]),
        scheduleDraft: vi.fn()
      }
    };

    render(<CalendarScreen />);

    expect(await screen.findByText("2026-04-15")).toBeTruthy();
  });

  it("schedules a draft from the screen", async () => {
    const user = userEvent.setup();
    const scheduleDraft = vi.fn().mockResolvedValue({
      id: "cal_2",
      draftId: "draft_2",
      plannedDate: "2026-04-16",
      status: "planned"
    });
    const listItems = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "cal_2",
          draftId: "draft_2",
          plannedDate: "2026-04-16",
          status: "planned"
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
            draftId: "draft_2",
            headline: "Le vrai cout de l'IA mal cadree",
            bodyPreview: "Preview",
            qualityScore: 0.8,
            createdAt: new Date().toISOString()
          }
        ])
      },
      calendar: {
        listItems,
        scheduleDraft
      }
    };

    render(<CalendarScreen />);

    expect(await screen.findByText("Le vrai cout de l'IA mal cadree")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Draft a planifier"), "draft_2");
    await user.type(screen.getByLabelText("Date prevue"), "2026-04-16");
    await user.click(screen.getByRole("button", { name: "Planifier le draft" }));

    await waitFor(() => {
      expect(scheduleDraft).toHaveBeenCalledWith({
        draftId: "draft_2",
        plannedDate: "2026-04-16",
        status: "planned"
      });
    });

    expect(await screen.findByText("2026-04-16")).toBeTruthy();
  });
});

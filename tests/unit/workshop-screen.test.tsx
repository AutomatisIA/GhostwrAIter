// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkshopScreen } from "../../app/renderer/src/features/workshop/WorkshopScreen";

function renderWorkshop() {
  return render(
    <MemoryRouter initialEntries={["/atelier?ideaId=idea_1"]}>
      <Routes>
        <Route path="/atelier" element={<WorkshopScreen />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("WorkshopScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("loads an existing session for the selected idea", async () => {
    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn(),
        saveBundle: vi.fn()
      },
      ideas: {
        listIdeas: vi.fn(),
        createIdea: vi.fn()
      },
      workshop: {
        getSessionByIdeaId: vi.fn().mockResolvedValue({
          idea: { id: "idea_1", title: "Le vrai frein a l'IA en PME", angle: "", pillarLabel: "Adoption IA" },
          draft: { id: "draft_1", headline: "Le vrai frein a l'IA en PME", bodyMarkdown: "Brouillon", qualityScore: 0.74 },
          hooks: [{ id: "hook_1", text: "Le vrai probleme avec l'IA en PME..." }],
          run: { id: "run_1", skillName: "linkedin-post-writer", status: "succeeded", summary: "Draft generated" },
          versions: [{ id: "version_1", bodyMarkdown: "Brouillon", qualityScore: 0.74, reason: "generation", createdAt: new Date().toISOString() }],
          contextUsed: {
            pillarLabel: "Adoption IA",
            strategyProfileName: "Philippe",
            strategyPositioning: "Consultant IA PME",
            voiceGuardrail: "Pas de hype, du terrain.",
            activeSkills: ["linkedin-post-writer", "linkedin-hook-engine"]
          }
        }),
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn()
      }
    };

    renderWorkshop();

    expect((await screen.findAllByText("Le vrai frein a l'IA en PME")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Draft generated")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Consultant IA PME")).toBeTruthy();
    expect(await screen.findByText("Pas de hype, du terrain.")).toBeTruthy();
  });

  it("generates then corrects a draft for the selected idea", async () => {
    const user = userEvent.setup();
    const generateFromIdea = vi.fn().mockResolvedValue({
      idea: { id: "idea_1", title: "Le vrai frein a l'IA en PME", angle: "", pillarLabel: "Adoption IA" },
      draft: { id: "draft_1", headline: "Le vrai frein a l'IA en PME", bodyMarkdown: "Version initiale", qualityScore: 0.61 },
      hooks: [{ id: "hook_1", text: "Le vrai probleme avec l'IA en PME..." }],
      run: { id: "run_1", skillName: "linkedin-post-writer", status: "succeeded", summary: "Draft generated" },
      versions: [{ id: "version_1", bodyMarkdown: "Version initiale", qualityScore: 0.61, reason: "generation", createdAt: new Date().toISOString() }],
      contextUsed: {
        pillarLabel: "Adoption IA",
        strategyProfileName: "Philippe",
        strategyPositioning: "Consultant IA PME",
        voiceGuardrail: "Pas de hype, du terrain.",
        activeSkills: ["linkedin-post-writer", "linkedin-hook-engine"]
      }
    });
    const correctDraft = vi.fn().mockResolvedValue({
      idea: { id: "idea_1", title: "Le vrai frein a l'IA en PME", angle: "", pillarLabel: "Adoption IA" },
      draft: { id: "draft_1", headline: "Le vrai frein a l'IA en PME", bodyMarkdown: "Version revue", qualityScore: 0.89 },
      hooks: [{ id: "hook_1", text: "Le vrai probleme avec l'IA en PME..." }],
      run: { id: "run_2", skillName: "linkedin-post-editor", status: "succeeded", summary: "Draft corrected" },
      versions: [
        { id: "version_1", bodyMarkdown: "Version initiale", qualityScore: 0.61, reason: "generation", createdAt: new Date().toISOString() },
        { id: "version_2", bodyMarkdown: "Version revue", qualityScore: 0.89, reason: "correction", createdAt: new Date().toISOString() }
      ],
      contextUsed: {
        pillarLabel: "Adoption IA",
        strategyProfileName: "Philippe",
        strategyPositioning: "Consultant IA PME",
        voiceGuardrail: "Pas de hype, du terrain.",
        activeSkills: ["linkedin-post-editor", "linkedin-post-writer"]
      }
    });

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: {
        getActiveBundle: vi.fn(),
        saveBundle: vi.fn()
      },
      ideas: {
        listIdeas: vi.fn(),
        createIdea: vi.fn()
      },
      workshop: {
        getSessionByIdeaId: vi.fn().mockResolvedValue(null),
        generateFromIdea,
        correctDraft
      }
    };

    renderWorkshop();

    await user.click(screen.getByRole("button", { name: "Generer le draft" }));

    await waitFor(() => {
      expect(generateFromIdea).toHaveBeenCalledWith("idea_1");
    });

    expect(await screen.findByText("Version initiale")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Lancer la correction" }));

    await waitFor(() => {
      expect(correctDraft).toHaveBeenCalledWith("draft_1");
    });

    expect(await screen.findByText("Version revue")).toBeTruthy();
    expect((await screen.findAllByText("Draft corrected")).length).toBeGreaterThan(0);
    expect(await screen.findByText("2 snapshot(s)")).toBeTruthy();
  });
});

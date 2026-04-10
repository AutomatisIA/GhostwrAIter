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

describe("WorkshopScreen Stepper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("walks through the 4 steps of the workshop", async () => {
    const user = userEvent.setup();

    const getSuggestedStructures = vi.fn().mockResolvedValue([
      { key: "belief-terrain-reality", label: "Croyance -> terrain -> realite", rationale: "Rationale structures" }
    ]);
    const generateHooks = vi.fn().mockResolvedValue([
      { id: "hook_option_0", family: "contrarian", text: "Le vrai probleme...", score: 0.91 }
    ]);
    const generateFinalDraft = vi.fn().mockResolvedValue({
      idea: { id: "idea_1", title: "IA en PME", angle: "", pillarLabel: "Adoption IA" },
      draft: { id: "draft_1", headline: "IA en PME", bodyMarkdown: "Post final", qualityScore: 0.88 },
      hooks: [{ id: "hook_1", text: "Le vrai probleme..." }],
      run: { id: "run_final", skillName: "linkedin-post-writer", status: "succeeded", summary: "Draft genere !" },
      versions: [{ id: "version_1", bodyMarkdown: "Post final", qualityScore: 0.88, reason: "generation", createdAt: new Date().toISOString() }],
      contextUsed: {
        pillarLabel: "Adoption IA",
        voiceGuardrail: "Pas de hype",
        activeSkills: ["writer"]
      }
    });

    window.linkedinPoster = {
      platform: "darwin",
      appName: "LinkedIn Poster",
      strategy: { getActiveBundle: vi.fn(), saveBundle: vi.fn() },
      ideas: { listIdeas: vi.fn(), createIdea: vi.fn() },
      workshop: {
        getSessionByIdeaId: vi.fn().mockResolvedValue(null),
        generateFromIdea: vi.fn(),
        correctDraft: vi.fn(),
        getSuggestedStructures,
        generateHooks,
        generateFinalDraft
      }
    };

    renderWorkshop();

    // Step 1: Typology
    expect(await screen.findByText("Choisis l'angle et l'objectif")).toBeTruthy();
    await user.click(screen.getByText("Expertise"));
    await user.click(screen.getByRole("button", { name: /Suivant : Structure/i }));

    // Step 2: Structure
    expect(await screen.findByText("Selectionne une structure narrative")).toBeTruthy();
    expect(await screen.findByText("Croyance -> terrain -> realite")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Suivant : Accroche/i }));

    // Step 3: Hook
    expect(await screen.findByText("Choisis ton accroche (Hook)")).toBeTruthy();
    expect(await screen.findByText("Le vrai probleme...")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Generer le draft final/i }));

    // Step 4: Final Draft
    expect(await screen.findByText("Post Final")).toBeTruthy();
    expect(await screen.findByText("Post final")).toBeTruthy();
    expect((await screen.findAllByText("IA en PME")).length).toBeGreaterThan(1);
  });
});

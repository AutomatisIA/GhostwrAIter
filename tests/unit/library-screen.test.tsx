// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryScreen } from "../../app/renderer/src/features/library/LibraryScreen";
import { ToastProvider } from "../../app/renderer/src/feedback/ToastProvider";

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
      <ToastProvider>
        <MemoryRouter>
          <LibraryScreen />
        </MemoryRouter>
      </ToastProvider>
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
      <ToastProvider>
        <MemoryRouter>
          <LibraryScreen />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Draft planifie")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Statut"), "draft");
    expect(screen.getByText("Draft en cours")).toBeTruthy();
    expect(screen.queryByText("Draft planifie")).toBeNull();

    // Le contrat teste reste « Variante -> Confirmer ? » ; seul le chemin
    // d'acces change : les actions secondaires vivent desormais derriere un
    // revelateur par ligne, la ligne n'exposant plus que « Modifier ».
    await user.click(screen.getByRole("button", { name: /Autres actions/ }));

    const variantButton = screen.getByRole("button", { name: "Variante" });
    await user.click(variantButton);
    expect(await screen.findByRole("button", { name: "Confirmer ?" })).toBeTruthy();

    resolveVariant?.();
  });

  /**
   * Garantie anti-clic accidentel sur une action destructive.
   *
   * Les quatre actions secondaires d'une ligne sont dans le DOM au repos, donc
   * dans l'ordre de tabulation, mais rendues transparentes et neutralisees par
   * `pointer-events: none` jusqu'au survol ou au focus de la ligne. C'est CETTE
   * neutralisation qui remplace l'ancienne preuve par absence du DOM, et elle se
   * mesure sur l'element rendu plutot que par une lecture de la feuille.
   *
   * La feuille est injectee a la main : vitest n'applique aucun CSS par defaut
   * (`document.styleSheets.length` vaut 0, mesure), et sans elle
   * `getComputedStyle` renverrait `auto`, soit l'inverse du vrai. Le fichier est
   * lu par `node:fs` et non par un import `?raw` : vitest stube les modules CSS,
   * `?raw` y renvoie une chaine vide (mesure).
   *
   * Ce que ce test NE couvre PAS : la revelation elle-meme. jsdom n'evalue pas
   * `:focus-within`, `pointer-events` y reste `none` apres un `focus()` sur un
   * bouton du groupe (mesure). L'etat revele n'est verifie par aucun test.
   */
  it("neutralise le clic sur les actions secondaires tant qu'elles sont transparentes", async () => {
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
      library: mockLibrary(),
      calendar: { listItems: vi.fn().mockResolvedValue([]), scheduleDraft: vi.fn() },
      execution: { listRuns: vi.fn().mockResolvedValue([]), getDiagnostics: vi.fn(), openRunLog: vi.fn() },
      settings: { getPreference: vi.fn().mockResolvedValue({ key: "theme", value: null }) }
    } as unknown as typeof window.linkedinPoster;

    const style = document.createElement("style");
    style.textContent = readFileSync(
      path.join(process.cwd(), "app/renderer/src/features/library/library.css"),
      "utf8"
    );
    document.head.appendChild(style);

    try {
      render(
        <ToastProvider>
          <MemoryRouter>
            <LibraryScreen />
          </MemoryRouter>
        </ToastProvider>
      );

      expect(await screen.findByText("Le premier draft")).toBeTruthy();

      // Garde-fou de la mesure : sans feuille appliquee, les assertions qui
      // suivent liraient les valeurs initiales du navigateur et conclueraient
      // pour une raison etrangere au sujet.
      expect(document.styleSheets.length).toBeGreaterThan(0);

      for (const label of ["Variante", "Planifier", "Retravailler", "Supprimer"]) {
        const action = screen.getByRole("button", { name: label });
        expect(getComputedStyle(action).pointerEvents).toBe("none");
      }

      // Le revelateur, lui, n'est jamais masque : un bouton focalisable rendu
      // transparent est exactement ce que la contrainte interdit.
      const disclosure = screen.getByRole("button", { name: /Autres actions/ });
      expect(getComputedStyle(disclosure).pointerEvents).not.toBe("none");
      expect(getComputedStyle(disclosure).opacity).toBe("1");
    } finally {
      style.remove();
    }
  });
});

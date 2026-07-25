// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CockpitScreen } from "./CockpitScreen";

/**
 * Les trois branches d etat du cockpit.
 *
 * L echec de lecture est la raison d etre de ce fichier. Tant qu il n etait pas
 * distingue, un espace de travail illisible retombait sur l etat initial du
 * composant : compteurs a zero, strategie « a definir ». L ecran affichait donc
 * l accueil du premier lancement, et cinq zeros, a un utilisateur qui avait
 * trente brouillons. Un ecran dont le bloc principal est un fait calcule ne
 * peut pas se permettre d en inventer un quand la mesure echoue.
 */

type MockedApi = Record<string, unknown>;

function installApi(overrides: MockedApi = {}) {
  (window as unknown as { linkedinPoster: MockedApi }).linkedinPoster = {
    strategy: {
      getActiveBundle: vi.fn().mockResolvedValue({ pillars: [], voiceRules: [] })
    },
    ideas: { listIdeas: vi.fn().mockResolvedValue([]) },
    library: { listEntries: vi.fn().mockResolvedValue([]) },
    calendar: { listItems: vi.fn().mockResolvedValue([]) },
    ...overrides
  };
}

function renderCockpit() {
  return render(
    <MemoryRouter>
      <CockpitScreen />
    </MemoryRouter>
  );
}

describe("CockpitScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("annonce l echec de lecture plutot que de le faire passer pour un espace vierge", async () => {
    installApi({
      library: { listEntries: vi.fn().mockRejectedValue(new Error("db down")) }
    });

    renderCockpit();

    expect(await screen.findByText("Lecture impossible")).toBeTruthy();
    // Ni l accueil du premier lancement, ni la reglette et ses zeros : aucun
    // des deux ne serait mesure.
    expect(screen.queryByText("Trois étapes pour démarrer")).toBeNull();
    expect(screen.queryByText("Publiés")).toBeNull();
  });

  it("rejoue le chargement quand on reessaie", async () => {
    const listEntries = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValue([]);
    installApi({ library: { listEntries } });

    renderCockpit();

    fireEvent.click(await screen.findByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("Trois étapes pour démarrer")).toBeTruthy();
    expect(listEntries).toHaveBeenCalledTimes(2);
  });

  it("garde l accueil et les deux etats vides sur un espace vierge", async () => {
    installApi();

    renderCockpit();

    expect(await screen.findByText("Bienvenue")).toBeTruthy();
    expect(await screen.findByText("Trois étapes pour démarrer")).toBeTruthy();
    expect(await screen.findByText("Aucun brouillon")).toBeTruthy();
    expect(await screen.findByText("Aucune idée")).toBeTruthy();
  });

  it("souligne en ambre l etape du pipeline que la prochaine action designe", async () => {
    installApi({
      strategy: {
        getActiveBundle: vi.fn().mockResolvedValue({
          pillars: [{ id: "p1", label: "Adoption IA" }],
          voiceRules: [{ id: "r1", ruleText: "Pas de hype" }]
        })
      },
      ideas: {
        listIdeas: vi.fn().mockResolvedValue([
          { id: "i1", title: "Sujet", angle: "", pillarLabel: "Adoption IA", createdAt: "2026-07-01T00:00:00.000Z" }
        ])
      },
      library: {
        listEntries: vi.fn().mockResolvedValue([
          {
            draftId: "d1",
            ideaId: "i1",
            headline: "Post",
            bodyPreview: "",
            bodyMarkdown: "x".repeat(1048),
            qualityScore: 0.8,
            createdAt: "2026-07-01T00:00:00.000Z",
            status: "draft",
            pillarLabel: "Adoption IA",
            tags: [],
            sourceDraftId: null
          }
        ])
      }
    });

    renderCockpit();

    // Rien n est planifie : la prochaine action est « Planifier vos
    // brouillons », donc c est l etape Planifies qui porte le lisere.
    const highlighted = await screen.findByText("Planifiés");
    expect(highlighted.closest("[data-attention]")).not.toBeNull();

    // Le compte de caracteres est mesure et rapporte a la limite LinkedIn.
    // `toLocaleString("fr-FR")` separe les milliers par une espace fine
    // insecable ; on la ramene a une espace ordinaire avant de comparer.
    const count = document.querySelector(".cockpit-row__count");
    expect(count?.textContent?.replace(/\s/gu, " ")).toBe("1 048 sur 3 000");
  });
});

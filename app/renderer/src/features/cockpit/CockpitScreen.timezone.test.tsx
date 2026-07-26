// @vitest-environment jsdom
/*
 * Le post prevu aujourd hui est-il signale a publier, la nuit, a Paris ?
 *
 * `plannedDate` est une date civile. Le cockpit la comparait a un jour calcule
 * en UTC : entre minuit et 02:00 l ete a Paris, l instant courant appartient
 * encore a la veille a Greenwich, et le post du jour n etait pas signale. Le
 * proprietaire de cette application vit a Paris ; le defaut se produisait chez
 * lui toutes les nuits, pendant deux heures.
 *
 * Le fuseau est pose explicitement, sinon le test mesurerait le reglage de la
 * machine qui l execute. La sentinelle du debut echoue bruyamment si le fuseau
 * n a pas ete applique.
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CockpitScreen } from "./CockpitScreen";

/** 00:30 le 26 juillet a Paris, soit 22:30 le 25 a Greenwich. */
const NUIT_PARISIENNE = new Date("2026-07-25T22:30:00Z");

function installApi() {
  (window as unknown as { linkedinPoster: Record<string, unknown> }).linkedinPoster = {
    strategy: {
      getActiveBundle: vi.fn().mockResolvedValue({
        pillars: [{ id: "p1", label: "Adoption IA" }],
        voiceRules: [{ id: "r1", ruleText: "Pas de hype" }]
      })
    },
    ideas: {
      listIdeas: vi.fn().mockResolvedValue([
        {
          id: "i1",
          title: "Sujet",
          angle: "",
          pillarLabel: "Adoption IA",
          createdAt: "2026-07-20T00:00:00.000Z"
        }
      ])
    },
    library: {
      listEntries: vi.fn().mockResolvedValue([
        {
          draftId: "d1",
          ideaId: "i1",
          headline: "Trois erreurs de pilotage",
          bodyPreview: "",
          bodyMarkdown: "x".repeat(500),
          qualityScore: 0.8,
          createdAt: "2026-07-20T00:00:00.000Z",
          status: "draft",
          pillarLabel: "Adoption IA",
          tags: [],
          sourceDraftId: null
        }
      ])
    },
    calendar: {
      listItems: vi.fn().mockResolvedValue([
        {
          id: "c1",
          draftId: "d1",
          draftHeadline: "Trois erreurs de pilotage",
          pillarLabel: "Adoption IA",
          // Aujourd hui a Paris, hier a Greenwich.
          plannedDate: "2026-07-26",
          status: "planned"
        }
      ])
    }
  };
}

beforeEach(() => {
  vi.stubEnv("TZ", "Europe/Paris");
  vi.setSystemTime(NUIT_PARISIENNE);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  cleanup();
});

describe("Cockpit, jour civil local", () => {
  it("signale le post prevu aujourd hui entre minuit et 02:00 a Paris", async () => {
    // Sentinelle : sans fuseau applique, tout ce qui suit ne mesurerait rien.
    expect(new Date().getDate()).toBe(26);
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-07-25");

    installApi();
    render(
      <MemoryRouter>
        <CockpitScreen />
      </MemoryRouter>
    );

    // Le bloc heros nomme le post du jour. Avec le jour calcule en UTC, le post
    // du 26 n etait pas encore du : le heros basculait sur « Capturer un
    // nouveau sujet », c est-a-dire l ecran de quelqu un qui n a rien a faire.
    expect(
      await screen.findByText("À publier : Trois erreurs de pilotage")
    ).toBeTruthy();
    expect(screen.queryByText("Capturer un nouveau sujet")).toBeNull();
  });
});

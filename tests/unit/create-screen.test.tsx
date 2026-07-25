// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdeaSelector } from "../../app/renderer/src/features/create/components/IdeaSelector";
import { ToastProvider } from "../../app/renderer/src/feedback/ToastProvider";

/*
 * Ecran « Creer », correctifs v2.
 *
 * `IdeaSelector` est rendu directement plutot que `CreateScreen` : l ecran de
 * selection est exactement ce composant, et le passer en direct evite d avoir a
 * monter un routeur pour observer une mise en page.
 */

const IDEAS = [
  {
    id: "idea_1",
    title: "Les agents IA ne sont pas prets a devenir un outil de l entreprise",
    angle: "Retour de terrain",
    pillarLabel: "Adoption et changement",
    createdAt: "2026-07-20T12:00:00.000Z"
  },
  {
    id: "idea_2",
    title: "   ",
    angle: "",
    pillarLabel: "Veille",
    createdAt: "2026-07-22T12:00:00.000Z"
  },
  {
    id: "idea_3",
    title: "",
    angle: "",
    pillarLabel: "",
    createdAt: "2026-07-23T12:00:00.000Z"
  }
];

const BUNDLE = {
  profile: { name: "Philippe", positioning: "Conseil IA", bio: "", expertiseSummary: "" },
  offers: [],
  icps: [],
  pillars: [
    { label: "Cas d'usage concrets metier", position: 0 },
    { label: "Adoption et changement", position: 1 }
  ],
  voiceRules: []
};

function mockPreload(ideas: unknown[] = IDEAS) {
  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
    platform: "darwin",
    appName: "GhostwrAIter",
    ideas: {
      listIdeas: vi.fn().mockResolvedValue(ideas),
      createIdea: vi.fn(),
      createFromNewsSource: vi.fn(),
      generateFromStrategy: vi.fn()
    },
    strategy: {
      getActiveBundle: vi.fn().mockResolvedValue(BUNDLE),
      saveBundle: vi.fn(),
      generateFoundation: vi.fn()
    }
  };
}

function renderSelector() {
  const onSelect = vi.fn();
  const view = render(
    <ToastProvider>
      <IdeaSelector onSelect={onSelect} />
    </ToastProvider>
  );
  return { ...view, onSelect };
}

describe("Ecran Creer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("n affiche aucune phrase d aide dans le flux et donne un bouton d aide a chaque champ", async () => {
    mockPreload();
    const { container } = renderSelector();

    await screen.findByRole("button", { name: "Aide : Titre du sujet" });
    expect(screen.getByRole("button", { name: "Aide : Angle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aide : Pilier" })).toBeTruthy();

    // Motif unique : plus aucune phrase d aide posee dans le flux sous un champ.
    expect(container.querySelectorAll(".create-hint")).toHaveLength(0);
    expect(screen.queryByText(/tel que vous le présenteriez à voix haute/)).toBeNull();
  });

  it("revele l aide du champ seulement quand elle est demandee", async () => {
    const user = userEvent.setup();
    mockPreload();
    renderSelector();

    const trigger = await screen.findByRole("button", { name: "Aide : Titre du sujet" });
    await user.hover(trigger);

    const bubble = await screen.findByRole("tooltip");
    expect(bubble.textContent).toContain("tel que vous le présenteriez à voix haute");

    await user.unhover(trigger);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("applique le meme motif d aide au mode Transformer une veille", async () => {
    const user = userEvent.setup();
    mockPreload();
    const { container } = renderSelector();

    await screen.findByRole("button", { name: "Aide : Titre du sujet" });
    await user.click(screen.getByRole("tab", { name: "Transformer une veille" }));

    expect(await screen.findByRole("button", { name: "Aide : Titre source" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aide : Résumé source" })).toBeTruthy();
    expect(container.querySelectorAll(".create-hint")).toHaveLength(0);
  });

  it("replie une idee sans titre sur une etiquette explicite et une provenance datee", async () => {
    mockPreload();
    const { container } = renderSelector();

    const untitled = await screen.findAllByText("Idée sans titre");
    expect(untitled).toHaveLength(2);

    // Le repli n usurpe pas la graisse d un vrai titre.
    for (const node of untitled) {
      expect(node.className).toContain("create-backlog__title--untitled");
    }

    // Provenance datee : d ou vient la ligne, quand elle est arrivee, et ce
    // qu il reste a faire. La date est formatee dans le fuseau local, donc
    // seule sa forme est verifiee.
    const provenances = Array.from(
      container.querySelectorAll(".create-backlog__pillar")
    ).map((node) => node.textContent ?? "");

    expect(provenances.some((text) => /^Veille du \d{1,2} \S+, à nommer$/.test(text))).toBe(
      true
    );
    expect(provenances.some((text) => /^Idée du \d{1,2} \S+, à nommer$/.test(text))).toBe(true);

    // Une idee titree garde son pilier seul, sans mention de provenance.
    expect(provenances).toContain("Adoption et changement");
  });

  it("laisse « Ajouter au backlog » actionnable des que les trois champs sont remplis", async () => {
    const user = userEvent.setup();
    mockPreload();
    renderSelector();

    const backlogButton = await screen.findByRole("button", { name: "Ajouter au backlog" });
    expect(backlogButton).toHaveProperty("disabled", true);

    await user.type(screen.getByLabelText("Titre du sujet"), "Deleguer trop tot");
    await user.type(screen.getByLabelText("Angle"), "Retour chiffre");
    await user.click(screen.getByRole("button", { name: "Adoption et changement" }));

    await waitFor(() => expect(backlogButton).toHaveProperty("disabled", false));
  });
});

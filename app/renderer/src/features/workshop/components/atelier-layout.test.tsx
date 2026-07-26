// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { WorkshopSession } from "@shared/types/workshop";
import { ToastProvider } from "../../../feedback/ToastProvider";
import { WorkshopContextBar } from "./WorkshopContextBar";
import { DraftPanel } from "./DraftPanel";
import { PostPreview } from "./PostPreview";
import { LINKEDIN_FOLD_CHARS } from "../../../../../shared/post-metrics";

/**
 * Recette de mise en page de l atelier.
 *
 * Ces assertions existent parce que trois correctifs de mise en page de ce
 * projet ont ete annonces comme faits alors qu ils ne l etaient pas : le
 * verdict avait ete rendu par lecture du CSS. Ce qui se mesure dans le DOM se
 * mesure ici. Ce qui ne se mesure qu au pixel, la hauteur reelle de la barre
 * d action ou son rendu dans les deux themes, ne se joue pas dans ce fichier.
 */

const LONG_HOOK =
  "Si vos équipes bloquent dès qu'un outil IA demande un réglage, commencez par une tâche connue";

afterEach(cleanup);

describe("WorkshopContextBar", () => {
  const baseProps = {
    step: 4,
    typology: "tutorial" as const,
    objective: "awareness" as const,
    selectedStructure: { key: "s1", label: "Contexte -> Tension -> Preuve", rationale: "" },
    selectedHook: { id: "h1", family: "question", text: LONG_HOOK, score: 0 },
    pillarLabel: "Pédagogie",
    onReopenCadrage: () => {}
  };

  it("ne pose plus l etat courant dans la bande", () => {
    const { container } = render(<WorkshopContextBar {...baseProps} status="Draft prêt." />);
    expect(container.textContent).not.toContain("Draft prêt.");
    expect(container.querySelector(".workshop-context__status")).toBeNull();
  });

  it("prefixe l accroche par son role et donne son texte entier en infobulle", () => {
    render(<WorkshopContextBar {...baseProps} />);
    const chip = screen.getByTitle(`Accroche : ${LONG_HOOK}`);
    expect(chip.textContent).toBe(`Accroche : ${LONG_HOOK}`);
    // La coupe est faite par le navigateur (max-width + text-overflow), jamais
    // par le composant : aucun point de suspension pose en JavaScript.
    expect(chip.textContent).not.toContain("…");
  });

  it("garde la seule sortie vers l arriere", () => {
    render(<WorkshopContextBar {...baseProps} />);
    expect(screen.getByRole("button", { name: "Revenir au cadrage" })).toBeTruthy();
  });
});

function makeSession(bodyMarkdown: string): WorkshopSession {
  return {
    idea: {
      id: "i1",
      title: "Claude Cowork en PME",
      angle: "Commencer par une tâche connue",
      pillarLabel: "Pédagogie",
      createdAt: "2026-07-25T09:00:00.000Z",
      targetIcpSegment: null
    },
    draft: {
      id: "d1",
      headline: "Claude Cowork en PME : commencez par une tâche connue",
      bodyMarkdown,
      qualityScore: 0
    },
    hooks: [],
    run: { id: "r1", skillName: "linkedin-draft", status: "succeeded", summary: "" },
    versions: [],
    contextUsed: {
      pillarLabel: "Pédagogie",
      voiceGuardrail: "Voix directe",
      activeSkills: ["linkedin-draft"]
    }
  };
}

describe("DraftPanel", () => {
  beforeEach(() => {
    // Le panneau lit la preference de familles de marqueurs au montage.
    (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
      settings: { getPreference: () => Promise.resolve({ value: null }) }
    };
  });

  // `ToastProvider` fait partie du montage REEL : `App` en enveloppe les cinq
  // ecrans, et le panneau y annonce desormais une copie refusee. Rendre le
  // composant sans lui testerait un montage qui n existe nulle part.
  function renderPanel(body: string) {
    return render(
      <ToastProvider>
        <DraftPanel
          session={makeSession(body)}
          onReopenStructureSelection={() => {}}
          onReopenHookSelection={() => {}}
          onCorrect={() => {}}
          isLoadingCorrection={false}
          onSaveDraftText={() => {}}
          isSavingDraftText={false}
        />
      </ToastProvider>
    );
  }

  it("donne au compteur sa reference", () => {
    renderPanel("Trois mots ici.");
    const remaining = document.querySelector(".draft-remaining");
    expect(remaining?.textContent).toMatch(/restants sur 3\s?000$/u);
  });

  it("garde la mise en garde sur la detection hors du flux, en infobulle", () => {
    const { container } = renderPanel("Trois mots ici.");
    expect(container.textContent).toContain("Aucun marqueur repéré");
    expect(container.textContent).not.toContain("La détection sous-compte");
    const help = container.querySelector(".draft-tells__help");
    expect(help?.getAttribute("title")).toContain("La détection sous-compte");
  });

  it("pose la barre d action hors du conteneur qui defile", () => {
    const { container } = renderPanel("Trois mots ici.");
    const scroll = container.querySelector(".draft-scroll");
    const actions = container.querySelector(".draft-actions");
    expect(scroll).toBeTruthy();
    expect(actions).toBeTruthy();
    expect(scroll!.contains(actions!)).toBe(false);
    expect(actions!.parentElement!.classList.contains("draft-main")).toBe(true);
    expect(actions!.textContent).toContain("Copier le post");
  });
});

describe("PostPreview", () => {
  const contextUsed = {
    pillarLabel: "Pédagogie",
    voiceGuardrail: "Voix directe",
    activeSkills: ["linkedin-draft"]
  };

  it("commente la coupe quand le repli tombe au milieu d un mot", () => {
    // 209 lettres puis « renforce » : le repli passe entre deux lettres.
    const body = "a".repeat(LINKEDIN_FOLD_CHARS - 1) + "renforce le propos et continue ensuite.";
    const { container } = render(
      <PostPreview bodyMarkdown={body} contextUsed={contextUsed} />
    );
    expect(container.textContent).toContain("Ici la coupe tombe au milieu d'un mot");
  });

  it("ne le dit pas quand la coupe tombe sur une espace", () => {
    const body = "a".repeat(LINKEDIN_FOLD_CHARS) + " renforce le propos et continue ensuite.";
    const { container } = render(
      <PostPreview bodyMarkdown={body} contextUsed={contextUsed} />
    );
    expect(container.textContent).toContain("Ce qui est au-dessus du trait");
    expect(container.textContent).not.toContain("Ici la coupe tombe au milieu d'un mot");
  });
});

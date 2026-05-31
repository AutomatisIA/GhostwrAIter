// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GuidedTour } from "./GuidedTour";
import { TOUR_STEPS, shouldShowTour } from "./guided-tour-steps";

afterEach(cleanup);

describe("shouldShowTour (declenchement automatique pur)", () => {
  it("affiche la visite quand jamais vue ET espace vierge", () => {
    expect(shouldShowTour({ seen: false, isEmpty: true })).toBe(true);
  });

  it("ne se redeclenche PAS quand le flag est pose", () => {
    expect(shouldShowTour({ seen: true, isEmpty: true })).toBe(false);
  });

  it("ne s'affiche pas si l'espace n'est pas vierge", () => {
    expect(shouldShowTour({ seen: false, isEmpty: false })).toBe(false);
  });

  it("ne s'affiche pas si vue ET espace rempli", () => {
    expect(shouldShowTour({ seen: true, isEmpty: false })).toBe(false);
  });
});

describe("GuidedTour (accessibilite + navigation)", () => {
  it("ne rend rien quand ferme", () => {
    render(<GuidedTour open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("expose role dialog + aria-modal et un titre lie", () => {
    render(<GuidedTour open onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("demarre a la premiere etape, Precedent desactive", () => {
    render(<GuidedTour open onClose={vi.fn()} />);
    expect(screen.getByText(TOUR_STEPS[0]!.title)).toBeTruthy();
    const previous = screen.getByRole("button", { name: "Précédent" });
    expect((previous as HTMLButtonElement).disabled).toBe(true);
  });

  it("avance et recule entre les etapes", () => {
    render(<GuidedTour open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByText(TOUR_STEPS[1]!.title)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Précédent" }));
    expect(screen.getByText(TOUR_STEPS[0]!.title)).toBeTruthy();
  });

  it("affiche Terminer sur la derniere etape et ferme dessus", () => {
    const onClose = vi.fn();
    render(<GuidedTour open onClose={onClose} />);
    for (let i = 0; i < TOUR_STEPS.length - 1; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Suivant|Terminer/ }));
    }
    const finish = screen.getByRole("button", { name: "Terminer" });
    fireEvent.click(finish);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ferme via Passer a tout moment", () => {
    const onClose = vi.fn();
    render(<GuidedTour open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Passer" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ferme avec Escape", () => {
    const onClose = vi.fn();
    render(<GuidedTour open onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("deplace le focus sur le titre a l'ouverture", () => {
    render(<GuidedTour open onClose={vi.fn()} />);
    expect(document.activeElement?.textContent).toBe(TOUR_STEPS[0]!.title);
  });

  it("piege le focus (Tab depuis le dernier revient au premier)", () => {
    render(<GuidedTour open onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    const buttons = screen.getAllByRole("button");
    const last = buttons[buttons.length - 1]!;
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
  });
});

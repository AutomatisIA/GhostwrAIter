// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AiProgress } from "./AiProgress";

afterEach(cleanup);

describe("AiProgress", () => {
  it("affiche l'intention, la position dans le pipeline et le temps ecoule (running)", () => {
    render(
      <AiProgress
        phase="redaction"
        intentLabel="Rédaction du post en cours…"
        elapsedMs={3200}
        currentIndex={3}
        totalSteps={5}
        state="running"
      />
    );

    expect(screen.getByText("Rédaction du post en cours…")).toBeTruthy();
    // Position pipeline : etape 4 sur 5 (index 3 => humain 4).
    expect(screen.getByText(/4\s*\/\s*5/)).toBeTruthy();
    // Temps ecoule affiche en secondes.
    expect(screen.getByText(/3[.,]2\s*s/)).toBeTruthy();
  });

  it("annonce l'etat via un role status en cours d'execution", () => {
    render(
      <AiProgress
        phase="structure"
        intentLabel="Choix de la structure en cours…"
        elapsedMs={0}
        currentIndex={1}
        totalSteps={5}
        state="running"
      />
    );
    const region = screen.getByRole("status");
    expect(region.textContent).toContain("Choix de la structure en cours…");
  });

  it("celebre le succes (etat success expose pour le style/motion)", () => {
    const { container } = render(
      <AiProgress
        phase="redaction"
        intentLabel="Rédaction du post en cours…"
        elapsedMs={4100}
        currentIndex={3}
        totalSteps={5}
        state="success"
      />
    );
    const root = container.querySelector(".ds-ai-progress");
    expect(root?.getAttribute("data-state")).toBe("success");
  });

  it("affiche un message d'erreur lisible et assertif, jamais avale (error)", () => {
    render(
      <AiProgress
        phase="redaction"
        intentLabel="Rédaction du post en cours…"
        elapsedMs={1200}
        currentIndex={3}
        totalSteps={5}
        state="error"
        errorMessage="Codex CLI n'a pas pu démarrer. Vérifie qu'il est installé et authentifié."
      />
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Codex CLI n'a pas pu démarrer");
  });

  it("n'utilise pas de valeurs de token en dur dans les styles inline", () => {
    const { container } = render(
      <AiProgress
        phase="redaction"
        intentLabel="Rédaction en cours…"
        elapsedMs={1000}
        currentIndex={3}
        totalSteps={5}
        state="running"
      />
    );
    const styled = container.querySelectorAll<HTMLElement>("[style]");
    styled.forEach((el) => {
      const style = el.getAttribute("style") ?? "";
      // Toute valeur de couleur/dimension passe par var(--…).
      expect(/#[0-9a-fA-F]{3,8}/.test(style)).toBe(false);
    });
  });
});

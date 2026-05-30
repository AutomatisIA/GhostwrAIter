// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Field } from "./Field";

afterEach(cleanup);

describe("Field", () => {
  it("associe le label au champ via htmlFor/id", () => {
    render(
      <Field label="Angle" htmlFor="angle">
        <input />
      </Field>
    );
    const input = screen.getByLabelText("Angle");
    expect(input.id).toBe("angle");
  });

  it("rend hint et example", () => {
    render(
      <Field label="Pilier" htmlFor="pilier" hint="Theme recurrent" example="ex: Adoption IA">
        <input />
      </Field>
    );
    expect(screen.getByText("Theme recurrent")).toBeTruthy();
    expect(screen.getByText("ex: Adoption IA")).toBeTruthy();
  });

  it("lie hint, example et error via aria-describedby", () => {
    render(
      <Field label="Titre" htmlFor="titre" hint="aide" example="exemple" error="Requis">
        <input />
      </Field>
    );
    const input = screen.getByLabelText("Titre");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("titre-hint");
    expect(describedBy).toContain("titre-example");
    expect(describedBy).toContain("titre-error");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("n'expose pas aria-invalid sans erreur", () => {
    render(
      <Field label="Sujet" htmlFor="sujet">
        <input />
      </Field>
    );
    expect(screen.getByLabelText("Sujet").getAttribute("aria-invalid")).toBeNull();
  });
});

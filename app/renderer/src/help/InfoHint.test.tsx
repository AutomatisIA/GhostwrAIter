// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InfoHint } from "./InfoHint";
import { GLOSSARY, type TermKey } from "./glossary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("InfoHint", () => {
  it("rend un declencheur accessible portant le label du terme", () => {
    render(<InfoHint term="icp" />);
    const trigger = screen.getByRole("button", { name: /icp/i });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("type")).toBe("button");
  });

  it("affiche la definition du glossaire au survol et la lie via aria-describedby", () => {
    render(<InfoHint term="pilier" />);
    const trigger = screen.getByRole("button");
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(trigger.parentElement as HTMLElement);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain(GLOSSARY.pilier.definition);
    expect(trigger.getAttribute("aria-describedby")).toBe(tip.id);
  });

  it("affiche aussi la definition au focus clavier", () => {
    render(<InfoHint term="cadrage" />);
    const trigger = screen.getByRole("button");
    fireEvent.focus(trigger);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain(GLOSSARY.cadrage.definition);
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("affiche l'exemple quand le terme en possede un", () => {
    render(<InfoHint term="pilier" />);
    const trigger = screen.getByRole("button");
    fireEvent.focus(trigger);
    const tip = screen.getByRole("tooltip");
    expect(GLOSSARY.pilier.example).toBeDefined();
    expect(tip.textContent).toContain(GLOSSARY.pilier.example as string);
  });

  it("se ferme avec Escape", () => {
    render(<InfoHint term="oauth" />);
    const trigger = screen.getByRole("button");
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("ne plante pas et previent en dev pour un terme inconnu", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<InfoHint term={"inconnu" as TermKey} />);
    expect(container.querySelector("button")).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

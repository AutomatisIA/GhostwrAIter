// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

afterEach(cleanup);

describe("Tooltip", () => {
  it("affiche le contenu au survol et le lie via aria-describedby", () => {
    render(
      <Tooltip content="Definition claire">
        <button>terme</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "terme" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(trigger.parentElement as HTMLElement);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe("Definition claire");
    expect(trigger.getAttribute("aria-describedby")).toBe(tip.id);
    fireEvent.mouseLeave(trigger.parentElement as HTMLElement);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("affiche le contenu au focus clavier", () => {
    render(
      <Tooltip content="Aide focus">
        <button>terme</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "terme" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("se ferme avec Escape", () => {
    render(
      <Tooltip content="Aide">
        <button>terme</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "terme" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

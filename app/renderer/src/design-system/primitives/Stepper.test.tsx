// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Stepper } from "./Stepper";

afterEach(cleanup);

const steps = [
  { key: "cadrage", label: "Cadrage" },
  { key: "structure", label: "Structure" },
  { key: "hook", label: "Accroche" },
  { key: "redaction", label: "Redaction" }
];

describe("Stepper", () => {
  it("distingue completed / current / upcoming", () => {
    render(<Stepper steps={steps} currentIndex={1} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0].getAttribute("data-state")).toBe("completed");
    expect(items[1].getAttribute("data-state")).toBe("current");
    expect(items[2].getAttribute("data-state")).toBe("upcoming");
    expect(items[3].getAttribute("data-state")).toBe("upcoming");
  });

  it("pose aria-current=step uniquement sur l'etape courante", () => {
    render(<Stepper steps={steps} currentIndex={2} />);
    const items = screen.getAllByRole("listitem");
    const currentMarkers = items.filter((el) => el.getAttribute("aria-current") === "step");
    expect(currentMarkers).toHaveLength(1);
    expect(items[2].getAttribute("aria-current")).toBe("step");
  });

  it("marque les etapes passees avec un check, pas comme actives", () => {
    render(<Stepper steps={steps} currentIndex={3} />);
    const items = screen.getAllByRole("listitem");
    // Les trois premieres sont completees, pas current.
    expect(items.slice(0, 3).every((el) => el.getAttribute("data-state") === "completed")).toBe(
      true
    );
    expect(items.slice(0, 3).every((el) => el.getAttribute("aria-current") === null)).toBe(true);
  });
});

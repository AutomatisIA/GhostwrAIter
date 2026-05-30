// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Card } from "./Card";

afterEach(cleanup);

describe("Card", () => {
  it("applique l'elevation par defaut (1)", () => {
    render(<Card data-testid="c">contenu</Card>);
    expect(screen.getByTestId("c").getAttribute("data-elevation")).toBe("1");
  });

  it("rend les elevations 0..3", () => {
    for (const elevation of [0, 1, 2, 3] as const) {
      cleanup();
      render(
        <Card elevation={elevation} data-testid="c">
          x
        </Card>
      );
      expect(screen.getByTestId("c").getAttribute("data-elevation")).toBe(String(elevation));
    }
  });

  it("marque interactive et focusable", () => {
    render(
      <Card interactive data-testid="c">
        x
      </Card>
    );
    const card = screen.getByTestId("c");
    expect(card.getAttribute("data-interactive")).toBe("true");
    expect(card.getAttribute("tabindex")).toBe("0");
  });

  it("marque accent", () => {
    render(
      <Card accent data-testid="c">
        x
      </Card>
    );
    expect(screen.getByTestId("c").getAttribute("data-accent")).toBe("true");
  });

  it("rend l'element fourni via as", () => {
    render(
      <Card as="section" data-testid="c">
        x
      </Card>
    );
    expect(screen.getByTestId("c").tagName).toBe("SECTION");
  });
});

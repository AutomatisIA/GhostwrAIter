// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("rend la variante text par defaut", () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector(".ds-skeleton");
    expect(el?.getAttribute("data-variant")).toBe("text");
    expect(el?.getAttribute("aria-hidden")).toBe("true");
  });

  it("rend les variantes text/card/block", () => {
    for (const variant of ["text", "card", "block"] as const) {
      const { container } = render(<Skeleton variant={variant} />);
      expect(container.querySelector(".ds-skeleton")?.getAttribute("data-variant")).toBe(variant);
      cleanup();
    }
  });

  it("rend count placeholders", () => {
    const { container } = render(<Skeleton count={3} />);
    expect(container.querySelectorAll(".ds-skeleton")).toHaveLength(3);
  });

  it("rend au moins un placeholder meme avec count invalide", () => {
    const { container } = render(<Skeleton count={0} />);
    expect(container.querySelectorAll(".ds-skeleton").length).toBeGreaterThanOrEqual(1);
  });
});

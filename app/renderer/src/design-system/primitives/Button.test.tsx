// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("applique la variante secondary par defaut", () => {
    render(<Button>Action</Button>);
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe("secondary");
  });

  it("rend chaque variante via data-variant", () => {
    for (const variant of ["primary", "secondary", "danger", "ghost"] as const) {
      cleanup();
      render(<Button variant={variant}>X</Button>);
      expect(screen.getByRole("button").getAttribute("data-variant")).toBe(variant);
    }
  });

  it("rend chaque taille via data-size", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      cleanup();
      render(<Button size={size}>X</Button>);
      expect(screen.getByRole("button").getAttribute("data-size")).toBe(size);
    }
  });

  it("expose aria-busy et desactive l'action quand loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Generer
      </Button>
    );
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("est desactive quand disabled", () => {
    render(<Button disabled>X</Button>);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("type button par defaut, transmet les props natifs", () => {
    render(<Button data-testid="b">X</Button>);
    expect(screen.getByTestId("b").getAttribute("type")).toBe("button");
  });
});

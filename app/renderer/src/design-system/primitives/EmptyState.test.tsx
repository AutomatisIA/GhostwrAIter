// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("affiche titre et description", () => {
    render(<EmptyState title="Aucun brouillon" description="Commencez par creer une idee." />);
    expect(screen.getByText("Aucun brouillon")).toBeTruthy();
    expect(screen.getByText("Commencez par creer une idee.")).toBeTruthy();
  });

  it("declenche l'action proposee", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Vide"
        description="Rien ici"
        action={{ label: "Creer une idee", onClick }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Creer une idee" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("n'affiche pas de bouton sans action", () => {
    render(<EmptyState title="Vide" description="Rien" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

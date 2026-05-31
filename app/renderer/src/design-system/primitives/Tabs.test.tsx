// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Tabs } from "./Tabs";

afterEach(cleanup);

const items = [
  { value: "a", label: "Onglet A" },
  { value: "b", label: "Onglet B" },
  { value: "c", label: "Onglet C" }
];

function Harness({ initial = "a" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <Tabs items={items} value={value} onChange={setValue} aria-label="Sections" />;
}

describe("Tabs", () => {
  it("expose role tablist et tab avec aria-selected", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist")).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("false");
  });

  it("change de selection au clic", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "Onglet B" }));
    expect(screen.getByRole("tab", { name: "Onglet B" }).getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("navigue avec les fleches", () => {
    render(<Harness />);
    const first = screen.getByRole("tab", { name: "Onglet A" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Onglet B" }).getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("boucle au debut avec ArrowLeft depuis le premier onglet", () => {
    render(<Harness />);
    const first = screen.getByRole("tab", { name: "Onglet A" });
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Onglet C" }).getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("met le focus clavier uniquement sur l'onglet selectionne (roving tabindex)", () => {
    render(<Harness />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]!.getAttribute("tabindex")).toBe("0");
    expect(tabs[1]!.getAttribute("tabindex")).toBe("-1");
  });
});

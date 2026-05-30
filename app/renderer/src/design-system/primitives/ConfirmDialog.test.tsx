// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Supprimer le brouillon ?"
      message="Cette action est definitive."
      destructive
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("ne rend rien quand ferme", () => {
    render(
      <ConfirmDialog
        open={false}
        title="t"
        message="m"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("expose role dialog + aria-modal et un titre lie", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("place le focus initial sur Annuler", () => {
    setup();
    expect(document.activeElement?.textContent).toBe("Annuler");
  });

  it("utilise un bouton danger en mode destructif", () => {
    setup({ destructive: true });
    const confirm = screen.getByRole("button", { name: "Confirmer" });
    expect(confirm.getAttribute("data-variant")).toBe("danger");
  });

  it("declenche onConfirm et onCancel", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("annule avec Escape", () => {
    const { onCancel } = setup();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("piege le focus (Tab depuis le dernier revient au premier)", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    const confirm = screen.getByRole("button", { name: "Confirmer" });
    confirm.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement?.textContent).toBe("Annuler");
  });
});

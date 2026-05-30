// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderHook, screen } from "@testing-library/react";
import { ToastProvider } from "./ToastProvider";
import { useToast } from "./toast-context";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe("ToastProvider / useToast", () => {
  it("empile plusieurs toasts (file)", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.show({ kind: "info", message: "Premier" });
      result.current.show({ kind: "success", message: "Second" });
    });
    expect(screen.getByText("Premier")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("rend les kinds success/error/info avec data-kind", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.show({ kind: "success", message: "ok" });
      result.current.show({ kind: "error", message: "ko" });
      result.current.show({ kind: "info", message: "note" });
    });
    const region = screen.getByRole("region", { name: "Notifications" });
    const kinds = Array.from(region.querySelectorAll(".ds-toast")).map((el) =>
      el.getAttribute("data-kind")
    );
    expect(kinds).toEqual(["success", "error", "info"]);
  });

  it("annonce les erreurs en role alert / aria-live assertive", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.show({ kind: "error", message: "Echec" });
    });
    const toast = screen.getByText("Echec").closest(".ds-toast") as HTMLElement;
    expect(toast.getAttribute("role")).toBe("alert");
    expect(toast.getAttribute("aria-live")).toBe("assertive");
  });

  it("auto-dismiss apres durationMs", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.show({ kind: "info", message: "Ephemere", durationMs: 1000 });
    });
    expect(screen.getByText("Ephemere")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Ephemere")).toBeNull();
  });

  it("se ferme manuellement via le bouton", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.show({ kind: "info", message: "A fermer" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Fermer la notification" }));
    expect(screen.queryByText("A fermer")).toBeNull();
  });

  it("leve une erreur hors provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow();
    spy.mockRestore();
  });
});

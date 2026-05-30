import React, { useCallback, useMemo, useRef, useState } from "react";
import { ToastContext, type Toast, type ToastApi, type ToastKind } from "./toast-context";

const DEFAULT_DURATION_MS = 5000;

const ICONS: Record<ToastKind, string> = {
  success: "✓",
  error: "!",
  info: "i"
};

let counter = 0;
function nextId(): string {
  counter += 1;
  return `toast-${counter}-${Date.now()}`;
}

/**
 * Fournisseur de feedback unifie (T016). File d'attente, auto-dismiss,
 * empilement. Remplace les strings `status` mutees et les confirmations par
 * changement de label. Region annoncee via `aria-live`. Les surfaces flottent
 * en glassmorphism (tokens glass).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId();
      const entry: Toast = { id, ...toast };
      setToasts((current) => [...current, entry]);
      const duration = toast.durationMs ?? DEFAULT_DURATION_MS;
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Region live PERSISTANTE (presente des le montage) : les mutations de
       * son contenu sont annoncees de maniere fiable. Les toasts polite
       * (success/info) y sont injectes ; les erreurs portent en plus
       * role="alert" pour une annonce assertive immediate. */}
      <div
        className="ds-toast-region"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="ds-toast ds-allow-opacity-motion"
            data-kind={toast.kind}
            role={toast.kind === "error" ? "alert" : "status"}
            aria-live={toast.kind === "error" ? "assertive" : undefined}
          >
            <span className="ds-toast__icon" aria-hidden="true">
              {ICONS[toast.kind]}
            </span>
            <span className="ds-toast__message">{toast.message}</span>
            <button
              type="button"
              className="ds-toast__close"
              aria-label="Fermer la notification"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

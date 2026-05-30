import { createContext, useContext } from "react";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  durationMs?: number;
}

export interface ToastApi {
  show: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Accede a l'API toasts. Doit etre utilise sous un <ToastProvider>. */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast doit etre utilise a l'interieur d'un <ToastProvider>.");
  }
  return context;
}

import React, { useEffect, useId, useRef } from "react";
import { Button } from "./Button";
import { useDialogKeyboard } from "./use-dialog-keyboard";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * Etat de chargement du bouton Confirmer : affiche le spinner et desactive
   * l'action (anti double-soumission pendant une operation en vol).
   */
  confirmLoading?: boolean;
  /** Desactive le bouton Confirmer sans afficher de spinner. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dialogue de confirmation accessible (T015b, FR-011). Remplace le pattern
 * « label du bouton mute en Confirmer ? » et tout `window.confirm` natif.
 * Modale : `role="dialog"` + `aria-modal`, focus piege, Escape annule, focus
 * initial sur Annuler. Surface flottante en glassmorphism (tokens glass).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  confirmLoading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Focus initial sur Annuler a l'ouverture.
  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  // Echap, piege de focus et restitution au declencheur : le clavier du
  // dialogue est ecoute sur `document` et non sur son propre `div`, sans quoi un
  // clic sur le texte du message le rendait sourd (cf. `use-dialog-keyboard`).
  useDialogKeyboard(open, dialogRef, onCancel);

  if (!open) {
    return null;
  }

  return (
    <div
      className="ds-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="ds-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <h2 className="ds-dialog__title" id={titleId}>
          {title}
        </h2>
        <div className="ds-dialog__message" id={descId}>
          {message}
        </div>
        <div className="ds-dialog__actions">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={confirmLoading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

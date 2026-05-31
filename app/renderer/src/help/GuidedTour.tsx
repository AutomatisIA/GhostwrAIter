/*
 * Visite guidee premier lancement (feature 010, T040/T041/T046).
 *
 * Overlay pas-a-pas, accessible (focus piege, Escape, `role="dialog"` +
 * `aria-modal`), qui presente les cinq ecrans de l'application et surtout
 * l'ORDRE conseille du parcours (Strategie -> Idees/Creer -> Bibliotheque).
 * Ignorable a tout moment via « Passer ».
 *
 * Declenchement (logique pure `shouldShowTour`) : au premier lancement, quand
 * l'espace de travail est vierge ET que le flag `guided-tour-seen` est absent
 * de `app_settings`. Une fois vue ou passee, le flag est ecrit et la visite ne
 * se redeclenche plus automatiquement (re-lancable depuis Parametres).
 *
 * Motion douce, reduced-motion-aware via `useMotionVariants`. La derniere
 * etape porte une animation de celebration (variant `celebration`).
 *
 * Aucun token en dur : tout le style passe par var(--…) (cf. styles.css).
 */
import React, { useCallback, useEffect, useId, useRef } from "react";
import { motion } from "motion/react";
import { Button } from "../design-system/primitives";
import {
  celebration,
  fadeInUp,
  useMotionVariants
} from "../design-system/motion/variants";
import { TOUR_STEPS } from "./guided-tour-steps";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface GuidedTourProps {
  open: boolean;
  /** Appele quand la visite est terminee ou passee (pour poser le flag). */
  onClose: () => void;
}

export function GuidedTour({ open, onClose }: GuidedTourProps) {
  const [index, setIndex] = React.useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const isFirst = index === 0;
  const isLast = index === TOUR_STEPS.length - 1;
  const step = TOUR_STEPS[index];

  // Variants reduced-motion-aware. La derniere etape celebre, les autres
  // apparaissent en douceur.
  const stepVariants = useMotionVariants(isLast ? celebration : fadeInUp);

  // Deplace le focus sur le titre a chaque changement d'etape (et a
  // l'ouverture) : un utilisateur clavier ne reste jamais bloque sur un
  // bouton qui ne correspond plus au contenu affiche. La reinitialisation a la
  // premiere etape se fait par remontage (cle cote parent), pas par setState
  // dans un effet.
  useEffect(() => {
    if (open) {
      headingRef.current?.focus();
    }
  }, [open, index]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        return;
      }
      const active = document.activeElement;
      // Garde : si le focus est hors du dialogue (ou nul), on le ramène sur le
      // premier élément focusable plutôt que de comparer un `activeElement`
      // étranger à `first`/`last`. Même protection que ConfirmDialog.
      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!open || !step) {
    return null;
  }

  function goPrevious() {
    setIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    if (isLast) {
      onClose();
      return;
    }
    setIndex((current) => Math.min(TOUR_STEPS.length - 1, current + 1));
  }

  return (
    <div className="ds-dialog-overlay guided-tour-overlay" role="presentation">
      <div
        ref={dialogRef}
        className="ds-dialog guided-tour"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={handleKeyDown}
      >
        <motion.div
          key={index}
          className="guided-tour__step ds-allow-opacity-motion"
          variants={stepVariants}
          initial="hidden"
          animate="visible"
        >
          <p className="guided-tour__progress" aria-hidden="true">
            Étape {index + 1} sur {TOUR_STEPS.length}
          </p>
          <h2
            ref={headingRef}
            className="guided-tour__title"
            id={titleId}
            tabIndex={-1}
          >
            {step.title}
          </h2>
          <div className="guided-tour__body" id={descId}>
            <p>{step.body}</p>
            {step.nextAction ? (
              <p className="guided-tour__next-action">
                <span className="guided-tour__next-action-label">Prochaine action :</span>{" "}
                {step.nextAction}
              </p>
            ) : null}
          </div>
        </motion.div>

        <div className="guided-tour__actions">
          <Button variant="ghost" onClick={onClose}>
            Passer
          </Button>
          <div className="guided-tour__nav">
            <Button variant="secondary" onClick={goPrevious} disabled={isFirst}>
              Précédent
            </Button>
            <Button variant="primary" onClick={goNext}>
              {isLast ? "Terminer" : "Suivant"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

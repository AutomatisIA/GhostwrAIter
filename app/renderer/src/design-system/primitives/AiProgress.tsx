/*
 * Primitive `AiProgress` (feature 010, T030).
 *
 * Feedback IA continu (FR-006/006a/007/008). Affiche en continu :
 *  - l'intention en langage clair (phase courante),
 *  - la position dans le pipeline (etape X / N),
 *  - le temps ecoule (timer renderer, fourni par `useAiProgress`).
 *
 * Etats :
 *  - `running` : barre de progression animee, region `role="status"` (polite).
 *  - `success` : hook de celebration (motion, reduced-motion aware via la
 *    variante `celebration` + `useMotionVariants`).
 *  - `error`   : message lisible et actionnable, `role="alert"` (assertif),
 *    JAMAIS avale (FR-008).
 *
 * Aucune valeur de token en dur : tout style passe par var(--…).
 */
import React from "react";
import { motion } from "motion/react";
import type { ExecutionPhase } from "@shared/types/execution-progress";
import { celebration, useMotionVariants } from "../motion/variants";

export interface AiProgressProps {
  phase: ExecutionPhase | null;
  intentLabel: string;
  elapsedMs: number;
  currentIndex: number;
  totalSteps: number;
  state: "idle" | "running" | "success" | "error";
  /** Message d'erreur lisible (etat `error`). */
  errorMessage?: string;
}

function formatElapsed(elapsedMs: number): string {
  const seconds = elapsedMs / 1000;
  // Une decimale, separateur francais.
  return `${seconds.toFixed(1).replace(".", ",")} s`;
}

export function AiProgress({
  phase,
  intentLabel,
  elapsedMs,
  currentIndex,
  totalSteps,
  state,
  errorMessage
}: AiProgressProps) {
  const celebrationVariants = useMotionVariants(celebration);
  const humanStep = Math.min(currentIndex + 1, totalSteps);
  const fillRatio = totalSteps > 0 ? Math.min(1, humanStep / totalSteps) : 0;

  if (state === "error") {
    return (
      <div
        className="ds-ai-progress"
        data-state="error"
        role="alert"
        aria-live="assertive"
      >
        <p className="ds-ai-progress__intent">{intentLabel}</p>
        <p className="ds-ai-progress__error">
          {errorMessage ?? "Une erreur s'est produite pendant la génération."}
        </p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <motion.div
        className="ds-ai-progress ds-allow-opacity-motion"
        data-state="success"
        role="status"
        aria-live="polite"
        variants={celebrationVariants}
        initial="hidden"
        animate="visible"
      >
        <p className="ds-ai-progress__intent">{intentLabel}</p>
        <p className="ds-ai-progress__meta">
          <span aria-hidden="true">✓</span> Terminé en {formatElapsed(elapsedMs)}
        </p>
      </motion.div>
    );
  }

  // running | idle
  return (
    <div
      className="ds-ai-progress"
      data-state={state}
      data-phase={phase ?? undefined}
      role="status"
      aria-live="polite"
    >
      <div className="ds-ai-progress__header">
        <span className="ds-ai-progress__intent">{intentLabel}</span>
        <span className="ds-ai-progress__position">
          {humanStep} / {totalSteps}
        </span>
      </div>
      <div className="ds-ai-progress__track" aria-hidden="true">
        <div
          className="ds-ai-progress__fill"
          style={{ width: `${(fillRatio * 100).toFixed(2)}%` }}
        />
      </div>
      <p className="ds-ai-progress__meta">Temps écoulé : {formatElapsed(elapsedMs)}</p>
    </div>
  );
}

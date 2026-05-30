import React from "react";

export interface StepDescriptor {
  key: string;
  label: string;
}

export interface StepperProps {
  steps: StepDescriptor[];
  currentIndex: number;
}

export type StepState = "completed" | "current" | "upcoming";

function stepState(index: number, currentIndex: number): StepState {
  if (index < currentIndex) {
    return "completed";
  }
  if (index === currentIndex) {
    return "current";
  }
  return "upcoming";
}

/**
 * Indicateur d'etapes (T012). Etats visuellement distincts : `completed` (✓),
 * `current` (mis en avant + glow), `upcoming` (attenue). `aria-current="step"`
 * sur l'etape courante uniquement. Corrige le bug « toutes les etapes passees
 * marquees actives ».
 */
export function Stepper({ steps, currentIndex }: StepperProps) {
  return (
    <ol className="ds-stepper">
      {steps.map((step, index) => {
        const state = stepState(index, currentIndex);
        return (
          <li
            key={step.key}
            className="ds-step"
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="ds-step__marker" aria-hidden="true">
              {state === "completed" ? "✓" : index + 1}
            </span>
            <span className="ds-step__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

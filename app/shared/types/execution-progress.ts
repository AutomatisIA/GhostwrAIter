/*
 * Canal d'evenement additif `execution:progress` (feature 010, T026).
 *
 * Extension strictement additive, one-way `main -> renderer`. Contrat complet :
 * `specs/010-visual-experience-overhaul/contracts/execution-progress-channel.md`.
 * N'altere ni ne supprime aucun canal requete/reponse existant.
 */

/** Etape reelle d'une operation IA (pipeline atelier + operations composites). */
export type ExecutionPhase =
  | "cadrage"
  | "structure"
  | "hook"
  | "redaction"
  | "correction"
  | "foundation"
  | "idees"
  | "variante"
  | "news";

/** Borne d'etape emise autour d'une invocation moteur. */
export type ExecutionProgressStatus = "started" | "completed" | "failed";

/** Moteur IA utilise (affichable cote renderer). */
export type ExecutionEngine = "codex" | "claude" | "gemini";

/**
 * Charge utile diffusee sur le canal `execution:progress`.
 *
 * Le payload ne porte PAS de `currentIndex`/`totalSteps` : la position dans le
 * pipeline est derivee cote renderer (mapping `phase -> position`), pas
 * transportee. `at` est l'horodatage de l'horloge du main au moment de
 * l'emission.
 */
export interface ExecutionProgressEvent {
  /** Correle les evenements d'une meme operation. */
  runId: string;
  /** Etape reelle en cours. */
  phase: ExecutionPhase;
  /** Borne d'etape. */
  status: ExecutionProgressStatus;
  /** Moteur utilise. */
  engine: ExecutionEngine;
  /** Horodatage ISO (horloge du main). */
  at: string;
  /** Present si `status === "failed"` (reutilise la taxonomie d'erreurs existante). */
  errorCode?: string;
}

/** Nom du canal IPC (constante partagee main/preload). */
export const EXECUTION_PROGRESS_CHANNEL = "execution:progress" as const;

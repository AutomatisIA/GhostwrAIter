/*
 * Etat derive de progression IA (feature 010, T029).
 *
 * S'abonne au canal additif `execution:progress` et derive un etat presentable
 * par la primitive `AiProgress`. Conception guidee par le contrat
 * (`contracts/execution-progress-channel.md`) et research D3 :
 *
 * - `spawnSync` bloque le main : `started`/`completed` arrivent groupes APRES
 *   le retour de l'appel. Le ressenti de continuite ne peut donc PAS dependre
 *   de l'arrivee de `started`. La continuite est portee par :
 *     1. le flag local `active` (bascule synchrone avant l'await cote appelant),
 *     2. un timer renderer independant (`elapsedMs`).
 *   Le canal fournit le libelle de phase, le moteur, et la confirmation
 *   terminale succes/echec.
 * - Le payload ne transporte NI `currentIndex` NI `totalSteps` : la position
 *   dans le pipeline est derivee ici d'un ordre canonique de phases.
 */
import { useEffect, useRef, useState } from "react";
import type {
  ExecutionEngine,
  ExecutionPhase,
  ExecutionProgressEvent
} from "@shared/types/execution-progress";

/** Mapping phase -> intention en langage clair (FR accentue). Source testable. */
export const PHASE_INTENT_LABELS: Record<ExecutionPhase, string> = {
  cadrage: "Cadrage du post en cours…",
  structure: "Choix de la structure en cours…",
  hook: "Génération des accroches en cours…",
  redaction: "Rédaction du post en cours…",
  correction: "Passe de correction en cours…",
  foundation: "Construction du socle éditorial en cours…",
  idees: "Génération des idées en cours…",
  variante: "Création de la variante en cours…",
  news: "Transformation de l'actualité en post en cours…"
};

/** Pipeline canonique de l'atelier (sert a deriver la position d'etape). */
export const WORKSHOP_PIPELINE: readonly ExecutionPhase[] = [
  "cadrage",
  "structure",
  "hook",
  "redaction",
  "correction"
] as const;

/** Mappe une phase vers son intention en langage clair. */
export function phaseToIntentLabel(phase: ExecutionPhase): string {
  return PHASE_INTENT_LABELS[phase];
}

export type AiProgressRunState = "idle" | "running" | "success" | "error";

export interface AiProgressState {
  phase: ExecutionPhase | null;
  intentLabel: string;
  elapsedMs: number;
  currentIndex: number;
  totalSteps: number;
  state: AiProgressRunState;
  engine: ExecutionEngine | null;
  errorCode?: string;
}

export interface UseAiProgressOptions {
  /**
   * Flag local d'activite (ex. `isLoadingStructures`). Bascule synchrone qui
   * porte le ressenti de continuite, independamment des evenements groupes.
   */
  active: boolean;
  /**
   * Phase active derivee localement (ex. depuis `isLoadingStructures`). Prioritaire
   * sur la phase du canal pour `intentLabel`/`currentIndex` : `spawnSync` bloque le
   * main, donc l'evenement `started` arrive GROUPE au retour de l'appel (research
   * D3) et ne peut pas porter le libelle PENDANT l'attente. La phase locale, qui
   * bascule de maniere synchrone, porte donc l'intention en continu ; le canal
   * conserve la transition terminale succes/echec et l'`errorCode`.
   */
  activePhase?: ExecutionPhase | null;
  /**
   * Pipeline de reference pour deriver `currentIndex`/`totalSteps` a partir de
   * la phase recue. Defaut : pipeline atelier.
   */
  pipeline?: readonly ExecutionPhase[];
  /** Nombre total d'etapes affichees (defaut : longueur du pipeline). */
  totalSteps?: number;
  /** Intervalle d'incrementation du timer en ms (defaut 100). */
  tickMs?: number;
}

const DEFAULT_TICK_MS = 100;

export function useAiProgress(options: UseAiProgressOptions): AiProgressState {
  const pipeline = options.pipeline ?? WORKSHOP_PIPELINE;
  const totalSteps = options.totalSteps ?? pipeline.length;
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;

  const [phase, setPhase] = useState<ExecutionPhase | null>(null);
  const [engine, setEngine] = useState<ExecutionEngine | null>(null);
  const [state, setState] = useState<AiProgressRunState>(options.active ? "running" : "idle");
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Abonnement au canal additif. Le desabonnement (removeListener) est appele
  // au demontage : pas de fuite.
  useEffect(() => {
    const api = window.linkedinPoster;
    if (!api?.onExecutionProgress) {
      return undefined;
    }
    const unsubscribe = api.onExecutionProgress((event: ExecutionProgressEvent) => {
      setPhase(event.phase);
      setEngine(event.engine);
      if (event.status === "started") {
        setState("running");
        setErrorCode(undefined);
      } else if (event.status === "completed") {
        setState("success");
      } else if (event.status === "failed") {
        setState("error");
        setErrorCode(event.errorCode);
      }
    });
    return unsubscribe;
  }, []);

  // Continuite portee par le flag local : `active` true => running immediat,
  // sans attendre l'evenement `started` (groupe par spawnSync).
  useEffect(() => {
    if (options.active) {
      // Synchronisation avec le canal IPC (machine a etats) : `active` true
      // bascule immediatement la machine en `running`, sans attendre
      // l'evenement `started` groupe par spawnSync. Pas de forme derivable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("running");
      setErrorCode(undefined);
    }
  }, [options.active]);

  // Timer independant : court tant que l'operation est active OU en cours.
  // Reinitialise a chaque nouveau cycle d'activite ; gele une fois terminee.
  const startRef = useRef<number | null>(null);
  const running = options.active || state === "running";
  useEffect(() => {
    if (!running) {
      startRef.current = null;
      return undefined;
    }
    startRef.current = Date.now();
    // Reinitialisation de l'horloge a chaque nouveau cycle d'activite : c'est
    // la synchronisation avec un systeme externe (le temps), pas un calcul
    // derivable au rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setElapsedMs(0);
    const interval = setInterval(() => {
      if (startRef.current !== null) {
        setElapsedMs(Date.now() - startRef.current);
      }
    }, tickMs);
    return () => clearInterval(interval);
  }, [running, tickMs]);

  // La phase locale prime sur la phase du canal (cf. activePhase) : elle est
  // disponible PENDANT l'attente, contrairement a l'evenement groupe.
  const effectivePhase = options.activePhase ?? phase;
  const currentIndex = effectivePhase ? Math.max(0, pipeline.indexOf(effectivePhase)) : 0;
  const intentLabel = effectivePhase ? phaseToIntentLabel(effectivePhase) : "";

  return {
    phase: effectivePhase,
    intentLabel,
    elapsedMs,
    currentIndex,
    totalSteps,
    state,
    engine,
    errorCode
  };
}

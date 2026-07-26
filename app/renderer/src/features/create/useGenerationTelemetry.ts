/*
 * Mesures reelles de l attente de generation.
 *
 * Deux valeurs, deux sources, aucune simulation :
 *
 * - `usePhaseDurations` chronometre chaque phase du cote du rendu, entre le
 *   basculement de son indicateur de chargement et son retour. C est une duree
 *   observee, recomptable par l utilisateur avec un chronometre de poche. Une
 *   phase qui n a pas tourne depuis l ouverture de l ecran n a pas de duree :
 *   elle en rend `undefined`, jamais zero.
 *
 * - `useEngineSignal` ecoute le canal `execution:progress` et retient QUAND le
 *   dernier evenement est arrive. C est le signe de vie : s il se fige, le
 *   moteur ne repond plus, et c est une information. Tant qu aucun evenement
 *   n est arrive, le hook rend `null` et l ecran le dit, plutot que d afficher
 *   un zero qui laisserait croire a une reponse a l instant.
 */
import { useEffect, useRef, useState } from "react";
import type { ExecutionEngine, ExecutionProgressEvent } from "@shared/types/execution-progress";
import type { WorkshopPhaseKey } from "../workshop/components/generation-phases";

export type PhaseDurations = Partial<Record<WorkshopPhaseKey, number>>;

export function usePhaseDurations(activePhase: WorkshopPhaseKey | null): PhaseDurations {
  const [durations, setDurations] = useState<PhaseDurations>({});
  const startedRef = useRef<{ phase: WorkshopPhaseKey; at: number } | null>(null);

  useEffect(() => {
    const started = startedRef.current;

    if (started && started.phase !== activePhase) {
      const measured = Date.now() - started.at;
      startedRef.current = null;
      // Enregistrement d une mesure d horloge : synchronisation avec le temps,
      // pas une valeur derivable du rendu.
      setDurations((current) => ({ ...current, [started.phase]: measured }));
    }

    if (activePhase && startedRef.current === null) {
      startedRef.current = { phase: activePhase, at: Date.now() };
    }
  }, [activePhase]);

  return durations;
}

export type EngineSignal = {
  engine: ExecutionEngine | null;
  /** Temps ecoule depuis le dernier evenement recu, `null` si aucun. */
  sinceMs: number | null;
};

const SIGNAL_TICK_MS = 500;

export function useEngineSignal(active: boolean): EngineSignal {
  const [signal, setSignal] = useState<{ engine: ExecutionEngine; at: number } | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const api = window.linkedinPoster;
    if (!api?.onExecutionProgress) return undefined;
    return api.onExecutionProgress((event: ExecutionProgressEvent) => {
      // Horodatage pris cote rendu : `event.at` vient de l horloge du processus
      // principal, et l ecart entre les deux horloges se lirait comme un retard
      // du moteur.
      setSignal({ engine: event.engine, at: Date.now() });
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    // Nouvelle attente : le signe de vie de la precedente ne dit plus rien.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignal(null);
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const interval = setInterval(() => setNow(Date.now()), SIGNAL_TICK_MS);
    return () => clearInterval(interval);
  }, [active]);

  return {
    engine: signal?.engine ?? null,
    sinceMs: signal ? Math.max(0, now - signal.at) : null
  };
}

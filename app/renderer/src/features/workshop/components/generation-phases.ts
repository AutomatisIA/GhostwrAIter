/*
 * Vocabulaire de l ecran d attente.
 *
 * Les quatre phases listees ici sont celles qui existent REELLEMENT dans le
 * pipeline de l atelier : une phase = une invocation du moteur, encadree par un
 * indicateur de chargement. La maquette en dessinait cinq, plus fines (lecture
 * du socle, envoi du contexte, redaction, reperage des marqueurs,
 * enregistrement), qu aucun signal du produit ne permet de mesurer. Afficher
 * une duree pour une etape qu on ne chronometre pas reviendrait a l inventer.
 */
import type { ExecutionEngine, ExecutionPhase } from "@shared/types/execution-progress";

export type WorkshopPhaseKey = Extract<
  ExecutionPhase,
  "structure" | "hook" | "redaction" | "correction"
>;

/** Ordre du parcours, tel qu il se deroule. */
export const WORKSHOP_PHASE_SEQUENCE: readonly WorkshopPhaseKey[] = [
  "structure",
  "hook",
  "redaction",
  "correction"
];

/** Libelle de phase au repos, sans « en cours » : la position le dit deja. */
export const WORKSHOP_PHASE_LABELS: Record<WorkshopPhaseKey, string> = {
  structure: "Choix de la structure narrative",
  hook: "Génération des accroches",
  redaction: "Rédaction du brouillon",
  correction: "Passe de correction"
};

export const ENGINE_LABELS: Record<ExecutionEngine, string> = {
  codex: "Codex",
  claude: "Claude",
  gemini: "Gemini"
};

export function isWorkshopPhase(phase: ExecutionPhase | null): phase is WorkshopPhaseKey {
  return phase !== null && (WORKSHOP_PHASE_SEQUENCE as readonly string[]).includes(phase);
}

/** Duree mesuree, une decimale, separateur francais. Ex. « 2,4 s ». */
export function formatSeconds(elapsedMs: number): string {
  return `${(elapsedMs / 1000).toFixed(1).replace(".", ",")} s`;
}

/**
 * Chronometre du temps ecoule, en minutes et secondes. Deux chiffres pour les
 * secondes et `tabular-nums` a l affichage : sans cela la largeur saute a chaque
 * dixieme et le nombre semble vibrer.
 */
export function formatChrono(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Secondes entieres ecoulees, pour le signe de vie du moteur. */
export function formatSinceSeconds(elapsedMs: number): string {
  return `${Math.max(0, Math.round(elapsedMs / 1000))} s`;
}

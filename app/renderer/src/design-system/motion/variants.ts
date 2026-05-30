/*
 * Variants `motion` reutilisables (feature 010, T006).
 * Les durees miroitent les tokens CSS de motion (tokens.css :
 * --duration-fast/base/slow = 150/250/400 ms) exprimees en secondes,
 * unite attendue par `motion`. Source unique cote JS.
 *
 * `resolveVariants` est un selecteur PUR : il neutralise les
 * transformations decoratives (translation, echelle, stagger) lorsque
 * l'utilisateur prefere un mouvement reduit, tout en conservant les
 * transitions d'opacite (feedback percevable). Le hook fin
 * `useMotionVariants` enveloppe ce selecteur via `useReducedMotion`.
 */
import { useReducedMotion, type Variants } from "motion/react";

/** Durees en secondes, alignees sur --duration-* (ms) de tokens.css. */
export const DURATIONS = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4
} as const;

/** Courbes alignees sur --ease-* de tokens.css. */
export const EASE = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.2, 0, 0, 1.2],
  exit: [0.4, 0, 1, 1]
} as const;

/** Apparition douce avec legere translation vers le haut. */
export const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.base, ease: EASE.standard }
  }
} satisfies Variants;

/** Conteneur orchestrant l'apparition en cascade de ses enfants. */
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 }
  }
} satisfies Variants;

/** Transition de page ample (utilisee avec AnimatePresence sur les routes). */
export const pageTransition = {
  initial: { opacity: 0, y: 24 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.slow, ease: EASE.standard }
  },
  exit: {
    opacity: 0,
    y: -16,
    transition: { duration: DURATIONS.base, ease: EASE.exit }
  }
};

/** Animation de celebration (succes IA, fin de visite guidee). */
export const celebration = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATIONS.slow, ease: EASE.emphasized }
  }
} satisfies Variants;

type AnyTarget = Record<string, unknown> & {
  transition?: Record<string, unknown> & { staggerChildren?: number; delayChildren?: number };
};

/**
 * Proprietes decoratives a neutraliser sous mouvement reduit, avec leur
 * valeur neutre (« pas de transformation »). Pour les translations, rotations
 * et cisaillements la valeur neutre est 0 ; pour l'echelle (`scale`) elle est
 * 1 : la ramener a 0 ferait disparaitre l'element (collapse a scale(0)) au
 * lieu de neutraliser le mouvement, ce qui casserait le feedback visible
 * (ex. celebration de succes IA / fin de visite guidee).
 */
const DECORATIVE_NEUTRAL: Record<string, number> = {
  y: 0,
  x: 0,
  rotate: 0,
  skew: 0,
  skewX: 0,
  skewY: 0,
  scale: 1
};

function neutralizeTarget(target: unknown): unknown {
  if (target === null || typeof target !== "object") {
    return target;
  }
  const next: AnyTarget = { ...(target as AnyTarget) };
  for (const [key, neutral] of Object.entries(DECORATIVE_NEUTRAL)) {
    if (key in next) {
      next[key] = neutral;
    }
  }
  if (next.transition) {
    const transition = { ...next.transition };
    if ("staggerChildren" in transition) {
      transition.staggerChildren = 0;
    }
    if ("delayChildren" in transition) {
      transition.delayChildren = 0;
    }
    next.transition = transition;
  }
  return next;
}

/**
 * Selecteur pur : renvoie les variants tels quels si le mouvement n'est
 * pas reduit, sinon une version sans transformation decorative ni stagger
 * (l'opacite est conservee). Testable sans rendu.
 */
export function resolveVariants<T extends Record<string, unknown>>(
  variants: T,
  prefersReducedMotion: boolean
): T {
  if (!prefersReducedMotion) {
    return variants;
  }
  const resolved: Record<string, unknown> = {};
  for (const [stateName, target] of Object.entries(variants)) {
    resolved[stateName] = neutralizeTarget(target);
  }
  return resolved as T;
}

/** Hook fin : applique `resolveVariants` selon la preference systeme. */
export function useMotionVariants<T extends Record<string, unknown>>(variants: T): T {
  const prefersReducedMotion = useReducedMotion() ?? false;
  return resolveVariants(variants, prefersReducedMotion);
}

/*
 * Barrel du module d'aide / vulgarisation (feature 010).
 * Surface d'import unique pour le glossaire et l'aide contextuelle.
 */
export { GLOSSARY, TERM_KEYS, getTerm } from "./glossary";
export type { GlossaryEntry, TermKey } from "./glossary";

export { InfoHint } from "./InfoHint";
export type { InfoHintProps } from "./InfoHint";

export { GuidedTour } from "./GuidedTour";
export type { GuidedTourProps } from "./GuidedTour";

export { TOUR_STEPS, shouldShowTour, GUIDED_TOUR_SEEN_KEY } from "./guided-tour-steps";
export type { TourStep } from "./guided-tour-steps";

export { TourContext, useTour } from "./tour-context";
export type { TourApi } from "./tour-context";

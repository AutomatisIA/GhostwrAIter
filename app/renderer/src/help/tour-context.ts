import { createContext, useContext } from "react";

/*
 * Contexte de la visite guidee (feature 010, T041).
 *
 * Une seule instance de `GuidedTour` est montee dans `AppShell`. Ce contexte
 * expose un unique `open()` pour permettre a un ecran (Parametres) de relancer
 * manuellement cette meme instance, sans en creer une seconde. Le relancement
 * manuel ignore le garde-fou « espace vierge » : seul le declenchement
 * AUTOMATIQUE verifie l'emptiness.
 */
export interface TourApi {
  /** Ouvre (ou rouvre) la visite guidee. */
  open: () => void;
}

export const TourContext = createContext<TourApi | null>(null);

/** Accede a l'API de la visite guidee. Doit etre utilise sous le provider. */
export function useTour(): TourApi {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour doit etre utilise a l'interieur du fournisseur de visite guidee.");
  }
  return context;
}

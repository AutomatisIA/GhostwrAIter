import React from "react";
import { Tooltip } from "../design-system/primitives/Tooltip";
import { getTerm, type TermKey } from "./glossary";

export interface InfoHintProps {
  /** Clé du terme à expliquer ; sa définition est lue dans le glossaire. */
  term: TermKey;
}

/**
 * Aide contextuelle accessible (T036, feature 010).
 *
 * Rend une petite icône « ? » à côté d'un terme et affiche, via la primitive
 * `Tooltip`, la définition de vulgarisation issue du glossaire (plus l'exemple
 * s'il existe). L'aide apparaît au survol ET au focus clavier, le contenu est
 * lié au déclencheur par `aria-describedby` et se ferme avec Escape (comportement
 * hérité de `Tooltip`).
 *
 * Le déclencheur est un vrai `<button>` porteur d'un nom accessible, condition
 * pour que `Tooltip` puisse y attacher `aria-describedby` et recevoir le focus.
 *
 * Terme inconnu : rendu sûr (aucun élément interactif) et avertissement en dev,
 * jamais d'exception.
 */
export function InfoHint({ term }: InfoHintProps) {
  const entry = getTerm(term);

  if (!entry) {
    if (import.meta.env.DEV) {
      console.warn(`[InfoHint] terme inconnu dans le glossaire : "${term}"`);
    }
    return null;
  }

  const content = (
    <span className="ds-info-hint__content">
      <span className="ds-info-hint__definition">{entry.definition}</span>
      {entry.example ? (
        <span className="ds-info-hint__example">Exemple : {entry.example}</span>
      ) : null}
    </span>
  );

  return (
    <Tooltip content={content}>
      <button
        type="button"
        className="ds-info-hint"
        aria-label={`Aide : ${entry.label}`}
      >
        <span aria-hidden="true">?</span>
      </button>
    </Tooltip>
  );
}

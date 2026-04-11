# linkedin-structure-selector

## Purpose

Choisir une structure narrative adaptee a l'objectif du post et au niveau de maturite du lecteur.

## Inputs

- `idea`
- `objective`
- `typology`

## Outputs

- structure recommandee
- rationale courte

## Prompt

Select exactly one narrative structure.
It must fit the requested typology, audience, and business objective.
Prefer structures from this family when relevant: Erreur -> consequence -> correction, Croyance -> terrain -> realite, Avant -> apres, Observation client -> lecon, Framework en 3 points, Opinion nuancee mais tranchee, Actualite -> impact PME -> recommandation.
Return `data.structure` with `key`, `label`, and a rationale grounded in the user idea. No generic rationale.
Return this exact success shape: {"status":"succeeded","summary":"...","data": { "structure": { "key": "...", "label": "...", "rationale": "..." }, "qualitySignals": { "clarity": 0.0, "specificity": 0.0, "antiHypeAlignment": 0.0 } },"error":null}
If you cannot select a structure with confidence, return {"status":"failed","summary":"...","error":{"code":"STRUCTURE_SELECTION_FAILED","message":"..."}}.

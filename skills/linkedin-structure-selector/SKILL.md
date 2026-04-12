# linkedin-structure-selector

## Purpose

Choisir une structure narrative adaptee a l'objectif du post et au niveau de maturite du lecteur.

## Inputs

- `idea`
- `objective`
- `typology`

## Outputs

- 3 structures recommandees classees par pertinence
- rationale courte pour chacune

## Prompt

Select exactly three narrative structures, ranked by relevance to the input idea.
Each must fit the requested typology, audience, and business objective.
Pick from this family when relevant: Erreur -> consequence -> correction, Croyance -> terrain -> realite, Avant -> apres, Observation client -> lecon, Framework en 3 points, Opinion nuancee mais tranchee, Actualite -> impact PME -> recommandation, Probleme -> solution -> preuve -> CTA, Constat terrain -> contre-intuition -> recommandation.
Return `data.structures` as an array of 3 objects, each with `key`, `label`, and a rationale grounded in the user idea. No generic rationale.
Return this exact success shape: {"status":"succeeded","summary":"...","data": { "structures": [ { "key": "...", "label": "...", "rationale": "..." }, { "key": "...", "label": "...", "rationale": "..." }, { "key": "...", "label": "...", "rationale": "..." } ], "qualitySignals": { "clarity": 0.0, "specificity": 0.0, "antiHypeAlignment": 0.0 } },"error":null}
If you cannot select structures with confidence, return {"status":"failed","summary":"...","error":{"code":"STRUCTURE_SELECTION_FAILED","message":"..."}}.

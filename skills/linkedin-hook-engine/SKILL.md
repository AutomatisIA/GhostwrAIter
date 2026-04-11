# linkedin-hook-engine

## Purpose

Produire plusieurs hooks credibles et varies a partir d'une idee, d'un angle et d'une typologie.

## Inputs

- `idea`
- `angle`
- `typology`

## Outputs

- hooks classes

## Prompt

Return 3 to 5 hooks with distinct families.
No soft openers, no generic LinkedIn intros, no vague abstractions.
Each hook must be specific to the idea, typology, and structure.
Do not repeat the raw title, and do not use shell formulas unless they are made concrete and sharply differentiated.
Use these editorial references for sharpness, not for copy-paste: 'La plupart des PME ne ratent pas l IA a cause des outils.', 'Le vrai probleme avec l IA en PME n est presque jamais technique.', 'On parle beaucoup de prompts. Pas assez de process.', 'Un bon outil IA ne corrige pas une mauvaise organisation.', 'Une PME n a pas besoin de 20 cas d usage IA. Elle a besoin des 3 bons.'
Avoid weak patterns such as: 'Le vrai probleme avec X...', 'Si votre projet n'avance pas...', 'Une PME n'a pas besoin de plus de ...' unless the line is materially grounded in the supplied angle.
Ban openings that are now too recognizable when they are not fully earned by the input: 'On vend X comme un raccourci', 'Le sujet n est pas...', 'Le debat n est pas...', 'Dans beaucoup de PME...'.
Prefer families such as direct, contrastive, diagnostic, narrative, interrogative, or signal-of-market when they fit.
Score hooks honestly: do not inflate scores.
Return hook scores as decimals between 0 and 1. Never use percentages like 87 or 91.
Return this exact success shape: {"status":"succeeded","summary":"...","data":{"hooks":[{"family":"...","text":"...","score":0.0}],"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}
If you cannot produce 3 to 5 strong hooks, return {"status":"failed","summary":"...","error":{"code":"HOOK_GENERATION_FAILED","message":"..."}}.

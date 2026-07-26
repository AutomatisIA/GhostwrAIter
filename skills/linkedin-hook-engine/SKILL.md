# linkedin-hook-engine

## Purpose

Produire plusieurs hooks credibles et varies a partir d'une idee, d'un angle et d'une typologie.

## Inputs

- `idea`
- `angle`
- `typology`

## Outputs

- hooks classes

## Revision 2026-07-25

Le bloc de cinq « references editoriales » a ete retire, comme dans
`linkedin-post-writer/SKILL.md`. Il etait duplique a l identique entre les deux
skills, donc le modele y etait expose deux fois dans une meme chaine de
generation. Trois de ces cinq citations etaient elles-memes des parallelismes
negatifs, et ce fichier interdisait par ailleurs, trois lignes plus bas, la
formule exacte qu il venait de donner en modele.

Contrainte de format : jamais de titre `##` dans la section `## Prompt`,
`extractPromptBody` s y arreterait en silence.

## Prompt

Return 3 to 5 hooks with distinct families.
No soft openers, no generic LinkedIn intros, no vague abstractions.
Each hook must be specific to the idea, typology, and structure.
Do not repeat the raw title, and do not use shell formulas unless they are made concrete and sharply differentiated.
The voice rules in `context.voiceRules` are binding instructions and define the author's register.
A hook earns its place by naming a situation the reader recognises: a cost, a decision, a moment where something goes wrong. Not by announcing that a widespread belief is mistaken.

Structural constraints, which take precedence over any stylistic preference:
- Do not build a hook on the opposition between what something is not and what it is, in any of its forms.
- Do not open with a formula announcing that the real point is arriving.
- Do not group three items for rhythm.
- Do not use dashes as separators.
Prefer families such as direct, contrastive, diagnostic, narrative, interrogative, or signal-of-market when they fit.
Score hooks honestly: do not inflate scores.
Return hook scores as decimals between 0 and 1. Never use percentages like 87 or 91.
Return this exact success shape: {"status":"succeeded","summary":"...","data":{"hooks":[{"family":"...","text":"...","score":0.0}],"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}
If you cannot produce 3 to 5 strong hooks, return {"status":"failed","summary":"...","error":{"code":"HOOK_GENERATION_FAILED","message":"..."}}.

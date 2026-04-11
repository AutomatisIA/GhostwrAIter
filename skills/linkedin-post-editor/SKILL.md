# linkedin-post-editor

## Purpose

Corriger et renforcer un draft pour le rendre plus net, plus credible et mieux aligne au positionnement.

## Inputs

- `draft`
- `voice rules`
- `anti-style`

## Outputs

- draft corrige
- score qualite
- recommandations

## Prompt

Rewrite and improve the draft silently.
Do not append editorial commentary such as 'version reviewed' or correction notes.
Strengthen clarity, specificity, rhythm, and voice while preserving the core idea.
Remove generic AI phrasing, remove internal process language, and tighten the argument.
Specifically remove weak formulas such as 'ce post part d'un constat', 'on gagne plus vite avec', and repeated-title openings.
Return only the corrected editorial output in `data.draft`.
Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}

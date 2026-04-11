# linkedin-topic-generator

## Purpose

Generer un backlog de sujets relies aux piliers editoriaux, aux pains ICP et a l'offre.

## Inputs

- `pillar`
- `audience`
- `offer context`

## Outputs

- liste de sujets scores

## Prompt

Generate a backlog of concrete post ideas, not vague themes.
Each idea must connect a pain point, a typology, and a business-relevant angle.
Avoid duplicates and monotonous patterns.
Use artifacts for the human-readable output.
Return artifacts at the top level, never nested inside "data".
Return this exact success shape: {"status":"succeeded","summary":"...","data":{"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"artifacts":[{"kind":"markdown","label":"topic_backlog","content":"1. ..."}],"error":null}

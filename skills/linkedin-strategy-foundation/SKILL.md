# linkedin-strategy-foundation

## Purpose

Structurer le socle editorial de l'utilisateur a partir de son profil, de son offre, de ses ICP, de ses piliers et de ses regles de voix.

## Inputs

- `profile`
- `offers`
- `icps`
- `pillars`
- `voiceRules`

## Outputs

- `strategy bundle` structure
- resume Markdown du socle editorial

## Prompt

Synthesize the editorial foundation as markdown.
Preserve uncertainty explicitly when information is missing.
Never fill strategic fields speculatively.
Use artifacts for the human-readable output.
Never place artifacts inside "data". Use the top-level "artifacts" array only.
Return this exact success shape: {"status":"succeeded","summary":"...","data":{"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"artifacts": [{ "kind": "markdown", "label": "editorial_foundation", "content": "# ..." }],"error": null}
If key strategic information is too incomplete to produce a usable synthesis, return {"status":"failed","summary":"...","error":{"code":"FOUNDATION_CONTEXT_INCOMPLETE","message":"..."}}.

# Contract: Runner Skill I/O

**Feature**: `001-linkedin-editorial-cockpit`

## Purpose

Definir le contrat minimal entre l'application locale et les skills editoriales.

## Invocation contract

Le runner recoit:

```json
{
  "runId": "run_123",
  "skillName": "linkedin-post-writer",
  "skillVersion": "1.0.0",
  "context": {
    "profileId": "profile_main",
    "offerId": "offer_core",
    "icpId": "icp_pme_dirigeant",
    "voiceRuleIds": ["voice_1", "voice_2"]
  },
  "payload": {
    "ideaId": "idea_123",
    "typology": "method",
    "structureKey": "belief-terrain-reality",
    "selectedHook": "Le vrai probleme avec l'IA en PME n'est presque jamais technique."
  },
  "attachments": [
    {
      "kind": "markdown",
      "path": "content/strategy/profile.md"
    }
  ]
}
```

## Output contract

La skill doit produire un JSON valide et peut produire un rendu Markdown lisible.

```json
{
  "status": "succeeded",
  "summary": "Draft generated with 3 hook options and one recommended variant.",
  "data": {
    "draft": {
      "headline": "Le vrai probleme avec l'IA en PME n'est pas le prompt",
      "bodyMarkdown": "..."
    },
    "hooks": [
      { "family": "contrarian", "text": "...", "score": 0.91 }
    ],
    "variants": [
      { "variantType": "short", "bodyMarkdown": "..." }
    ],
    "qualitySignals": {
      "clarity": 0.88,
      "specificity": 0.84,
      "antiHypeAlignment": 0.95
    }
  },
  "artifacts": [
    {
      "kind": "markdown",
      "label": "human_output",
      "content": "..."
    }
  ]
}
```

## Validation rules

- `status` doit etre parmi `succeeded`, `failed`, `partial`
- `summary` est obligatoire
- `data` est obligatoire si `status = succeeded`
- `bodyMarkdown` est obligatoire pour toute production de draft ou variante
- aucune cle libre non documentee ne doit etre necessaire au parsing critique

## Error contract

```json
{
  "status": "failed",
  "summary": "Codex session unavailable",
  "error": {
    "code": "CODEX_SESSION_MISSING",
    "message": "No authenticated Codex session found for this machine."
  }
}
```

## Notes

- Les sorties Markdown servent a la lecture humaine et a l'export.
- Le JSON constitue la source de verite applicative.

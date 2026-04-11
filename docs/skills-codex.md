# Skills Codex

## Principe

Les skills editoriales sont orchestrees par [skill-runner.service.ts](/Users/philippe/Dev/LinkedIn-Poster/app/main/domains/execution/skill-runner.service.ts) et executees par [codex-cli-runner.ts](/Users/philippe/Dev/LinkedIn-Poster/app/main/domains/execution/codex-cli-runner.ts).

Le contrat est strict:

- pas de fallback degrade
- pas de simulation locale
- pas de sortie partiellement correcte acceptee si le contrat n'est pas rempli
- JSON seulement

## Skills supportees

### `linkedin-strategy-foundation`

Role:

- transformer le bundle strategie en socle editorial lisible

Input principal:

- profil
- offres
- ICP
- piliers
- regles de voix

Sortie attendue:

- `status: "succeeded"`
- `data.qualitySignals`
- `artifacts[]` avec un markdown de synthese

Echec attendu si:

- le contexte est trop incomplet pour produire une synthese exploitable

### `linkedin-topic-generator`

Role:

- generer un backlog de sujets concrets a partir de la strategie

Input principal:

- profil
- positionnement
- piliers
- offres
- ICP

Sortie attendue:

- `status: "succeeded"`
- `data.qualitySignals`
- `artifacts[]` avec la liste des sujets

### `linkedin-structure-selector`

Role:

- choisir une structure narrative compatible avec l idee, la typologie et l objectif

Input principal:

- titre
- angle
- typologie
- objectif
- contexte strategie

Sortie attendue:

- `data.structure.key`
- `data.structure.label`
- `data.structure.rationale`
- `data.qualitySignals`

Echec attendu si:

- aucune structure n'est defendable avec confiance

### `linkedin-hook-engine`

Role:

- produire 3 a 5 accroches fortes et differenciees

Input principal:

- titre
- angle
- typologie
- structure choisie
- contexte strategie

Sortie attendue:

- `data.hooks[]`
- `data.qualitySignals`

Contraintes fortes:

- scores entre `0` et `1`
- familles distinctes
- pas d'ouverture molle
- pas de pattern trop generique

### `linkedin-post-writer`

Role:

- produire le draft final publiable

Input principal:

- titre
- angle
- typologie
- objectif
- structure retenue
- hook retenu
- contexte strategie enrichi

Sortie attendue:

- `data.draft.headline`
- `data.draft.bodyMarkdown`
- `data.qualitySignals`
- `data.hooks` optionnel

Contraintes fortes:

- texte publie, pas meta
- pas de jargon consultant
- pas de hype
- pas de phrase qui pourrait convenir a n'importe quel expert IA
- les deux premiers paragraphes doivent deja contenir une consequence business ou operationnelle

### `linkedin-post-editor`

Role:

- corriger silencieusement un draft

Input principal:

- headline
- bodyMarkdown
- contexte strategie

Sortie attendue:

- `data.draft`
- `data.qualitySignals`

Contraintes fortes:

- ne jamais expliquer la correction
- renvoyer uniquement la version corrigee

### `linkedin-repurpose`

Role:

- produire une vraie variante editoriale

Input principal:

- draft source
- qualite source
- typologie/original objective
- structure et hook source
- contexte strategie enrichi

Sortie attendue:

- `data.draft`
- `data.variants[]`
- `data.qualitySignals`

Contraintes fortes:

- angle reellement different
- pas de simple rephrase
- nouvelle promesse editoriale visible tres tot

### `linkedin-news-to-post`

Role:

- convertir une source de veille en draft editorial

Input principal:

- `sourceTitle`
- `sourceSummary`
- contexte strategie

Sortie attendue:

- `data.draft`
- `data.qualitySignals`

Echec attendu si:

- la source est trop vague
- aucun fait exploitable n'est present
- l'angle demanderait d'inventer des details

## Contrat de sortie

Tous les skills suivent le meme principe:

- succes:
  - `status`
  - `summary`
  - `data`
  - `error: null`
- echec:
  - `status: "failed"`
  - `summary`
  - `error.code`
  - `error.message`

La validation par skill est faite dans [skill-runner.service.ts](/Users/philippe/Dev/LinkedIn-Poster/app/main/domains/execution/skill-runner.service.ts).

## Contexte strategie envoye aux skills

Le contexte metier ne se limite plus a `pillarLabel` et `voiceGuardrail`.

Selon le domaine, on envoie aussi:

- `strategyProfileName`
- `strategyPositioning`
- `strategyBio`
- `strategyExpertiseSummary`
- `strategyOffersSummary`
- `strategyIcpSummary`
- `pillarDescription`

Le but est d'eviter les drafts corrects mais generiques.

## Echecs courants a connaitre

- Codex indisponible
- JSON invalide
- payload hors contrat
- hooks sans scores valides
- artifacts imbriques au mauvais endroit
- source de veille trop vague
- draft juge trop faible par le skill

## Comment tester les skills

Tests ciblés:

```bash
npx vitest run tests/unit/codex-cli-runner.test.ts
```

Audit reel Electron:

```bash
node scripts/real-app-audit.mjs
```

Benchmark editorial multi-sujets:

```bash
node scripts/benchmark-editorial-quality.mjs
```

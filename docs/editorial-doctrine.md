# Editorial doctrine

This file is the single source of truth for the editorial rules enforced by `scripts/eval-editorial-quality.mjs`. The grader, the unit tests under `tests/unit/eval-editorial-grader.test.ts`, and the iteration playbook (`docs/editorial-iteration-playbook.md`) all read this document. Edit it directly when the doctrine evolves — no recompilation needed.

The four sections below are mandatory. The parser refuses to start if any of them is missing. The number-detection regex inside the concrete-element heuristics is hardcoded in the parser source because numeric units are language-agnostic and stable.

## Banned Openings

- Dans beaucoup de PME
- En réalité
- Le vrai problème avec
- Sur le terrain
- On vend X comme l'étape d'après
- Le sujet n'est pas
- Le débat n'est pas

## Banned Meta Phrases

- Structure retenue
- Version revue
- Ce post part d'un constat terrain
- On gagne plus vite avec
- Variante orientée angle complémentaire

## Voice Rules

- Zéro chiffre inventé
- Phrases courtes et utiles
- Une idée centrale par post
- Au moins un élément concret par post
- CTA discret
- Aucune formulation corporate générique
- L'anti-style prime sur tout en cas de contradiction entre règles

## Concrete-Element Heuristics

A draft passes the concrete-element rule if at least one of the four categories below matches the body. Categories 2, 3, and 4 are keyword lists editable from this file. Category 1 (numbers) is detected by a hardcoded regex inside the parser that matches digits with optional units (`%`, `€`, `jours`, `heures`, `mois`, `FTE`, etc.) — that list is intentionally not editable from this file because numeric units are language-agnostic.

### Operational Cost Keywords

- licence
- supervision
- cadrage
- audit
- migration
- rebuild
- onboarding
- maintenance
- support
- formation

### Business Consequence Keywords

- retard
- perte
- bloque
- casse
- rejette
- refuse
- doublement
- dérive
- surcoût
- incident

### Arbitrage Keywords

- plutôt que
- contre
- versus
- au lieu de
- préfère
- renonce à
- arbitre
- tranche

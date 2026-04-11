# Contract — `docs/editorial-doctrine.md` and its parser

This document defines the structural contract of the doctrine markdown file and the parser that consumes it. The contract is enforced by `tests/unit/editorial-doctrine-parser.test.ts`.

## File location

`docs/editorial-doctrine.md`

## Required sections

The file MUST contain exactly these four `## ` headings, in any order, each followed by a markdown bulleted list. Sections in any other position or with any other heading text are ignored by the parser but tolerated for human-friendly preface text.

| Heading | Content rule |
|---|---|
| `## Banned Openings` | Bulleted list. Each item is one banned opening phrase. Empty list is allowed (the grader rule becomes a no-op for that category). |
| `## Banned Meta Phrases` | Bulleted list. Each item is one banned meta phrase. Empty list allowed. |
| `## Voice Rules` | Bulleted list. Documentation only. The parser exposes them but the grader does not enforce them programmatically. |
| `## Concrete-Element Heuristics` | Sub-sectioned bulleted lists. See below. |

## Sub-sectioning of `## Concrete-Element Heuristics`

Under this heading, three `### ` sub-headings are required:

| Sub-heading | Content rule |
|---|---|
| `### Operational Cost Keywords` | Bulleted list. Words or short phrases. |
| `### Business Consequence Keywords` | Bulleted list. Words or short phrases. |
| `### Arbitrage Keywords` | Bulleted list. Words or short phrases. |

The fourth concrete category — number detection — is hardcoded as a regex inside the parser and is NOT editable from the markdown file. Documentation about this is included as plain prose under `## Concrete-Element Heuristics` so the human reader knows the regex exists.

## Bullet item parsing

- Recognised bullet markers: `- `, `* `.
- Leading whitespace before the bullet marker is stripped.
- Trailing whitespace after the bullet content is stripped.
- Empty lines are ignored.
- A line that starts a new `## ` or `### ` heading terminates the current list.
- Items are returned as plain strings, no markdown formatting interpretation (no bold, italic, link rendering — they would be passed through verbatim if used).

## Public types

```ts
export type EditorialDoctrine = {
  bannedOpenings: string[];
  bannedMetaPhrases: string[];
  voiceRules: string[];
  concreteHeuristics: {
    numberRegex: RegExp;
    operationalCostKeywords: string[];
    businessConsequenceKeywords: string[];
    arbitrageKeywords: string[];
  };
};

export class EditorialDoctrineParseError extends Error {
  readonly code: "EDITORIAL_DOCTRINE_INVALID";
  readonly missingSections?: string[];
}
```

## Public functions

```ts
export function parseEditorialDoctrine(markdown: string): EditorialDoctrine;
export function loadEditorialDoctrineFromFile(path?: string): EditorialDoctrine;
```

`loadEditorialDoctrineFromFile()` defaults to `<repo>/docs/editorial-doctrine.md`.

## Parser behavior contract

### Happy path

- **Given** a markdown string with all four required `## ` sections, the three required `### ` sub-sections under `## Concrete-Element Heuristics`, and at least one bullet under each,
- **Then** `parseEditorialDoctrine()` returns an `EditorialDoctrine` with the four list fields populated and `numberRegex` set to the hardcoded numeric pattern.

### Missing required section

- **Given** the markdown is missing any of `## Banned Openings`, `## Banned Meta Phrases`, `## Voice Rules`, or `## Concrete-Element Heuristics`,
- **Then** the parser throws `EditorialDoctrineParseError` with `missingSections` listing the absent headings.

### Missing required sub-section

- **Given** `## Concrete-Element Heuristics` exists but lacks one of the three required `### ` sub-headings,
- **Then** the parser throws `EditorialDoctrineParseError` with `missingSections` listing the missing sub-heading(s).

### Empty list

- **Given** a section heading is present but its bullet list is empty,
- **Then** the corresponding field in the returned object is an empty array (no error). The grader is expected to handle empty lists gracefully (rule becomes a no-op).

### Tolerated content

- Plain prose paragraphs between sections are ignored.
- Other `## ` headings beyond the four required ones are ignored.
- Inline formatting (bold, italic, links) inside bullet items is preserved verbatim in the returned strings.
- Trailing newlines and trailing whitespace at end of file are tolerated.

### Number regex

The hardcoded `numberRegex` recognises:

- Plain integers: `42`, `1500`.
- Decimals with `.` or `,`: `3.5`, `2,7`.
- Optional units: `%`, `€`, `jours`, `heures`, `semaines`, `mois`, `an`, `ans`, `FTE`, `personnes`, `clients`, `projets`, `euros`, `M€`, `k€`, `K€`.
- Optional surrounding word boundaries.
- The list of units lives in the parser source as a constant array near the regex; updating it is a code change because numeric units are language-agnostic and stable.

## Test fixtures expected by `tests/unit/editorial-doctrine-parser.test.ts`

The test file constructs synthetic markdown strings inline and feeds them to `parseEditorialDoctrine()`. Cases covered:

1. Well-formed doctrine with all sections returns the expected structure.
2. Missing `## Banned Openings` raises `EditorialDoctrineParseError` with `missingSections: ["## Banned Openings"]`.
3. Missing all four sections raises with all four listed.
4. Missing `### Operational Cost Keywords` under existing `## Concrete-Element Heuristics` raises with that sub-heading listed.
5. Empty bullet list under a section returns an empty array, no error.
6. Bullets prefixed with `*` instead of `-` are recognised.
7. Plain prose paragraphs between sections are ignored.
8. The returned `numberRegex` matches "42", "3,5%", "12 jours", "1500€", "2 FTE".
9. The returned `numberRegex` does not match "ABC", "no number here".
10. `loadEditorialDoctrineFromFile()` reads the real `docs/editorial-doctrine.md` and returns a valid structure (sanity check that the committed file conforms to its own contract).

## Initial content of `docs/editorial-doctrine.md`

The initial content shipped by feature 006 mirrors the doctrine extracted from the cabinet's source documents and already captured in the project memory. Specifically:

- **Banned Openings** include: `Dans beaucoup de PME`, `En réalité`, `Le vrai problème avec`, `Sur le terrain`, `On vend X comme l'étape d'après`, `Le sujet n'est pas`, `Le débat n'est pas`.
- **Banned Meta Phrases** include: `Structure retenue`, `Version revue`, `Ce post part d'un constat terrain`, `On gagne plus vite avec`, `Variante orientée angle complémentaire`.
- **Voice Rules** include: `Zéro chiffre inventé`, `Phrases courtes et utiles`, `Une idée centrale par post`, `Au moins un élément concret`, `CTA discret`, `Aucune formulation corporate générique`, `L'anti-style prime sur tout`.
- **Concrete-Element Heuristics**:
  - Operational cost keywords: `licence`, `supervision`, `cadrage`, `audit`, `migration`, `rebuild`, `onboarding`, `maintenance`, `support`, `formation`.
  - Business consequence keywords: `retard`, `perte`, `bloque`, `casse`, `rejette`, `refuse`, `doublement`, `dérive`, `surcoût`, `incident`.
  - Arbitrage keywords: `plutôt que`, `contre`, `versus`, `au lieu de`, `préfère`, `renonce à`, `arbitre`, `tranche`.

# linkedin-post-writer

## Purpose

Generer un premier draft LinkedIn a partir de l'idee retenue, de la structure, du hook et du contexte editorial.

## Inputs

- `idea`
- `hook`
- `structure`
- `strategy bundle`

## Outputs

- draft Markdown
- hooks retenus
- signaux qualite

## Prompt

Write a publication-ready LinkedIn post in French.
Do not expose internal labels such as structure names, scoring, rationale, or prompt mechanics inside the draft.
Always start from the anti-style and voice profile contained in the context before writing.
Respect the anti-style constraint strictly: no consultant cliches, no inflated claims, no generic corporate phrasing.
The post must sound like an expert practitioner speaking to SME decision-makers.
Litmus test: if it does not sound like something the person would genuinely publish, return failed and do not bluff.
Use short readable paragraphs, one central idea, at least one concrete operational point, and a discreet CTA only if justified.
Prefer 120 to 220 words unless the input absolutely requires more.
Open with one sharp line that can stop the scroll. No warm-up paragraph.
If the input compares two approaches, make the tradeoff explicit with control, cost, risk, ROI, adoption, or operational consequences.
If strategy context includes an offer, audience pain, or pillar description, use them to sharpen the angle instead of staying generic.
Use these editorial references for sharpness, not for copy-paste: 'La plupart des PME ne ratent pas l IA a cause des outils.', 'Le vrai probleme avec l IA en PME n est presque jamais technique.', 'On parle beaucoup de prompts. Pas assez de process.', 'Un bon outil IA ne corrige pas une mauvaise organisation.', 'Une PME n a pas besoin de 20 cas d usage IA. Elle a besoin des 3 bons.'
Never start the post by repeating the headline verbatim.
Avoid soft transitions such as 'dans beaucoup de PME' or 'en realite' unless immediately tied to a concrete operational contrast.
Avoid generic openings such as 'On vend X comme l'etape d'apres', 'Sur le terrain', or 'Le vrai arbitrage' when they could apply to dozens of posts.
Never open with formulas such as 'Le sujet n est pas...', 'Le debat n est pas...', or 'Dans beaucoup de PME...' unless they are immediately anchored in a concrete operational fact.
The first two paragraphs must already contain a concrete business consequence or operational cost.
Never output phrases such as 'Structure retenue', 'Ce post part d'un constat terrain', 'On gagne plus vite avec', 'Version revue', or any other meta-writing commentary.
The final paragraph must sharpen the recommendation, arbitrage, or implication for an SME decision-maker. No generic landing.
Return `data.draft`, optionally `data.hooks`, and realistic `qualitySignals`.
Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"hooks":[{"family":"...","text":"...","score":0.0}],"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}
If the draft is not publication-ready, return "failed" instead of a weak draft.

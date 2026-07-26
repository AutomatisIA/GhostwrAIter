# linkedin-news-to-post

## Purpose

Transformer une actualite ou une observation externe en angle LinkedIn pertinent pour une audience PME.

## Inputs

- `source text`
- `target angle`
- `strategy bundle`

## Outputs

- synthese
- proposition de post

## Revision 2026-07-25

Ce prompt etait le plus pauvre des huit : six lignes utiles, aucune contrainte de
longueur, aucune consigne de registre, alors qu il rend exactement le meme
contrat `data.draft` que `linkedin-post-writer`. Il cumulait ce deficit avec un
contexte ampute cote service (une seule regle de voix sur dix, pilier code en
dur), corrige au meme moment. Voir docs/audit-2026-07-prompts.md section 6.

## Prompt

Turn the source into a LinkedIn post in French, with a strong SME-relevant angle.
No news summary without interpretation: the reader must learn what the news changes for an SME, not what the news says.
Do not produce generic meta-lines such as 'Mon angle PME'. Write the editorial interpretation directly as part of the post.
If the source is not specific or verifiable enough, fail instead of fabricating an angle.
Never invent a figure, a date, a company name or a consequence that is not present in the supplied source.

The voice rules in `context.voiceRules` are binding instructions. Read them before writing and treat them as the definition of the author's voice.
Use `context.strategyIcpSummary` to choose which audience this news actually concerns, and borrow the vocabulary it lists for that audience.
Use `context.strategyOffersSummary` and `context.pillarDescription` to decide which angle this author is legitimate to take.

Open with one sharp line that names what changes, not what was announced. No warm-up paragraph.
Prefer 120 to 220 words unless the source absolutely requires more.
The first two paragraphs must already contain a concrete consequence for an SME: a cost, an arbitrage, a risk, or a decision to take.
The final paragraph must land on a recommendation or an implication, never on a restatement of the news.

Structural constraints, which take precedence over any stylistic preference:
- Do not build a sentence on the opposition between what something is not and what it is, in any of its forms.
- Do not open a paragraph with a formula announcing that the real point is arriving.
- Do not group three items for rhythm.
- Do not stack more than two consecutive paragraphs of a single short sentence.
- Do not use dashes as separators.
- Never output meta-writing commentary about the post itself.

Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}
If the source is too weak, return {"status":"failed","summary":"...","error":{"code":"NEWS_SOURCE_TOO_WEAK","message":"..."}}.

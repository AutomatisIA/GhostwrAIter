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

## Revision 2026-07-25

Le bloc de cinq « references editoriales pour la justesse » a ete RETIRE. Trois de
ces cinq citations etaient elles-memes des parallelismes negatifs, c est-a-dire
exactement le marqueur d ecriture IA le plus present dans les sorties mesurees.
L une d elles, « Le vrai probleme avec l IA en PME n est presque jamais
technique », correspond mot pour mot a une ouverture que `docs/editorial-doctrine.md`
bannit et que le grader automatise sanctionne. Le prompt donnait donc en modele
une phrase que le meme depot interdit.

Le meme bloc etait duplique dans `linkedin-hook-engine/SKILL.md`, ce qui exposait
le modele deux fois au meme tic dans une seule chaine de generation.

Il est remplace par des contraintes structurelles, qui definissent une cible sans
citer aucune formule imitable.

**Emplacement a remplir par l auteur.** La section `### Exemples de reference`
ci-dessous attend un a deux posts reels, ecrits par l auteur, dont il est
satisfait. Un exemple positif est le levier le plus direct sur le registre, mais
il n a de valeur que s il vient de lui. Tant que la section est vide, elle
n a aucun effet.

Contrainte de format : ne jamais utiliser de titre `##` dans la section
`## Prompt`, `extractPromptBody` s y arreterait en silence. Les `###` sont surs.

## Prompt

Write a publication-ready LinkedIn post in French.
Do not expose internal labels such as structure names, scoring, rationale, or prompt mechanics inside the draft.
The voice rules in `context.voiceRules` are binding instructions. Read them before writing and treat them as the definition of the author's voice.
The post must sound like an expert practitioner speaking to SME decision-makers.
Litmus test: if it does not sound like something the person would genuinely publish, return failed and do not bluff.
Use short readable paragraphs, one central idea, at least one concrete operational point, and a discreet CTA only if justified.
Prefer 120 to 220 words unless the input absolutely requires more.
Open with one sharp line that can stop the scroll. No warm-up paragraph.
The headline (data.draft.headline) must be as sharp as the hook. It must name a specific situation, cost or decision. Reject vague headlines that could apply to any AI post. A good headline makes the reader think "this is about MY situation", not "this is about AI in general".
If the input compares two approaches, make the tradeoff explicit with control, cost, risk, ROI, adoption, or operational consequences.
Use the strategy context to sharpen the angle: `context.strategyIcpSummary` describes the target audiences, including the vocabulary that resonates with them and the formats they consume. Borrow that vocabulary. `context.strategyOffersSummary` and `context.pillarDescription` tell you which problems this author actually solves.
Never start the post by repeating the headline verbatim.
The first two paragraphs must already contain a concrete business consequence or operational cost.
The final paragraph must sharpen the recommendation, arbitrage, or implication for an SME decision-maker. No generic landing.

Structural constraints, which take precedence over any stylistic preference:
- Do not build a sentence on the opposition between what something is not and what it is. This includes every variant of that move, whether it denies a noun, a verb or a whole clause.
- Do not open a paragraph with a formula announcing that the real point is arriving.
- Do not group three items for rhythm when two or four carry the same meaning.
- Do not stack more than two consecutive paragraphs of a single short sentence.
- Do not use dashes as separators. Commas, colons and full stops only.
- Never output meta-writing commentary about the post itself or about the structure used.

Return `data.draft`, optionally `data.hooks`, and realistic `qualitySignals`.
Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"hooks":[{"family":"...","text":"...","score":0.0}],"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}
If the draft is not publication-ready, return "failed" instead of a weak draft.

### Exemples de reference

Aucun exemple fourni pour l instant. Coller ici un a deux posts reels de l auteur,
tels qu il les a publies, pour servir d ancre de registre.

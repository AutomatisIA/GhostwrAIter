# linkedin-repurpose

## Purpose

Transformer un draft existant en variante editoriale qui aborde le meme sujet de facon radicalement differente.

## Inputs

- `sourceHeadline`, `sourceBodyMarkdown` (the original post — provided as a counter-example)
- `sourceTypology`, `sourceObjective`, `sourceStructureKey`, `sourceStructureLabel`, `sourceHookText` (what was already used)
- `mode`: "divergent" means the variant must change structure, hook family, and angle
- `context.voiceRules` (full list of editorial rules)

## Outputs

- variante dans `data.draft`
- `data.variants[]` avec les variantes generees

## Prompt

You receive a LinkedIn post that performed well. Your job is to create a NEW post on the SAME subject that a reader of the original would NOT recognize as a rewrite.

HARD CONSTRAINTS — the variant MUST diverge on all three axes:
1. **Different narrative structure**: the source used `sourceStructureLabel`. Pick a different one from: Erreur -> consequence -> correction, Croyance -> terrain -> realite, Avant -> apres, Observation client -> lecon, Framework en 3 points, Opinion nuancee mais tranchee, Probleme -> solution -> preuve -> CTA, Constat terrain -> contre-intuition -> recommandation. NEVER reuse the source structure.
2. **Different hook family**: the source hook was provided in `sourceHookText`. Open with a fundamentally different type (if source was contrastive, use narrative or interrogative; if source was diagnostic, use direct or contrastive; etc.).
3. **Different angle of attack**: if the source approached the topic from the commercial angle, approach from the operational, financial, team adoption, or risk angle. If the source was about decision-makers, write for the team or the implementer.

The CORE IDEA must be preserved — the fundamental insight or argument that made the original post resonate. But everything around it changes: structure, hook, angle, examples, conclusion.

Apply all voice rules from context.voiceRules strictly. No corporate cliches, no generic phrasing, no filler.

Prefer 120 to 220 words. One central idea. Short paragraphs. Sharp conclusion specific to an SME decision-maker.

Do not reference the original post. Do not say "in a previous post" or "as I wrote before". The variant must stand alone.

Return the main variant in `data.draft` and list all generated variants in `data.variants`.
Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"variants":[{"variantType":"divergent","bodyMarkdown":"..."}],"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}

# linkedin-repurpose

## Purpose

Transformer un draft existant en variante reutilisable ou en format alternatif.

## Inputs

- `source draft`
- `target format`

## Outputs

- variante
- note de transformation

## Prompt

Create a real editorial variant, not a cosmetic rewrite.
Keep the same core idea but change the entry angle, pacing, or delivery logic.
The new angle must be obvious within the first two paragraphs.
Avoid generic transitions such as 'dans beaucoup de PME' or 'en realite' unless tied to a concrete decision or business contrast.
Do not reuse the original headline pattern or the same opening move.
Push the variant toward a genuinely different business lens, not just different wording.
Prefer a clearer angle such as economics, operational risk, decision-making, adoption friction, or hidden cost if the source supports it.
The first paragraph must signal the new editorial promise immediately, not after setup lines.
Do not append a label like 'Variante orientee angle complementaire'. The variant itself must embody the new angle.
Return the main variant in `data.draft` and list all generated variants in `data.variants`.
Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"variants":[{"variantType":"...","bodyMarkdown":"..."}],"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}

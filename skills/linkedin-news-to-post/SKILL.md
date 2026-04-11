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

## Prompt

Turn the source into a LinkedIn post with a strong SME-relevant angle.
No news summary without interpretation.
Do not produce generic meta-lines such as 'Mon angle PME'. Write the editorial interpretation directly as part of the post.
If the source is not specific or verifiable enough, fail instead of fabricating an angle.
Return this exact success shape: {"status":"succeeded","summary":"...","data":{"draft":{"headline":"...","bodyMarkdown":"..."},"qualitySignals":{"clarity":0.0,"specificity":0.0,"antiHypeAlignment":0.0}},"error":null}
If the source is too weak, return {"status":"failed","summary":"...","error":{"code":"NEWS_SOURCE_TOO_WEAK","message":"..."}}.

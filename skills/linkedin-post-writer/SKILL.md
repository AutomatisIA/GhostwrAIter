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

**Rempli le 2026-07-27.** La section `### Exemples de reference` porte deux posts
reels de l auteur, fournis par lui, reproduits sans retouche. Un exemple positif
est le levier le plus direct sur le registre, et il n a de valeur que s il vient
de lui : ni corriges, ni lisses, ni reformules.

Deux, pas cinq. Cette section entre dans le prompt a CHAQUE generation : elle
pese aujourd hui a elle seule plus que le reste du fichier. Ajouter un exemple
se paie sur toutes les generations, et trois exemples de plus n ancrent pas mieux
qu un contraste bien choisi entre deux registres.

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

Deux posts reels de l auteur, tels qu il les a publies. Ils sont l ancre de
registre : ecrire dans CE ton, avec CE rapport au lecteur. Ne jamais les citer,
les resumer, ni reprendre leurs tournures ; ce sont des reperes de voix, pas des
gabarits.

Ce qu ils ont en commun, et qui est la cible : une experience vecue plutot qu une
generalite, des faits verifiables (versions, durees, chiffres), la mention de ce
qui n a PAS marche, et un jugement assume sans survente. L auteur ne se presente
jamais comme celui qui sait, mais comme celui qui a essaye.

Premier exemple, registre du recit technique nuance :

Claude 4.7 bride ?!?!!!! Clairement, ça ne se voit pas du premier coup d'œil !!! Mais attention...

Hier j'ai passé la soirée sur Claude 4.7 et vraiment Anthropic a pris une avance qui doit faire transpirer ses compétiteurs.

J'ai refait des passes de sécurité sur mes serveurs et app et clairement, on voit un gap incroyable. Il m'a trouvé des points faibles et optimisations que ni 4.6 ni Codex ni Gemini n'avaient détectés.
Et ce, malgré le fait qu'Anthropic a(aurait) restreint les capacités de cyber-sécu du modèle (aussi contre-intuitif que cela puisse paraître, pour des questions de sécurité. Pour ne pas mettre un "détecteur de failles" trop puissant dans les mains de n'importe-qui !!!)

Mais tout n'est pas rose... J'ai aussi remonté un signalement à Anthropic pour deux actions où le modèle a outrepassé mes directives.
Il m'a coupé deux fois les accès SSH au serveur et m'a "fail2ban" pendant 1H alors qu'il avait interdiction de toucher à quoi que ce soit représentant un risque de coupure d'accès au serveur.

Heureusement mes directives l'avaient forcé à mettre en place une stratégie de "Deadman" qui a rollback ses actions en l'absence d'accès au serveur.

J'ai perdu 1H. Et en soi, ce n'est pas grave.

Mais le problème c'est que les deux fois il m'a dit qu'il l'avait fait car c'était plus rapide et efficace (ignorant ma directive "implémentation->test->suppression" sensée me garantir qu'il teste la nouvelle config avant de supprimer l'ancienne).

Il a pris les décisions que LUI a décidé de prendre. Et quand je lui ai demandé ce que j'aurais dû mettre en place pour l'empêcher de recommencer, il m'a répondu "Tu ne pouvais rien faire, tes directives étaient parfaitement claires et je l'ai quand même fait, c'est de ma faute". Inquiétant quand même.

Espérons qu'Anthropic réaligne le modèle afin de le rendre plus prévisible, car là pour moi c'est un problème.
Disons que c'est "une erreur de jeunesse" car à part ça, le modèle est notablement plus performant, et on le note instantanément !

Second exemple, registre de l analyse critique d une offre :

OpenAI propose maintenant un Abonnement pro comme Claude (Max)... OK, mais on a droit à quoi de plus exactement ?

Analysons leur offre :

- "Limite d'utilisation 5x plus élevée que dans le forfait Plus" OK, mais quelle était la limite dans le "Plus" ?

- "Accès maximal à Codex"...Et donc ? Ça veut dire quoi ???? On a droit à quoi pour ce prix ? Combien par session ? Combien par semaine ? la limite est évaluée en requêtes ? en Tokens ?

- "Chat de base illimité"... Ah bon, c'était limité ?

- "Utilisation maximum de la mémoire et du contexte"... Je suis perdu... on n'avait pas accès au million de token du context ? On m'aurai menti ????

- "Illimité sous réserve de respect des garde-fous." ?????? lequels ????? Ahhhh j'ai compris.... c'est illimité jusqu'a ce qu'ils nous limite... C'est beaucoup plus claire !!!!

Verdict honnête :

Exactement comme Anthropic, on paye pour un service sans avoir aucune idée de ce qu'il y a dedans. Récemment les développeurs qui utilisent Claude code ont vu leur capacités de développement chuter d'un coup sans aucune raison avec le même abonnement, on atteint les limites de sessions parfois 4 fois plus rapidement.

OpenAI nous propose la même chose... "Tu payes plus, on t'en donnera plus, mais ne nous demande pas quoi, c'est une surprise !"

Hier je suis allé au McDo, j'ai pris un Double-Cheese, mais comme les steaks valent chers il ne m'en ont mis qu'1, pas de salade non plus (Burger-king avait déjà tout acheté), par contre, pour le même prix, ils m'ont rajouté du ketchup !!!

Bienvenue dans le monde magique de l'inférence !!!

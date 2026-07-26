# Audit des prompts éditoriaux, 25 juillet 2026

Objet : la couche texte des neuf fichiers de prompt, complémentaire de
`audit-2026-07-editorial.md` qui traite la composition du prompt final assemblé.

Périmètre : `skills/_framework/PROMPT.md` et les huit `skills/linkedin-*/SKILL.md`. Ces
fichiers sont lus sur disque à l'exécution, donc modifiables sans recompilation.

---

## 1. État des neuf fichiers

Comptage fait à la main sur chaque fichier.

| Fichier | Lignes utiles | Lignes de négation | Exemple positif complet | Contrat |
|---|---|---|---|---|
| `_framework/PROMPT.md` | 23 | 7 | aucun | schéma JSON de haut niveau |
| `strategy-foundation` | 7 | 2 | aucun | artefacts markdown, sans exemple de rendu |
| `topic-generator` | 6 | 1 | aucun | exige un « sujet concret » sans en montrer un |
| `structure-selector` | 6 | 1 | liste positive fermée de 9 structures | le plus propre du lot |
| `hook-engine` | 12 | 6 lignes, environ 12 interdits | 5 citations de référence | contrat clair |
| `post-writer` | 24 | 10 lignes, environ 25 interdits | 5 citations + 1 contre-exemple | clair mais saturé de négations |
| `post-editor` | 30 | 6 | aucun | seul fichier en check-list diagnostique |
| `repurpose` | 17 | 3 | aucun | bon ratio, 3 contraintes dures numérotées |
| `news-to-post` | 6 | 1 | aucun | **le plus pauvre**, rend pourtant le même contrat que post-writer |

Un seul fichier sur neuf, `structure-selector`, présente un ratio favorable. C'est aussi
le seul qui remplace une partie de ses interdits par une liste positive fermée.

**Aucun des neuf fichiers ne contient un seul exemple de post complet réussi.**

---

## 2. Le préambule enseigne le tic, sur les huit skills, à chaque génération

C'est la trouvaille principale de cet audit, et elle élargit le diagnostic de
`audit-2026-07-editorial.md` section 5, qui n'incriminait que `post-writer`.

Le bloc « Quality doctrine » de `skills/_framework/PROMPT.md`, concaténé en tête de
**chaque** prompt de **chaque** skill, contient, vérifié mot pour mot :

```
- Exact voice over generic correctness.
- Concrete over abstract.
- Anti-hype, anti-corporate, anti-generic AI phrasing.
- Hooks must create tension, curiosity, or a sharp business contrast.
- Correction must be silent: return the corrected content, not an explanation of
  the correction process.
```

Ligne par ligne :

- « X over Y », deux fois : c'est le squelette du parallélisme négatif, placé à la
  position de plus haute autorité du prompt.
- « Anti-hype, anti-corporate, anti-generic » : trois négations consécutives, exactement
  le motif que le détecteur pondère à 3.
- « tension, curiosity, or a sharp business contrast » : règle de trois.
- « return the corrected content, **not** an explanation » : un « not X » textuel, sur la
  ligne qui clôt le préambule.

Le modèle voit donc ce registre contrastif en position dominante, sur les huit skills, à
chaque exécution. Le vecteur d'imitation est bien plus large que le seul bloc de
références de `post-writer`.

---

## 3. Le dépôt se contredit lui-même

`docs/editorial-doctrine.md` bannit explicitement l'ouverture **« Le vrai problème avec »**.
C'est cette liste que lit le grader automatisé.

`skills/linkedin-post-writer/SKILL.md:34` fournit comme référence de calibration :

> « Le vrai probleme avec l IA en PME n est presque jamais technique. »

Le prompt donne en modèle une phrase que la doctrine du même dépôt interdit. Deux des
quatre autres références sont de la même famille de parallélisme négatif.

Aggravant : **ce bloc de cinq citations est dupliqué à l'identique dans
`linkedin-hook-engine/SKILL.md:23`.** Dans une même chaîne de génération, hook-engine
produit l'accroche puis post-writer écrit le post : le modèle voit donc ces cinq tics
deux fois, à deux étapes différentes. L'exposition est doublée, pas neutralisée.

`hook-engine` porte en outre sa propre contradiction interne : sa ligne 24 bannit
« Le vrai probleme avec X » sauf ancrage concret, trois lignes après avoir donné cette
formule en référence.

---

## 4. Les listes bannies dérivent sans que rien ne le détecte

Trois graphies divergentes de la même famille, aucune ne correspondant exactement à la
doctrine :

| Source | Formulation |
|---|---|
| `docs/editorial-doctrine.md` | « On vend X comme l'étape d'après » |
| `post-writer/SKILL.md:37` | « On vend X comme l'etape d'apres » (accents perdus) |
| `hook-engine/SKILL.md:25` | « On vend X comme un raccourci » (formulation différente) |

**Le grader ne lit que `docs/editorial-doctrine.md`, jamais les SKILL.md.** Les listes
internes aux prompts ne sont donc ni vérifiées ni synchronisées avec ce que le bench
mesure. Elles peuvent dériver indéfiniment sans qu'aucun test ne le signale.

Autres divergences du même ordre :

- La liste des structures narratives vit à deux endroits : 9 entrées dans
  `structure-selector/SKILL.md:22`, 8 dans `repurpose/SKILL.md:24`. Rien n'indique si
  l'omission est voulue.
- La fourchette de mots existe en trois intensités : souple dans post-writer et
  repurpose, dure dans post-editor (« MUST bring it back within range »), **absente de
  news-to-post** qui rend pourtant le même contrat.
- `post-editor` ne couvre que 2 des 5 formules meta bannies par la doctrine. C'est
  pourtant la skill la plus exposée à laisser fuiter « Structure retenue », puisque sa
  propre check-list lui demande de vérifier si « the structure (structureLabel) is
  actually respected ».

---

## 5. Contradiction interne du préambule sur le statut « partial »

Trois lignes d'écart dans le même fichier :

```
Do not use "partial". If the contract cannot be fully satisfied, return "failed".

Required top-level JSON fields:
- "status" in ["succeeded","failed","partial"]
```

Le prompt interdit une valeur puis l'énumère comme autorisée. Coût de correction nul.
À trancher après vérification qu'aucun consommateur TypeScript n'attend encore ce statut.

---

## 6. news-to-post cumule les deux déficits

Cette porte d'entrée additionne un contexte pauvre (une seule règle de voix sur dix,
pilier codé en dur, ni offres ni ICPs, voir `audit-2026-07-editorial.md` section 8) et un
prompt pauvre (six lignes utiles, aucune liste de formules bannies, aucune fourchette de
mots, aucune consigne anti-style), alors qu'elle rend exactement le même contrat
`data.draft` que post-writer.

---

## 7. Pourquoi la stratégie par interdits ne peut pas suffire

Trois raisons observables dans ces fichiers, pas théoriques.

**Une négation ne désigne pas de cible.** Interdire une ouverture retire un point de
l'espace des sorties sans indiquer vers lequel aller. Le modèle, qui doit produire
quelque chose, retombe sur le motif générique le plus proche non cité. C'est exactement
ce qu'on observe : les deux tics relevés à la main dans les sorties de juillet et non
couverts par le détecteur sont des variantes voisines de motifs bannis.

**Interdire une formule oblige à l'écrire.** `post-writer` cite verbatim une dizaine de
formules bannies. Le modèle voit ces phrases dans son contexte d'entrée, qu'elles soient
présentées comme à éviter ou à suivre. La négation grammaticale est un signal faible
comparé à la présence lexicale de la phrase elle-même.

**Le seul fichier au ratio sain est celui qui procède par liste positive fermée.**
`structure-selector` ne dit pas quoi ne pas choisir, il énumère les neuf options
possibles.

Ce qu'apporterait l'approche inverse :

- une contrainte structurelle (« le post doit contenir un coût opérationnel ou une
  conséquence business dans les deux premiers paragraphes ») définit un espace-cible sans
  citer aucune formule, donc sans rien à imiter ;
- un exemple positif complet exploite la même mécanique d'imitation que celle qui pose
  problème aujourd'hui, mais dans le bon sens.

---

## 8. Un piège technique à connaître avant toute réécriture

`extractPromptBody()` dans `app/main/domains/execution/skill-prompt-loader.ts:59-81`
collecte les lignes après `## Prompt` et s'arrête (`break`) sur la première ligne
correspondant à `/^## /`.

Il ne lève une erreur que si le corps est **entièrement** vide après `trim()`. **Une
troncature partielle passe en silence, sans erreur ni journal.**

Conséquence pratique : si un exemple de post ajouté dans la section `## Prompt` contient
une ligne commençant par `## `, tout ce qui suit est exclu du prompt final sans que rien
ne le signale. Les sous-titres en `###` sont sûrs et déjà couverts par un test existant.

**Règle à appliquer à toute réécriture : n'utiliser que `###` ou moins à l'intérieur de
la section `## Prompt`.**

Par ailleurs, l'avertissement en tête de `_framework/PROMPT.md` (« le corps doit rester
identique au caractère près ») surestime la contrainte réelle. Vérification faite : les
chaînes de collage sont codées en dur dans `assembleSkillPrompt()`, pas dans le fichier,
et le test de parité stubbe le préambule avec un texte factice sans jamais vérifier le
contenu réel. Le seul contrat côté fichier est la présence exacte de la ligne
`## Prompt` et un corps non vide. Le texte est donc entièrement réécrivable.

---

## 9. La langue des prompts

Les neuf fichiers sont rédigés en anglais pour produire du français. Artefact concret,
pas seulement un principe : les citations françaises et les formules bannies y sont
recopiées en ASCII sans accents ni apostrophes (« n est pas », « l etape d apres »). Un
prompt dont l'objet est de garantir une écriture française juste contient lui-même du
français dégradé.

La traduction complète est cohérente avec la doctrine, mais elle touche neuf fichiers en
une passe et n'est vérifiable que par le bench. À classer en risque modéré, après les
changements isolables.

---

## 10. Les cinq modifications à plus fort effet

Classées par rapport effet sur risque.

| # | Modification | Effet | Risque | Recompilation |
|---|---|---|---|---|
| 1 | Remplacer les 5 références de `post-writer:34` par 1 ou 2 posts complets dans la voix cible | direct sur le tic mesuré | quasi nul, un seul fichier | non |
| 2 | Sortir la « Quality doctrine » du préambule de son registre contrastif | plus large (8 skills) | plus élevé, aucun déploiement progressif possible | non |
| 3 | Trancher la contradiction sur « partial » | fiabilité du contrat | nul | non |
| 4 | Remplacer les listes bannies recopiées par un renvoi à la doctrine | évite la dérive prompt / grader | faible | non |
| 5 | Déclarer dans le préambule que `context.voiceRules` prime en cas de conflit | incertain | nul | non |

**Ordre impératif : la modification 1 avant la 2.** Elles agissent sur le même défaut ;
les grouper rendrait impossible d'attribuer l'effet mesuré à l'une ou à l'autre.

Distinction à ne pas confondre dans le plan d'action : élever l'autorité déclarée des
règles de voix (modification 5) est un changement Markdown. Les **sortir physiquement**
du `JSON.stringify(invocation)` pour qu'elles apparaissent comme instruction demande de
modifier `assembleSkillPrompt()` ou les trois `buildRunnerContext()`. C'est du
TypeScript, avec recompilation, et cela sort du périmètre de cet audit.

---

## Note de méthode

Les affirmations les plus tranchantes de cet audit ont été revérifiées indépendamment
après rédaction : contenu exact du bloc « Quality doctrine », contradiction « partial » à
trois lignes d'écart, présence de « Le vrai problème avec » dans la liste bannie de la
doctrine, et comportement de `break` sur `/^## /` sans erreur en cas de troncature
partielle. Les quatre tiennent.

Aucun fichier de `skills/` n'a été modifié.

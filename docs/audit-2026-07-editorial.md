# Audit éditorial, 25 juillet 2026

Objet : pourquoi les sorties de GhostwrAIter ne sont pas jugées exploitables, et ce qui
est mesurable dans cette affirmation.

Méthode : lecture de la base réelle de l'utilisateur, capture du prompt réellement
assemblé lors d'une exécution, génération de quatre posts de bout en bout sur le build
actuel via Codex, et mesure déterministe des marqueurs d'écriture IA sur les deux
corpus.

---

## 1. Le fait qui reformule la question

**Toutes les générations que Philippe a jugées datent du 10 au 16 avril 2026.**

`SELECT created_at FROM execution_runs ORDER BY created_at DESC` ne contient aucune
exécution entre le 16 avril et le 25 juillet. Or dans l'intervalle :

| Date | Livraison | Effet sur la qualité éditoriale |
|---|---|---|
| 30 mai | Les 10 règles de voix sont saisies en base | Elles n'existaient pas pendant les tests d'avril |
| 30-31 mai | Feature 011 | Préambule de cadrage extrait dans `skills/_framework/PROMPT.md`, deux copies inline unifiées |
| 31 mai | Feature 012 | Correction de deux bugs de production révélés par l'eval |

Le verdict « je n'ai jamais obtenu de résultats exploitables » porte donc sur une version
du produit qui n'existe plus, générée avant toute injection de règles de voix.

Ce n'est pas une objection à la démarche. C'est un point de départ différent : le travail
à faire n'est pas de réparer une chaîne cassée, il est d'amener une chaîne qui fonctionne
au niveau de publication.

---

## 2. L'instrument de mesure

Un jugement de style ne se pilote pas au ressenti. J'ai construit un compteur
déterministe de marqueurs d'écriture IA, dérivé de la page Wikipedia
*Signs of AI writing*, restreint aux motifs détectables mécaniquement en prose française
de format LinkedIn.

Le script est à `scripts/audit-ai-tells.mjs`. C'est le seul fichier ajouté au dépôt par
cet audit, il est autonome et supprimable sans effet sur l'application.

```bash
node scripts/audit-ai-tells.mjs --db "$HOME/Library/Application Support/ghostwraiter/workspace/data/ghostwraiter.db"
node scripts/audit-ai-tells.mjs --file un-post.txt
```

Vingt détecteurs, répartis en huit catégories, chacun pondéré de 1 à 3 selon la force de
la signature. Le score rendu est une densité : points pondérés pour 100 mots, ce qui
rend comparables des posts de longueurs différentes.

Les catégories les plus lourdes, celles qui pèsent 3 :

- parallélisme négatif, sous cinq variantes (« ce n'est pas X, c'est Y », « le problème
  n'est pas », « il ne s'agit pas de », « non seulement, mais aussi », « ne … plus
  seulement X, mais Y »)
- pivot dramatique « c'est là que »
- triplet de négations consécutives
- commentaire méta sur l'écriture

### Limite à connaître avant d'utiliser ces chiffres

**L'instrument sous-compte, d'une marge inconnue.** Deux exemples relevés à la main dans
les sorties analysées et non détectés :

- « pas dans la mémorisation de commandes techniques, mais dans la capacité à découper un
  travail » (variante de parallélisme négatif non couverte par les expressions régulières)
- « découper un travail, poser des limites et contrôler le résultat » (règle de trois
  dont la forme ne correspond pas au motif simple mot-virgule-mot-et-mot)

Conséquence pratique : ces densités sont **directionnelles**. Elles servent à comparer
deux corpus produits par la même chaîne de mesure. Elles ne peuvent pas servir de seuil
de validation tant que le détecteur n'a pas été calibré contre un corpus annoté à la
main.

---

## 3. Ce que mesure la comparaison des deux corpus

Corpus filtré aux brouillons de plus de 400 caractères, ce qui exclut les souches et les
variantes tronquées. Même détecteur appliqué aux deux périodes.

| Période | n | Densité de marqueurs | Score auto-déclaré moyen |
|---|---|---|---|
| Avril 2026 (build jugé par Philippe) | 11 | **5,41** | 84 % |
| Juillet 2026 (build actuel) | 8 | **1,98** | 82 % |

Détail par post disponible en relançant le script.

### Ce que ce tableau autorise à dire

La chaîne actuelle produit environ trois fois moins de marqueurs d'écriture IA que celle
qu'a testée Philippe. C'est cohérent avec le contenu des livraisons de fin mai.

### Ce qu'il n'autorise pas à dire

- **n = 19 au total, un seul opérateur, un seul moteur.** Ce n'est pas un échantillon.
- **Les deux corpus se recouvrent partiellement par sujet** : quatre posts « devis » en
  avril, quatre en juillet. Le contrôle par sujet est accidentel, pas construit.
- L'instrument sous-compte des deux côtés, mais rien ne garantit qu'il sous-compte de
  façon égale.

À traiter comme une indication forte à confirmer, pas comme une mesure publiable.

---

## 4. Le défaut principal, mesuré

J'ai capturé le prompt réellement assemblé lors d'une exécution
(`workspace/logs/executions/2026-07-25T15-43-49-404Z__run_1784994207273_8f1a4b.json`).

`assembleSkillPrompt()` dans `app/main/domains/execution/skill-prompt-loader.ts:147`
concatène le préambule de cadrage, les instructions de la skill, puis
`JSON.stringify(invocation, null, 2)`.

Composition réelle d'un prompt de génération :

| Bloc | Caractères | Part du prompt |
|---|---|---|
| `foundationSummary` | 8 676 | 30 % |
| `strategyExpertiseSummary` | 7 049 | 24 % |
| `voiceRules` (les 10 règles) | 1 959 | 7 % |
| `strategyIcpSummary` | 1 262 | 4 % |
| `strategyOffersSummary` | 1 120 | 4 % |
| `strategyBio` | 1 591 | 5 % |
| Instructions (préambule + skill) | 5 404 | 19 % |
| Divers contexte | 590 | 2 % |
| **`payload` : le sujet du post** | **459** | **1,6 %** |

Total du prompt : environ 29 000 caractères, de l'ordre de 8 000 tokens.

**Le sujet à traiter pèse 1,6 % du prompt. La description de l'auteur en pèse 63 %.**

Deux conséquences directes :

1. **Le modèle est saturé de contexte identitaire et affamé de matière concrète.** Un post
   générique n'est pas surprenant quand l'entrée est à 63 % une description de qui écrit
   et à 1,6 % de quoi il parle.
2. **Les contraintes anti-style pèsent 7 % et sont enfouies dans un objet JSON en fin de
   prompt.** Ce sont pourtant elles qui doivent gouverner la forme. Elles sont traitées
   comme de la donnée, pas comme de l'instruction.

Sous-constat : `foundationSummary` (8 676 caractères) et `strategyExpertiseSummary`
(7 049 caractères) décrivent la même personne et se recouvrent largement. Voir l'audit
conceptuel pour l'origine de cette duplication.

---

## 5. Le prompt enseigne le tic qu'il interdit

`skills/linkedin-post-writer/SKILL.md` bannit explicitement une liste d'ouvertures, puis
fournit cinq « références éditoriales pour la justesse », dont :

- « Le vrai problème avec l'IA en PME n'est presque jamais technique. »
- « On parle beaucoup de prompts. Pas assez de process. »
- « Une PME n'a pas besoin de 20 cas d'usage IA. Elle a besoin des 3 bons. »

**Ces trois références sont elles-mêmes des parallélismes négatifs**, exactement le motif
qui domine les sorties mesurées. Le prompt donne le tic en cible de calibration, puis
interdit des tournures voisines ailleurs dans le même fichier.

Constat de forme lié : le fichier aligne environ vingt-cinq contraintes négatives
(« Never », « Avoid », « Reject », « Do not ») pour un seul exemple positif, et aucun
exemple de post complet réussi. Une liste d'interdits déplace le modèle vers le motif
générique suivant, elle ne l'amène pas vers un bon motif.

**Hypothèse à tester, non testée à ce jour :** remplacer les cinq références par un ou
deux posts complets écrits dans la voix cible, sans aucun parallélisme négatif, puis
mesurer à nouveau. `SkillPromptLoader` lit les fichiers sur disque à l'exécution, donc ce
test ne demande aucune recompilation. C'est le test le moins cher du lot, il doit être
fait en premier.

---

## 6. Le chiffre affiché à l'utilisateur ne mesure rien

`drafts.quality_score` provient du champ `qualitySignals` que le modèle remplit lui-même
dans sa réponse JSON. C'est une auto-évaluation, pas une mesure.

Il est affiché tel quel :

- Cockpit, sur chaque carte de brouillon : « Qualité : 83 % »
- Bibliothèque, en indicateur de tête : « QUALITÉ MOYENNE 83 % »

Preuve que cet indicateur est aveugle : entre les deux corpus, la densité de marqueurs a
baissé de 5,41 à 1,98, et le score auto-déclaré est passé de 84 % à 82 %. Il a bougé de
deux points dans le mauvais sens pendant que le défaut réel se divisait par près de trois.

Preuve plus nette encore, tirée des journaux d'avril : une exécution a renvoyé
`status: succeeded` avec `clarity: 0.82`, `specificity: 0.79`, `antiHypeAlignment: 0.93`
sur un texte dont la `headline` était vide.

Un produit dont la première règle éditoriale est « zéro chiffre inventé, jamais » affiche
en permanence un chiffre inventé. C'est le défaut le plus facile à corriger et le plus
coûteux à laisser.

---

## 7. Trois enregistrements pollués dans la bibliothèque

Trois brouillons de la base contiennent du texte de gabarit, identique au caractère près
entre eux, sans accents, et reprenant mot pour mot les formules que le prompt interdit :

```
Structure retenue : Croyance -> terrain -> realite.
Ce post part d'un constat terrain en PME : le blocage vient souvent du process...
On gagne plus vite avec un cadre simple, un cas d'usage priorise et un pilote concret.
Version revue : plus concret, plus net, plus utile pour un decideur PME.
```

Enregistrements concernés : `draft_1775840103361_115205` (score 0,61),
`draft_1775840044527_abc260` (0,84), `draft_1775864825913_08c576` (0,89).

**Origine non résolue.** Ce texte correspond exactement à celui produit par le double de
test `tests/unit/helpers/fake-codex.ts:170`. J'ai vérifié que les tests unitaires
utilisent `:memory:` ou un répertoire temporaire, et que `fake-codex` n'a aucun appelant
hors des tests. Le double de test n'a donc pas écrit dans la base réelle. Les chemins de
journaux de ces exécutions pointent vers `linkedin-poster/workspace`, c'est-à-dire avant
le renommage d'avril : la piste la plus probable est un chemin de repli présent à
l'époque et retiré depuis, mais je ne peux pas l'affirmer.

**Ce qui reste vrai quelle qu'en soit l'origine :** l'application a enregistré ces sorties
avec `status: succeeded` et un score fabriqué, et elle les présente aujourd'hui dans la
bibliothèque, notées 84 % et 89 %, sans aucun moyen pour l'utilisateur de les distinguer
d'une vraie génération. Une partie de ce que Philippe a jugé « non exploitable » n'était
pas une sortie de modèle.

---

## 8. Le parcours « veille » tourne sur un contexte dégradé

`app/main/domains/news/news-to-post.service.ts:157-184` construit son contexte
différemment des deux autres services :

| Élément | workshop | library | news-to-post |
|---|---|---|---|
| Règles de voix | les 10 | les 10 | **1 seule** (`find` sur le premier `anti_style`) |
| Pilier | celui de l'idée | celui de l'idée | **codé en dur `"Veille"`** |
| Offres, ICPs, bio, expertise | oui | oui | **absents** |

L'une des trois portes d'entrée de l'écran « Créer » produit donc structurellement des
posts moins alignés que les deux autres, sans que rien ne le signale.

À noter pour l'audit code : `workshop.service.ts` et `library.service.ts` contiennent la
même méthode `buildRunnerContext()` dupliquée à l'identique sur une trentaine de lignes.

---

## 9. Le journal n'enregistre pas le prompt

`workspace/logs/executions/*.json` contient l'objet `invocation`, pas la chaîne
réellement envoyée au CLI. Pour un produit dont toute la valeur tient à la qualité du
prompt, c'est le seul artefact qui permettrait de diagnostiquer une régression, et il
n'est pas conservé. J'ai dû reconstituer la composition de la section 4 en recoupant
`assembleSkillPrompt()` avec les tailles de l'invocation.

---

## 10. Ce que cet audit n'a pas couvert

- **`npm run eval:editorial` n'a pas été relancé.** La dernière référence connue est
  8/12 au 31 mai. Le protocole impose un premier plan et interdit `npm run test` entre le
  build et l'eval ; je l'ai laissé de côté pour ne pas casser l'environnement natif
  pendant les générations. À faire avant toute itération sur les prompts.
- **Un seul moteur testé** (Codex). Claude et Gemini sont détectés et authentifiés sur le
  poste, jamais comparés à sujet égal.
- **Le test de la section 5** (remplacer les références par des exemples positifs) n'a pas
  été exécuté.
- Les skills `topic-generator`, `repurpose` et `post-editor` n'ont pas été exercées dans
  cette passe.

---

## 10 bis. Mesure après révision des prompts, 25 juillet 2026

Les sections 4, 5 et 8 ont été traitées le jour même. Quatre générations ont été relancées
sur les mêmes idées et les mêmes paramètres, avec le même détecteur.

| | avant révision | après révision |
|---|---|---|
| Post 1 | 4,19 | 2,81 |
| Post 2 | 0,94 | 0,00 |
| Post 3 | 0,98 | 1,72 |
| Post 4 | non généré | 0,00 |
| **Moyenne** | **2,04** | **1,13** |

### Ce que cette mesure ne vaut pas

**n = 3 avant, n = 4 après.** Ce n'est pas un échantillon, c'est une indication.

**Effet plafond côté « avant » :** deux des trois posts de référence étaient déjà à 0,94
et 0,98, c'est-à-dire proches du plancher du détecteur. La marge de progression mesurable
était donc concentrée sur un seul post.

**Un post a régressé** (0,98 vers 1,72). Sur trois comparaisons appariées, une va dans le
mauvais sens. Avec un échantillon de cette taille, cela suffit à interdire toute
conclusion ferme.

**Une génération a d'abord échoué** par refus de skill, sur une idée qui avait produit un
post lors du passage précédent. Le message était explicite : matière source jugée
insuffisamment vérifiable. Relancée à l'identique, elle a réussi et produit un post à
0,00. Le refus relevait donc de la variance du modèle sur une entrée mince, pas d'un
seuil déplacé par les nouvelles contraintes. Vérifié, pas supposé.

**Le détecteur a été corrigé en cours de mesure** : il ne reconnaissait pas les pivots à
adverbe intercalé (« c'est souvent là que »). Les deux corpus ci-dessus sont mesurés avec
la version corrigée. Une première mesure, faite avec la version fautive, annonçait à tort
une baisse de moitié.

### Ce qu'elle autorise à dire

La direction est bonne et cohérente avec les changements appliqués. Il faudrait une
vingtaine de générations, réparties sur plusieurs piliers et plusieurs typologies, pour
transformer cette indication en résultat.

---

## 11. Ordre de traitement recommandé

1. **Rééquilibrer la composition du prompt** (section 4). C'est le levier mesuré, et de
   loin le plus lourd. Sortir les règles de voix du JSON pour en faire des instructions,
   réduire ou fusionner les deux blocs de description d'auteur, donner du poids au sujet.
2. **Retirer ou remplacer le score auto-déclaré** (section 6). Coût faible, incohérence
   doctrinale forte.
3. **Tester le remplacement des références du post-writer** (section 5). Coût quasi nul,
   pas de recompilation.
4. **Aligner le contexte de news-to-post** sur les deux autres (section 8).
5. **Journaliser le prompt assemblé** (section 9), condition de tout diagnostic ultérieur.
6. Signaler ou purger les trois enregistrements pollués (section 7).

---

## Annexe : traçabilité des mesures

- Base auditée : `~/Library/Application Support/ghostwraiter/workspace/data/ghostwraiter.db`
- Sauvegarde prise avant toute écriture : `ghostwraiter.db.bak-20260725-173152`
- Quatre générations de test ont été écrites dans cette base pendant l'audit. Le nombre
  de brouillons est passé de 15 à 23. Ces enregistrements sont identifiables par leur
  date du 25 juillet 2026 et peuvent être supprimés sans effet.
- Captures d'écran du build : `/tmp/ghost-audit/`
- Journaux d'exécution des générations de test :
  `~/Library/Application Support/ghostwraiter/workspace/logs/executions/2026-07-25T15-*`

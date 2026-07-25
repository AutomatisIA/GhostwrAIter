# Audit fonctionnel, 25 juillet 2026

> **Section 1 corrigée le 25 juillet 2026.** Le routage du moteur a été réparé dans la
> foulée de cet audit. Voir « État du correctif » en fin de section 1. Les sections 2 à
> 10 décrivent l'état non corrigé.

Objet : ce qui est cassé, ce qui est incohérent, ce qui manque, pour quelqu'un qui publie
réellement sur LinkedIn.

Méthode : traçage des chaînes UI vers preload vers IPC vers service vers runner, grep du
symbole exact avant toute affirmation d'absence, et recoupement systématique avec les
données réelles de la base de l'utilisateur.

---

## 1. Le réglage du moteur IA ne règle rien pour six skills sur huit

**C'est le défaut fonctionnel le plus important de cet audit.**

`SkillRunnerService` expose deux voies :

- `executeAsync()` interroge `EngineRegistry`, donc respecte le moteur choisi dans les
  Réglages ;
- `execute()`, synchrone, appelle `this.codexCliRunner` sans aucune condition. Vérifié :
  la méthode teste `this.codexCliRunner?.isAvailable()` puis appelle
  `this.codexCliRunner.execute(invocation)`. Codex, toujours.

Recensement des appelants dans tout `app/main` :

| Voie | Appelants | Skills concernées |
|---|---|---|
| `executeAsync()` | `strategy-ipc.ts:47`, `ideas-ipc.ts:69` | strategy-foundation, topic-generator |
| `execute()` | `workshop.service.ts:836`, `library.service.ts:102`, `library.service.ts:257`, `news-to-post.service.ts:53` | structure-selector, hook-engine, post-writer, post-editor, repurpose, news-to-post |

**Tout l'atelier de rédaction est sur la voie synchrone, donc toujours sur Codex.**

Preuve sur les données réelles de l'utilisateur :

```
app_settings.active_engine = gemini

execution_runs par skill :
  linkedin-hook-engine        21
  linkedin-structure-selector 19
  linkedin-post-writer        18
  linkedin-post-editor         8
  linkedin-repurpose           3
  linkedin-news-to-post        2
```

Les six skills présentes sont exactement les six de la voie synchrone. Zéro exécution
pour les deux autres.

Pendant ce temps, `EnginePanel.tsx` affiche Gemini « Actif » et « Connecté », et invite à
« sélectionner votre moteur ci-dessous ».

Conséquence pratique : si Codex n'est pas installé ou pas authentifié alors que Gemini
l'est, tout l'atelier échoue, avec un panneau de Réglages entièrement vert.

### Ce que la valeur stockée révèle du défaut

L'utilisateur déclare avoir choisi Codex. La base stocke `gemini`. Cette valeur est
antérieure à l'audit, vérifié sur la sauvegarde prise avant toute écriture.

Traçage de l'écriture : `setActiveEngine` n'est appelé qu'en `EnginePanel.tsx:159`, sur
clic explicite du bouton « Sélectionner ». `getActiveEngine()` ne persiste rien, il lit
seulement, y compris dans sa branche de repli. **Aucun chemin d'écriture automatique
n'existe dans le code.** L'origine du `gemini` stocké n'est donc pas déterminée par cet
audit, et rien ne permet d'accuser un écrasement silencieux.

Le point important est ailleurs. L'utilisateur croit travailler sur Codex, la base dit
Gemini, et il a **effectivement** travaillé sur Codex, parce que l'atelier ignore le
réglage. Sa perception est juste, le réglage est faux, et les deux coexistent sans que
rien ne le signale. C'est la démonstration directe que ce contrôle est décoratif pour six
skills sur huit : sa valeur n'a aucun effet observable sur le parcours principal.

### La conséquence non triviale

Les deux seules skills qui respectent le réglage sont `strategy-foundation` et
`topic-generator`. Ce sont aussi les deux seules qui ne persistent aucun run (section 3).

Donc le socle éditorial de 8 406 caractères, qui pèse 30 % de chaque prompt de génération
(voir `audit-2026-07-editorial.md` section 4), a été produit par le moteur stocké, soit
Gemini, alors que l'utilisateur pensait travailler avec Codex. Et il n'existe aucune
trace permettant de le confirmer ou de l'infirmer, puisque ces deux skills n'écrivent
jamais dans `execution_runs`.

L'élément de contexte le plus lourd de toute la chaîne a probablement été produit par un
moteur que l'utilisateur n'a pas cru choisir, et c'est invérifiable.

### État du correctif, 25 juillet 2026

Corrigé le jour même, sur décision de l'utilisateur : le choix du moteur est désormais
**contraignant**, et l'exécution est tracée.

Ce qui a changé :

1. **Les six skills de la voie synchrone passent par `executeAsync`.** Les trois services
   (`workshop`, `library`, `news-to-post`) et leurs méthodes publiques sont devenus
   asynchrones. La couche IPC supportait déjà l'attente, aucun contrat n'a changé.
2. **Deux couches de repli silencieux supprimées.** `executeAsync` ne retombe plus sur
   Codex quand le moteur retenu n'est pas authentifié, et `getActiveEngine()` ne
   substitue plus le premier moteur authentifié à un choix explicite. Un choix
   utilisateur est honoré ou l'exécution échoue en le nommant.
3. **Le message d'échec atteint l'utilisateur.** Une classe `SkillRunError` porte le code
   dans `name`, et les codes moteur sont enregistrés via `registerKnownErrorCode`. Le
   message n'est plus écrasé en « Une erreur interne s'est produite côté application ».
4. **Colonne `engine` dans `execution_runs`**, renseignée à chaque exécution **qui
   enregistre un run**, c'est-à-dire les six skills de l'atelier. Voir la limite
   ci-dessous.
5. **Les événements de progression n'annoncent plus « codex » en dur.** L'étiquette de
   départ vient du choix enregistré, la borne terminale du moteur réellement utilisé.

**Bug révélé par le correctif :** Claude et Gemini n'avaient jamais pu fonctionner. Ces
CLI encadrent la réponse du modèle dans leur propre enveloppe JSON
(`claude --print --output-format json` place le contrat dans `result`, `gemini --json`
dans `response`), et le runner faisait un `JSON.parse` direct sur l'enveloppe. Le contrat
paraissait donc toujours invalide. Un extracteur partagé
(`app/main/domains/execution/extract-skill-payload.ts`, 7 tests) déballe l'enveloppe et
retire au passage les délimiteurs markdown.

**Vérifié en conditions réelles** sur le workspace de l'utilisateur :

| Cas | Résultat |
|---|---|
| Claude sélectionné et authentifié | génération réussie en 43 s, 3 structures produites, ligne `execution_runs` portant `engine = claude` |
| Gemini sélectionné, non connecté | échec immédiat : « Gemini CLI est votre moteur IA sélectionné, mais il n'est pas connecté. Lancez `gemini login` puis réessayez, ou choisissez un autre moteur dans les Paramètres. » Aucun repli sur Codex |

**Correction également apportée :** `gemini-engine.ts:48` et `README.md:57` annonçaient
`@anthropic-ai/gemini-cli`, qui n'existe pas. Corrigé en `@google/gemini-cli`. Sans cela,
le message d'échec « Lancez `gemini login` » aurait envoyé l'utilisateur vers un moteur
qu'il ne pouvait pas installer, la commande affichée dans les Paramètres étant en 404.

Portes de qualité : typecheck 0, lint 0, 487 tests verts (contre 478 avant, 9 ajoutés).

### Limite connue du correctif

**La traçabilité couvre six skills sur huit.** `strategy-foundation` et
`topic-generator`, précisément les deux qui respectaient déjà le moteur choisi,
n'appellent ni `recordExecutionRun` ni `insertExecutionRun` (vérifié : aucune occurrence
dans `strategy-ipc.ts` ni `ideas-ipc.ts`). Elles n'écrivent donc aucune ligne, et la
colonne `engine` ne peut rien dire d'elles.

Conséquence directe : la question qui a motivé cette colonne, « quel moteur a produit le
socle éditorial de 8 406 caractères », **reste sans réponse** pour les générations
passées comme futures.

Ce n'est pas un oubli du correctif, c'est un défaut préexistant distinct (section 3). Le
combler demande de trancher un point de conception : `execution_runs` déclare
`idea_id` et `draft_id` en `NOT NULL`, or une génération de socle éditorial n'a ni idée
ni brouillon. Il faut soit des valeurs sentinelles, soit un assouplissement du schéma.
À traiter comme un chantier séparé.

---

## 2. Le message d'erreur utile est du code mort

`useWorkshopFlow.ts:15-25` définit `KNOWN_ERROR_MESSAGES`, qui traduit cinq codes en
français actionnable, dont :

> `CODEX_CLI_FAILED` : « Codex CLI n'a pas pu démarrer. Vérifie qu'il est installé et
> authentifié (`codex login`). »

**Ce message ne peut jamais s'afficher.**

Mécanisme : chaque service échoue par
`throw new Error(result.error?.message ?? result.summary)` (`workshop.service.ts:299`,
`349`, `413`, `674`, `library.service.ts:105`, `260`, `news-to-post.service.ts:63`), ce
qui produit une erreur dont le `name` vaut `"Error"`. Côté IPC, `classifyThrown`
(`register-validated-handler.ts:129-147`) ne préserve un code typé que si `err.name`
figure dans `knownErrorCodeMap`. Or `registerKnownErrorCode` n'est appelé que deux fois
dans tout le projet, dans `execution-ipc.ts:13-14`, pour des codes sans rapport avec les
skills.

Tout échec de l'atelier retombe donc sur `IPC_HANDLER_ERROR`, écrasé en un message
unique : **« Une erreur interne s'est produite côté application. »**

Codex absent, non authentifié, en délai dépassé, ou renvoyant du JSON invalide :
l'utilisateur voit exactement le même bandeau, et n'apprend jamais qu'il doit taper
`codex login`.

Incohérence supplémentaire : sur l'écran Créer, `describeError`
(`IdeaSelector.tsx:36-39`) fait l'inverse et concatène le message technique brut en
anglais entre parenthèses. La même famille d'erreurs s'affiche donc masquée sur l'atelier
et exposée en anglais technique sur Créer. Aucune des deux n'est actionnable.

---

## 3. L'historique des générations ne peut pas montrer un échec

`recordExecutionRun` n'est appelé qu'**après** le contrôle
`if (result.status !== "succeeded") throw`, dans les six méthodes synchrones.

Confirmé sur la base réelle : **71 exécutions, statut `succeeded` pour les 71.** Aucune
ligne en échec, jamais.

La branche « Détail technique » et le bouton « Ouvrir le journal » de
`DiagnosticsPanel.tsx:101-124` sont fonctionnels mais ne se déclencheront jamais avec ce
pipeline.

Symétriquement, `strategy-foundation` et `topic-generator` ne persistent **aucun** run,
même en cas de succès : ni `strategy-ipc.ts` ni `ideas-ipc.ts` n'appellent
`recordExecutionRun`. Preuve la plus nette : `app_settings.foundation_summary` contient
un socle réellement généré, qu'aucune des 71 lignes ne référence.

L'écran censé aider à diagnostiquer un problème est donc structurellement aveugle aux
problèmes.

---

## 4. Cinq fonctions exposées à l'interface ne sont jamais appelées

Les 35 méthodes de `app/preload/index.ts` ont été vérifiées une à une par grep sur
`app/renderer/src` hors tests. Cinq sont à zéro appel.

| Méthode | Implémentation | Constat |
|---|---|---|
| `workshop.createVariant` | `workshop.service.ts:459-537` | doublon mort de `library.createDivergentVariant` |
| `library.createVariantFromDraft` | `library.service.ts:57-170` | deuxième implémentation morte du même besoin, score codé en dur à 0.84 ligne 117 |
| `workshop.createDraftFromContent` | `workshop.service.ts:546-627` | utilisée seulement par les scripts d'évaluation, jamais par l'app |
| `workshop.generateFromIdea` | `workshop.service.ts:248-273` | voir ci-dessous |
| `execution.getDiagnostics` | `execution.service.ts:89-107` | voir ci-dessous |

Deux méritent un mot.

**`workshop.generateFromIdea`** est un raccourci composite complet, « idée vers structure
vers accroche vers brouillon » en un seul appel, entièrement câblé côté backend. Aucun
bouton ne l'appelle. L'utilisateur est contraint au parcours manuel pas à pas alors que
la voie rapide existe déjà dans le code. C'est d'ailleurs cette méthode que j'ai utilisée
pour les générations de test de l'audit éditorial : elle fonctionne.

**`execution.getDiagnostics`** retourne le message le plus honnête de toute
l'application (« Moteur IA disponible et actif » ou « Aucun moteur IA disponible ») plus
la liste des huit skills installées. `DiagnosticsPanel.tsx` n'appelle que `listRuns` et
`openRunLog`. Ce diagnostic global n'est jamais affiché, alors qu'il répondrait
exactement au problème de la section 2.

Trois implémentations existent donc pour le besoin « repurpose », dont deux mortes.

---

## 5. Les huit skills sont atteignables

Contrairement à ce que laissait craindre l'audit de mai, aucune skill n'est orpheline.
Chaîne vérifiée pour chacune :

| Skill | Déclencheur |
|---|---|
| strategy-foundation | Stratégie, onglet Socle, « Générer le socle éditorial » (`StrategyScreen.tsx:220`) |
| topic-generator | Créer, « Générer des sujets depuis la stratégie » (`IdeaSelector.tsx:152`) |
| structure-selector | Atelier étape 2 (`useWorkshopFlow.ts:204`) |
| hook-engine | Atelier étape 3 (`useWorkshopFlow.ts:227`) |
| post-writer | Atelier étape 4 (`useWorkshopFlow.ts:250`) |
| post-editor | « Lancer la correction premium » (`DraftPanel.tsx:146`) |
| repurpose | Bibliothèque, « Variante divergente » (`LibraryScreen.tsx:168`) |
| news-to-post | Créer, formulaire veille (`IdeaSelector.tsx:134`) |

---

## 6. Le badge « Stratégie : Prête » du Cockpit est trop permissif

`CockpitScreen.tsx:101-106` calcule `strategyReady` par un simple OU sur quatre tableaux
(offres, ICPs, piliers, règles de voix). **Un seul pilier créé, même avec un libellé
vide, suffit** à afficher le badge vert et à pousser l'utilisateur vers « Créer votre
première idée ».

Or `workshop.service.ts:883-885` exige `voiceRules.length > 0` et lève une erreur sinon.

Combiné à la section 2, c'est le scénario le plus plausible d'un utilisateur qui suit son
tableau de bord, le voit vert, et se heurte à un échec sans explication.

À distinguer de l'indicateur de complétude de l'écran Stratégie et de la coche du Socle
éditorial, qui sont eux honnêtes (vérifié sur workspace vierge).

---

## 7. Le score de qualité recouvre trois formules incomparables

Au-delà du fait qu'il est auto-déclaré (audit éditorial, section 6), la même colonne
`drafts.quality_score` est calculée de trois façons selon le chemin emprunté :

| Chemin | Formule |
|---|---|
| post-writer, post-editor | mélange pondéré signal plus heuristique (`workshop.service.ts:989-1055`) |
| repurpose | moyenne simple des 3 signaux auto-déclarés (`library.service.ts:265-270`) |
| news-to-post | **un seul signal isolé**, `clarity` (`news-to-post.service.ts:82,101,128`) |

Ces trois grandeurs sont affichées partout sous le même libellé « Qualité : X % », et
agrégées en une « qualité moyenne » unique en Bibliothèque.

---

## 8. La correction premium peut ne rien changer et annoncer un succès

`workshop.service.ts:687-690` : si le score recalculé n'excède pas le score courant, le
texte d'origine est conservé, mais une ligne `draft_versions` est quand même insérée, et
`useWorkshopFlow.ts:279` affiche « Draft corrigé. » sans distinction.

Mesuré sur la base réelle : sur 8 versions de raison « correction », **3 ont un corps
strictement identique à la version précédente**. Soit 37 % des corrections réelles qui
n'ont rien changé tout en étant présentées comme réussies.

---

## 9. Trois niveaux de validation pour le même concept

Le « contexte de génération » est validé différemment selon le service :

| Service | Exigence |
|---|---|
| workshop | `voiceRules` non vide |
| news-to-post | une règle de type `anti_style` spécifiquement |
| library | seulement `profile.id`, aucune contrainte de voix |

Un même utilisateur peut donc réussir en Bibliothèque et échouer en atelier avec la même
stratégie, sans que rien ne l'explique.

---

## 10. Ce qui manque à quelqu'un qui publie

Chaque absence vérifiée par grep ciblé avant d'être affirmée.

| Manque | Vérification |
|---|---|
| Compteur de caractères LinkedIn | grep `caractèr\|character\|charCount\|maxLength\|3000` : zéro résultat |
| Aperçu du rendu réel et de la coupure « voir plus » | grep `voir plus\|see more\|troncat` : zéro résultat. Texte affiché brut (`DraftPanel.tsx:209`) |
| Images et carrousels | aucun champ image, media ou carousel dans les types ni dans le schéma SQLite. Produit strictement texte |
| Publication automatisée | grep `api.linkedin.com\|w_member_social\|ugcPosts\|/v2/shares` : zéro résultat. Seul mécanisme : `navigator.clipboard.writeText` puis un clic manuel « Copier et marquer publié » qui bascule un statut local sans vérifier quoi que ce soit |
| Suivi de performance des posts | grep `performance\|engagement\|impression\|vues\|likes` : uniquement du texte d'interface |
| Rappel de publication planifiée | grep `new Notification` : zéro résultat. Un post planifié ne déclenche aucune alerte. Une seule ligne dans `calendar_items` en base réelle |

**Présent mais invisible :** un historique de versions par brouillon existe réellement
(`draft_versions`, 34 lignes en base, champ `versions` du contrat `WorkshopSession`,
`workshop.service.ts:788-800`), mais n'est affiché nulle part. Grep `\.versions\b` sur
`app/renderer/src` : zéro résultat hors types. L'utilisateur ne peut ni revenir à une
version précédente, ni voir ce qu'une correction a changé, ce qui rend le point 8
invisible pour lui.

---

## Classement

**Cassé**
1. Le moteur choisi dans les Réglages est ignoré par six skills sur huit (section 1)
2. Le message d'erreur actionnable est du code mort (section 2)
3. L'historique des générations ne peut jamais montrer un échec (section 3)

**Incohérent**
4. Badge « Stratégie : Prête » plus permissif que la validation réelle (section 6)
5. Trois formules de score sous un même libellé (section 7)
6. Correction annoncée réussie sans changement, 37 % des cas mesurés (section 8)
7. Trois niveaux de validation pour le même concept (section 9)
8. Cinq méthodes exposées jamais appelées, trois implémentations pour un même besoin
   (section 4)

**Manquant, par coût pour un posteur LinkedIn**
9. Aucun aperçu du rendu réel ni de la coupure « voir plus », qui décide de la lecture
10. Aucun compteur de caractères
11. Historique de versions existant mais jamais affiché
12. Aucun suivi de performance, donc aucune boucle d'apprentissage
13. Aucun rappel de publication planifiée

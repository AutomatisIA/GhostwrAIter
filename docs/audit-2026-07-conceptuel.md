# Audit conceptuel, 25 juillet 2026

Objet : ce que la configuration réellement saisie par l'utilisateur révèle des faiblesses
du concept produit.

Méthode : extraction complète de la base de l'utilisateur, puis comparaison de ce qui est
saisi avec ce qui atteint effectivement le modèle. C'est l'analyse que devait permettre
le futur module d'export. Elle n'avait pas besoin du module : la base était lisible
directement.

---

## Ce qui est saisi

| Table | Volume | État |
|---|---|---|
| `profiles` | 1 | Nom, positionnement, bio (1 591 car.), résumé d'expertise (7 049 car.) |
| `icps` | 4 | 6 champs chacun, tous remplis, richement |
| `pillars` | 5 | Libellé et description longue |
| `offers` | 4 | Nom, promesse, problèmes traités |
| `voice_rules` | 10 | Réparties en do / dont / anti_style / format_rule |
| `app_settings.foundation_summary` | 8 406 car. | Socle éditorial généré par la skill dédiée |

**La configuration est complète et de bonne qualité.** Les ICPs en particulier sont
travaillés : segments, douleurs, objections, résultats attendus, vocabulaire employé,
comportement LinkedIn. C'est un travail sérieux.

Le problème n'est donc pas la saisie. Il est dans ce que l'application en fait.

---

## Faiblesse 1 : plus de la moitié de ce qui est saisi n'atteint jamais le modèle

`workshop.service.ts` transforme les ICPs en une chaîne de texte avant de l'envoyer :

```ts
private summarizeIcps(strategy: StrategyBundle) {
  return strategy.icps
    .map((icp) => `${icp.segment}: douleurs=${icp.pains}. objections=${icp.objections ?? ""}`)
    .join(" | ");
}
```

Six champs sont saisis par ICP. Trois sont envoyés.

| Champ ICP | Saisi | Envoyé au modèle |
|---|---|---|
| `segment` | oui | oui |
| `pains` | oui | oui |
| `objections` | oui | oui |
| `desired_outcomes` | oui | **non** |
| `language_cues` | oui | **non** |
| `linkedin_behavior` | oui | **non** |

Vérifié sur le prompt réellement capturé : la chaîne `strategyIcpSummary` envoyée ne
contient ni « Concret », ni « gain de temps », ni « Consomme des contenus ».

Les trois champs perdus sont précisément les plus utiles à la rédaction :

- `language_cues` contient le vocabulaire exact de la cible (« Concret », « terrain »,
  « gain de temps », « cas métier », « mise en pratique », « mesurable »). C'est
  littéralement le lexique qui rendrait un post reconnaissable par son audience.
- `desired_outcomes` donne le bénéfice à formuler.
- `linkedin_behavior` décrit le format que la cible consomme (études de cas, carrousels,
  témoignages).

L'application demande à l'utilisateur de remplir six champs, en exploite trois, et ne le
dit nulle part. Le temps passé sur les trois autres est perdu.

---

## Faiblesse 2 : la même information est demandée trois à quatre fois

Le champ `expertise_summary` du profil contient 7 049 caractères de texte libre. Extrait
réel de ce que l'utilisateur y a saisi :

> je forme les organisation à l'IA générative, quel que soit le niveau. […]
> **mes offres :** formation acculturation, audit, developpement technique.
> **pilliers :** rendre l'IA accessible à toutes les entreprises.
> **exemple de post :** "OpenAI propose m…"

L'utilisateur a re-saisi dans une seule zone de texte ce que les onglets Offres, Piliers
et ICPs contiennent déjà de façon structurée. Ce n'est pas une erreur d'utilisation :
c'est le formulaire qui l'a invité à le faire, en offrant une grande zone libre sans
indiquer que l'information existait ailleurs.

À cela s'ajoute `foundation_summary` (8 406 caractères), généré par la skill
`linkedin-strategy-foundation` à partir de tout le reste. C'est donc une quatrième
description de la même personne, dérivée des trois premières.

Résultat mesuré sur un prompt réel :

| Bloc décrivant l'auteur | Caractères |
|---|---|
| `foundationSummary` | 8 676 |
| `strategyExpertiseSummary` | 7 049 |
| `strategyBio` | 1 591 |
| `strategyOffersSummary` | 1 120 |
| **Total** | **18 436** |
| Pour mémoire, le sujet du post | **459** |

**La description de l'auteur pèse quarante fois le sujet du post.** Tout est concaténé et
envoyé à chaque génération. La redondance ne se contente pas d'occuper de la place : elle
noie le signal.

---

## Faiblesse 3 : l'application ne demande jamais à qui s'adresse le post

La doctrine éditoriale du projet, telle qu'elle est écrite dans `docs/editorial-doctrine.md`,
énonce : chaque post cible UNE persona, pas plusieurs mélangées.

L'application envoie systématiquement les quatre ICPs concaténés, et ne propose à aucun
moment de choisir lequel est visé. Le parcours de l'atelier demande une typologie, un
objectif, une structure, une accroche. Jamais une cible.

Le modèle reçoit donc quatre audiences et une consigne implicite d'en servir une seule,
sans savoir laquelle. Le comportement rationnel, dans ce cas, est d'écrire pour le plus
petit dénominateur commun. C'est une explication directe du caractère générique des
sorties.

Aggravant : trois des quatre ICPs saisis sont très proches (« Décideurs de formation en
entreprise : dirigeants, CODIR, RH », « Dirigeants de PME, membres du CODIR, directeurs »,
« Dirigeants, CODIR, directeurs de PME/ETI en phase de digitalisation »). Leurs douleurs
se recouvrent largement. Concaténés, ils produisent une bouillie de décideur générique.

Le pilier, lui, est bien sélectionné par idée et transmis correctement. Le mécanisme
existe donc déjà, il n'a simplement pas été appliqué à la cible.

---

## Faiblesse 4 : rien ne relie une sortie à ce qui l'a produite

Aucune trace ne permet de répondre à la question « pourquoi ce post est-il faible ». Le
journal d'exécution conserve l'objet d'invocation mais pas le prompt assemblé. Aucun
champ n'enregistre quelle version des prompts a servi, ni quel moteur, ni quelle
configuration était active.

Conséquence sur le concept lui-même : un produit dont la promesse est d'améliorer la
qualité éditoriale au fil du temps ne conserve rien qui permette de constater une
amélioration. C'est exactement la situation rencontrée au début de cet audit, où il a
fallu reconstituer par recoupement le fait que la qualité avait changé entre avril et
juillet.

---

## Faiblesse 5 : le seul indicateur de qualité est déclaratif

Détaillé dans l'audit éditorial, section 6. Rappel du point conceptuel : l'application
demande au modèle de noter son propre travail, stocke cette note, l'agrège en moyenne, et
l'affiche comme un indicateur de pilotage. Un produit qui interdit les chiffres inventés
en affiche un en permanence.

---

## Faiblesse 6 : le travail s'arrête avant la publication

L'application produit un texte et s'arrête là. Pour quelqu'un qui publie sur LinkedIn, il
manque tout ce qui entoure le texte : la limite de caractères, la coupure « voir plus »
qui décide si le post est lu, le format visuel, le moment de publication, et le retour
sur ce qui a fonctionné.

Ce point est développé dans l'audit fonctionnel. Il est repris ici parce qu'il touche au
concept : un outil qui optimise le texte sans jamais voir sa performance ne peut pas
apprendre, et demande à l'utilisateur de croire sur parole qu'il s'améliore.

---

## Ce que l'export de configuration doit servir

Le besoin exprimé était d'avoir toujours une copie de tout ce qui a été renseigné. Cet
audit ajoute une exigence qui n'était pas dans la demande initiale : l'export doit rendre
visible **l'écart entre ce qui est saisi et ce qui est utilisé**.

Un export qui recopie fidèlement les six champs d'ICP donnerait à tort l'impression que
les six comptent. Le premier rôle de cet export est d'être un outil de vérité sur la
configuration.

Il existe déjà un `app/main/domains/export/export.service.ts` de 64 lignes avec une
méthode `exportWorkspace()`, et un bouton « Exporter le workspace » dans les Paramètres.
Le point de départ n'est donc pas vierge : il s'agit d'étendre une surface existante,
pas d'en créer une.

Même remarque pour le module de règles d'écriture : la table `voice_rules` existe, elle
contient dix règles typées, et l'écran Stratégie a déjà un onglet Voix avec un composant
`VoiceRulesSection.tsx`. Le manque n'est pas l'absence de règles, il est que ces règles
pèsent 7 % du prompt, arrivent sous forme de données JSON et non d'instructions, et
qu'aucune ne peut être vérifiée automatiquement.

Conformément à la règle de la porte de valeur, ces deux modules ne seront pas conçus
dans cet audit. Une phrase de valeur sera soumise à Philippe pour chacun avant la
première ligne de code.

---

## Synthèse

Le concept n'est pas faible. La chaîne est cohérente et le travail de configuration est
sérieux. Les faiblesses sont concentrées sur un même point : **l'application collecte
beaucoup, en utilise peu, et n'en dit rien.**

Par ordre d'effet sur la qualité des sorties :

1. Trois champs d'ICP sur six sont ignorés, dont le lexique de la cible.
2. La description de l'auteur pèse quarante fois le sujet du post.
3. La cible du post n'est jamais choisie, alors que la doctrine l'exige.
4. Rien n'est tracé, donc rien n'est améliorable de façon démontrable.
5. Le seul indicateur affiché est une auto-évaluation.
6. La chaîne s'arrête avant ce qui décide du succès d'un post.

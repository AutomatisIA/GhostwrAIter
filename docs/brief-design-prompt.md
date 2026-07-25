# Prompt à copier

À coller tel quel, en joignant `docs/brief-design.md` et les captures de
`/tmp/ghost-audit/`.

---

Tu travailles sur la direction visuelle de GhostwrAIter, une application de
bureau Electron déjà construite et fonctionnelle. Je ne veux pas une refonte
graphique en surface, je veux une direction argumentée et applicable.

Lis d'abord le brief joint, il décrit le produit, ses cinq écrans, son workflow
de production en quatre étapes, le système de conception en place, les
contraintes non négociables et les défauts que j'ai déjà mesurés. Regarde ensuite
les captures : elles montrent l'état réel, thèmes clair et sombre, ainsi que
l'état de premier lancement.

**Le problème que je te confie, formulé honnêtement.** L'application a déjà reçu
une refonte visuelle complète il y a deux mois : système de variables, primitives
React, animations, thème sombre. Elle ne convainc toujours pas. Un audit a
identifié deux causes plutôt qu'une absence de style :

1. La finition a été appliquée à des modules qui n'avaient rien à dire. Le bloc
   le plus mis en scène de l'écran principal affichait « Tout est en place ».
   Habiller un module vide le rend plus visible sans le rendre plus utile.
2. Les variables de conception sont contournées en silence par une feuille de
   style héritée de 2 400 lignes, dont 92 % des classes sont encore utilisées.
   L'échelle rendue à l'écran compte plus du double des tailles conçues.

Une troisième passe purement esthétique échouerait donc de la même façon. Je
cherche une direction qui tranche des questions de composition et de hiérarchie,
pas une palette de plus.

**Ce que j'attends de toi, dans cet ordre.**

D'abord un **parti pris**, en une page. Quelle personnalité pour un outil
éditorial professionnel utilisé seul, entre deux rendez-vous, par quelqu'un qui
n'est pas designer. Justifie par ce que tu vois dans les captures, pas par des
principes généraux. Dis explicitement ce que tu écartes et pourquoi.

Ensuite une **échelle typographique** complète, exploitant la police Inter
Variable déjà embarquée, de la graisse 100 à 900. La hiérarchie actuelle repose
presque uniquement sur la taille : montre-moi comment la graisse et
l'interlignage peuvent en porter une part.

Ensuite un **système de couleur**. La primaire `#0a66c2` est verrouillée, c'est
le bleu LinkedIn et le produit s'adresse à des utilisateurs de LinkedIn. Tout le
reste est ouvert. L'application est aujourd'hui monochrome bleu et gris : les
couleurs sémantiques sont déclarées mais n'apparaissent presque jamais à l'écran.
Propose un accent secondaire et une règle d'emploi, en indiquant la part de
surface que chaque couleur doit occuper.

Ensuite les **compositions**, écran par écran. C'est le cœur de la commande.
Trois écrans posent un vrai problème :

- **Cockpit** : quatre cartes de mesure, une barre de progression et un bloc
  d'action occupent 44 % de la hauteur avant tout contenu réel. Le bloc d'action
  calcule désormais une vraie prochaine action, il mérite son poids. Les
  compteurs, beaucoup moins.
- **Créer** : trois colonnes égales dont la troisième est presque vide, et aucun
  bouton d'action visible sans faire défiler. En dessous, un atelier en quatre
  étapes avec un guide collé à gauche.
- **Stratégie** : un formulaire de six onglets où chaque champ occupe quatre
  lignes, libellé puis aide puis champ puis exemple. L'aide a été ajoutée pour
  les débutants et devient du bruit pour l'utilisateur installé. Rien ne la
  replie une fois apprise. C'est le problème de densité le plus coûteux du
  produit.

Enfin les **états d'attente**. Une génération prend entre 20 et 100 secondes.
L'utilisateur attend souvent, c'est une part importante du temps passé dans
l'application. Traite cet état comme un écran à part entière, pas comme un
indicateur.

**Deux observations à ne pas perdre**, tirées de l'audit :

L'état de premier lancement est nettement mieux conçu que l'état rempli. Le
produit soigne l'accueil et se dégrade à mesure qu'il se remplit. La direction
doit tenir dans la durée, pas seulement à l'ouverture.

Les seules touches de couleur non bleue de l'interface venaient d'emojis qui ont
été retirés, l'usage d'emojis étant proscrit. Si ta direction reste monochrome,
elle sera plus terne qu'avant.

**Contraintes fermes.** Aucun emoji, icônes SVG uniquement. Aucun cadratin dans
les textes. Français parfaitement accentué, majuscules comprises. Aucune
ressource réseau : une politique de sécurité stricte interdit tout CDN, toute
police distante, toute image hébergée, tout doit être embarqué. Contraste WCAG AA
minimum sur les deux thèmes. Aucune valeur en dur, tout passe par des variables.
Thème clair et thème sombre traités tous les deux, jamais l'un déduit de l'autre.

**Ce que je ne veux pas.** Pas de proposition qui suppose de tout reconstruire :
la feuille de style héritée doit être remplacée progressivement, dis-moi par où
commencer et dans quel ordre. Pas de tendance appliquée sans raison liée à cet
usage précis. Pas de maquette sans les valeurs qui permettent de l'implémenter.

**Livrable attendu.** Le parti pris argumenté, l'échelle typographique complète,
le système de couleur avec ses règles d'emploi et ses ratios de contraste
vérifiés, les compositions des trois écrans problématiques, le traitement de
l'état d'attente, et un ordre de mise en oeuvre qui indique ce qui apporte le
plus au premier coup.

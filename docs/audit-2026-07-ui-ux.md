# Audit UI-UX, 25 juillet 2026

Objet : pourquoi l'application n'est pas jugée au niveau visuellement, alors qu'une
refonte complète (feature 010 : design system, tokens, primitives, animations) a été
livrée en mai et validée sur échantillon.

Méthode : dix captures du build de production sur les données réelles, viewport
1440x900, thèmes clair et sombre, jugées image par image. Le code (`tokens.css`,
`styles.css`, `LibraryScreen.tsx`) a servi à chiffrer et vérifier ce qui était visible,
jamais à remplacer l'observation.

Captures conservées dans `/tmp/ghost-audit/` (les fichiers `*-dark2.png` sont les seuls
valides pour le thème sombre).

C'est le second retour de forme sur ce module. Conformément à la doctrine du projet, un
retour de forme répété est traité ici comme un signal de fond, pas comme une demande de
passe de style supplémentaire.

---

## 1. Diagnostic de fond

Le design system existe et il est correct : échelle d'espacement en 4 px, rayons, quatre
niveaux d'ombre, motion, effets de verre, gradients dérivés du bleu primaire. Le problème
n'est pas son absence. Il tient à trois mécanismes.

### Mécanisme 1 : la finition a été appliquée aux modules qui n'ont rien à dire

Le bloc « PROCHAINE ACTION » du Cockpit est l'élément le plus mis en scène de l'écran
principal : bordure pleine, fond distinct, halo lumineux en thème sombre. Il affiche
« Tout est en place / Votre pipeline de contenu est opérationnel ». C'est un appel à
l'action qui n'appelle à rien.

Juste au-dessus, les quatre cartes de statistiques (Prête, 8 idées, 15 drafts, 1 planifié)
ne font que reformuler ce que l'utilisateur a saisi ailleurs.

Habiller ces deux blocs les rend plus visibles sans les rendre plus utiles. L'attention
visuelle se porte donc sur du vide fonctionnel, ce qui produit exactement l'impression
« joli mais toujours pas au niveau ». Ces modules sont candidats au retrait ou au
remplacement par une prochaine action réellement calculée, pas à une nouvelle passe de
style.

### Mécanisme 2 : les tokens sont contournés en silence, sans qu'aucun outil ne le signale

`tokens.css` ligne 6 énonce qu'aucune valeur ad hoc ne doit subsister. Dans les faits,
sur 93 déclarations `font-size` de `styles.css`, 55 seulement utilisent un des 7 tokens
déclarés. Les 38 restantes sont des valeurs en dur réparties sur **17 tailles distinctes**
(0.7, 0.72, 0.78, 0.82, 0.88, 0.9, 0.92, 0.94, 0.95, 1.02, 1.04, 1.05, 1.12, 1.18, 1.2,
1.3, 1.4 rem).

L'échelle réellement rendue à l'écran compte donc plus du double de tailles que l'échelle
conçue. Ni le typecheck, ni le lint, ni les 478 tests ne détectent cet écart, parce que ce
n'est pas un défaut fonctionnel.

### Mécanisme 3 : la palette déclarée est plus riche que la palette montrée

`styles.css` définit un vert succès, un orange alerte, un rouge erreur et un bleu ciel
secondaire en plus du bleu primaire. **Sur les dix captures, aucune de ces couleurs
n'apparaît jamais à l'écran**, en dehors des emojis eux-mêmes.

Conséquence paradoxale à anticiper : la seule respiration chromatique actuelle de
l'application vient des emojis (✅ 💡 📝 📅), c'est-à-dire de l'élément que la doctrine
interdit. Les retirer sans rien mettre à leur place videra l'interface de sa dernière
couleur non bleue.

---

## 2. Trois défauts confirmés dans le code

### 2.1 Le bouton de suppression est visuellement identique aux actions bénignes

En Bibliothèque, « Supprimer » a exactement le même bleu que « Modifier » et
« Retravailler ». Ce n'est pas un oubli de maquette, c'est un conflit de spécificité CSS.

`LibraryScreen.tsx:563` applique bien une classe `lib-card-action-danger`, définie en
`styles.css:496` avec `color: var(--color-error-text)`.

Mais cette classe a une spécificité de (0,1,0), tandis que
`.ds-button[data-variant="ghost"] { color: var(--color-accent); }` en `styles.css:1994`
a une spécificité de (0,2,0). La seconde gagne toujours, quel que soit l'ordre dans le
fichier.

Aggravant : un variant `danger` complet existe déjà en `styles.css:1983`, correctement
stylé, et n'est pas utilisé ici.

C'est le seul défaut de l'audit qui constitue un risque produit et pas seulement
esthétique : une action irréversible sans signal visuel distinct.

### 2.2 Le bleu de marque n'a pas été adapté au thème sombre

Dans le bloc `:root[data-theme="dark"]` de `styles.css` (ligne 60 et suivantes),
`--color-error-text`, `--color-success-text` et `--color-warning-text` sont tous
redéfinis pour le fond sombre. **`--color-accent` ne l'est pas.**

Le même `#0a66c2` sert donc de couleur de texte sur un fond de carte `#1e293b`, soit un
ratio de contraste estimé à 2,6:1, très en dessous du seuil WCAG AA (4,5:1) et même du
seuil grand texte (3:1). Cette couleur porte les libellés de pilier et les liens, donc
elle apparaît sur pratiquement chaque carte du Cockpit et de la Bibliothèque.

Un token a été adapté au sombre (le gradient d'accent, éclairci à `#1d7fe0` dans
`tokens.css`), l'autre a été oublié, pour le même bleu de marque.

Estimation calculée à la main par la formule de luminance relative : à confirmer par
mesure outillée (axe, Lighthouse) avant de considérer le point comme clos.

### 2.3 Il n'y a aucun parti pris typographique, au sens propre

`styles.css:47-50` déclare `font-family: "Aptos", "Inter", sans-serif`.

Vérifié : **zéro `@font-face` dans tout le projet, zéro fichier de police embarqué**
(recherche `*.woff*`, `*.ttf`, `*.otf` dans `app/renderer` : 0 résultat).

Aptos est la police par défaut des versions récentes de Microsoft Office, pas une police
macOS standard. Inter n'est pas non plus préinstallée sur macOS. La police réellement
affichée dépend donc de ce qui est installé sur la machine de l'utilisateur, avec repli
final sur le `sans-serif` générique du système.

Le choix typographique le plus structurant du produit n'est ni fait ni garanti.

Sur les graisses : sur 42 déclarations `font-weight`, la quasi-totalité se répartit entre
600 (22 occurrences, dont 12 en valeur brute au lieu du token) et 700 (13 occurrences).
Le 500 n'apparaît que 6 fois, le 400 une seule fois. La hiérarchie repose donc presque
exclusivement sur la taille, très peu sur la graisse, ce qui aplatit l'écart perçu entre
un titre de page et un simple libellé en gras.

---

## 3. Analyse écran par écran

### Cockpit
Ce qui fonctionne : la barre de progression du pipeline est le seul élément qui raconte
une histoire d'un coup d'oeil.

Ce qui ne fonctionne pas : « Derniers drafts » et « Dernières idées » cassent sur deux
lignes dans les deux thèmes, la colonne de libellé étant trop étroite. Les emojis servent
d'icônes de section. Le libellé de pilier est répété à l'identique sur deux cartes
adjacentes.

Écart entre thèmes : le bloc PROCHAINE ACTION reçoit un traitement plus appuyé en sombre
(bordure vive, halo net) qu'en clair. Le composant qui porte le moins d'information gagne
le plus de poids visuel.

### Stratégie éditoriale
Ce qui fonctionne : navigation par onglets claire, barre de complétude lisible.

Écart entre thèmes : le bloc d'exemple en italique est rendu comme un encart visible en
sombre, et devient quasi invisible en clair, sa couleur de fond étant à moins de dix
points de luminance du fond de carte. En clair, cet exemple se confond avec du texte déjà
saisi par l'utilisateur.

Constat complémentaire relevé hors capture : le champ Positionnement contient la
signature LinkedIn brute de l'utilisateur, tronquée dans un `input` sur une seule ligne,
alors que la consigne demande une phrase. Le champ accepte n'importe quoi et n'indique
pas qu'il alimente chaque prompt.

### Créer
Le plus problématique. Chaque champ est un empilement description, libellé, phrase
d'aide, champ, exemple en italique. Dans la seule colonne « Saisir une idée », le premier
champ consomme un libellé, deux lignes d'aide, un champ et un exemple avant d'atteindre
le champ suivant.

**Aucun bouton d'action n'est visible sur 900 px de hauteur, sur aucune des deux
captures.** L'écran de création principal n'offre pas d'action au premier regard.

La troisième colonne s'arrête à environ 390 px sur 900, soit 57 % de vide, pendant que
les deux autres sont pleines jusqu'au bord. Le déséquilibre est visible immédiatement.

Identique en clair et en sombre : c'est un problème de composition de formulaire, pas de
thème.

### Bibliothèque
Tags auto-générés parasites mêlés aux tags utiles sans hiérarchie visuelle : « laisse »,
« désormais », « occuper », « appetance » ont exactement le même style que les tags
porteurs de sens. Le libellé de pilier est dupliqué deux fois par carte, une fois en tag
bleu capitalisé, une fois en minuscules juste en dessous. Les aperçus sont tronqués en
plein mot sans points de suspension. Le bouton Supprimer est traité au point 2.1.

### Paramètres
Le plus sobre et le plus lisible des cinq écrans, dans les deux thèmes. Structure en
cartes empilées, une carte par sujet, pas de surcharge d'aide.

Réserve non tranchée : la carte « Moteur d'exécution » laisse environ 180 px vides sous
son contenu dans les deux captures. Impossible de dire si la carte est réellement vide ou
si son contenu est coupé par le viewport. À vérifier avec une capture défilée.

---

## 3 bis. L'état zéro-données est mieux conçu que l'état rempli

Capturé séparément sur un workspace vierge (`/tmp/ghost-audit/zero/`), c'est-à-dire ce
que voit un utilisateur au tout premier lancement.

Le constat inverse celui de la section 1. Le bloc dominant du Cockpit, celui qui affiche
« Tout est en place » une fois l'application remplie, affiche au premier lancement :

> **Bienvenue : trois étapes pour démarrer**
> 1. Stratégie : positionnement, offres, piliers, voix
> 2. Idées : capturer vos premiers sujets
> 3. Rédiger : produire votre premier draft
> [ Commencer par la stratégie ]

C'est utile, hiérarchisé, et porteur d'une action réelle. Les états vides des deux
colonnes du bas proposent eux aussi de vrais boutons (« Créer une idée », « Créer votre
première idée »), alors que l'état rempli n'offre qu'un lien texte « Ouvrir ».

**Le produit est soigné pour le premier lancement et se dégrade à mesure qu'il se
remplit.** C'est précisément la situation d'un utilisateur installé : il ne voit plus
jamais la version aboutie de cet écran. Le module n'est donc pas à supprimer, il est à
faire vivre après l'onboarding, en calculant une prochaine action réelle au lieu de
constater qu'il n'y en a pas.

Deux indicateurs soupçonnés de mentir sont en réalité honnêtes, vérification faite sur
l'état vierge :

- l'onglet « Socle éditorial » n'affiche **pas** de coche tant que le socle n'a pas été
  généré. La coche vue sur les captures remplies est donc juste.
- l'indicateur de complétude affiche « 0 / 4 champs renseignés » et le message
  « Profil incomplet : impactera la qualité de post-writer ». Il compte réellement les
  champs, et il explique la conséquence. C'est le meilleur élément pédagogique de
  l'application.

---

## 4. Densité, chiffrée

**Cockpit** : du haut de page au premier contenu réellement produit par l'utilisateur,
l'empilement cartes de statistiques (environ 170 px), barre de progression (40 px) et
carte PROCHAINE ACTION vide (145 px) occupe la bande y≈133 à y≈528, soit **44 % de la
hauteur utile** avant tout contenu utile.

**Créer** : 57 % de vide sur la troisième colonne, aucun bouton d'action au-dessus du pli.

Le motif est commun aux deux écrans : la place perdue n'est pas du blanc décoratif, c'est
soit un module qui reformule une donnée déjà connue, soit du texte d'aide qui remplace
l'action attendue. Densifier visuellement ne réglera ni l'un ni l'autre.

---

## 5. Classement des défauts

**Décrédibilise, à corriger en premier**
1. Bouton Supprimer identique aux actions bénignes (bug de spécificité, section 2.1)
2. Bloc PROCHAINE ACTION vide en position dominante
3. Écran Créer sans action visible au-dessus du pli
4. Absence de police embarquée : la typographie dépend de la machine

**Gêne l'usage**
5. Contraste des libellés de pilier en thème sombre (2,6:1 estimé)
6. Tags parasites sans hiérarchie en Bibliothèque
7. Retour à la ligne des libellés de colonne du Cockpit
8. Aide contextuelle permanente qui noie les champs
9. Exemple italique invisible en thème clair sur Stratégie

**Finition**
10. Emojis en guise d'icônes
11. Duplication du libellé de pilier par carte
12. Troncature en plein mot sans ellipse
13. 17 tailles de police hors tokens

---

## 6. Direction visuelle proposée

Le bleu `#0a66c2` reste l'ancrage, il est verrouillé. Ce qui manque n'est pas une couleur
de marque, c'est un système qui ose s'en écarter ponctuellement et une échelle qui ose des
écarts nets.

**Accent secondaire.** Introduire une couleur chaude et rare, réservée aux moments qui
comptent (action recommandée du jour, franchissement d'un palier), jamais décorative.
Ambre ou corail sobre, à moins de 5 % de la surface d'un écran. Les couleurs sémantiques
déjà déclarées doivent enfin apparaître, au lieu de rester des tokens morts.

**Neutres.** Réduire à trois paliers nets à l'affichage (fond de page, fond de carte,
bordure), contre la dizaine de variantes rgba actuelles. Moins de nuances proches, plus
d'écart entre elles : la hiérarchie doit se voir sans lire le texte.

**Typographie.** Choisir une seule famille et l'embarquer en woff2 variable, sans
dépendance à la machine. Prévoir une graisse fine en plus des poids actuels, pour que les
titres pèsent vraiment plus lourd que les libellés. Ramener l'échelle rendue aux 7 paliers
conçus, sans exception.

**Composition.** Passer d'une grille de cartes égales à un parti pris asymétrique. Sur le
Cockpit, un seul élément dominant, la prochaine action réellement calculée, occupant
l'espace aujourd'hui donné à la carte vide, les chiffres relégués en bandeau discret. Sur
Créer, une seule colonne active à la fois, l'aide repliée derrière une icône plutôt
qu'affichée en permanence.

---

## Notes de méthode

- Les dix captures ont été ouvertes et jugées visuellement, pas déduites du code.
- Les trois défauts de la section 2 ont été revérifiés indépendamment dans le code après
  rédaction : conflit de spécificité confirmé (496 contre 1994), absence de
  `--color-accent` dans le bloc sombre confirmée, absence de `@font-face` et de fichier de
  police confirmée.
- Le contraste WCAG est une estimation calculée à la main, à confirmer par outil.
- Rien n'a été modifié, aucun build ni test lancé pendant cet audit.

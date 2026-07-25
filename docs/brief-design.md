# GhostwrAIter, brief de conception

Document de passation destiné à un travail de conception visuelle. Il décrit ce
que fait le produit, tous ses écrans et états, le système visuel en place, les
contraintes non négociables et les défauts connus.

Version décrite : 1.4.1, branche `013-audit-et-corrections`, 25 juillet 2026.

---

## 1. Ce qu'est le produit

Application de bureau Electron, locale, macOS et Windows et Linux. Elle aide un
consultant indépendant à produire ses posts LinkedIn, de la stratégie éditoriale
au texte prêt à publier.

**Utilisateur type** : un professionnel seul, non technique, qui publie une à
trois fois par semaine. Il n'est pas designer, pas développeur. Il ouvre
l'application entre deux rendez-vous.

**Ce qui la distingue** : tout reste sur la machine. Aucun serveur, aucun compte.
La génération passe par un outil en ligne de commande déjà installé par
l'utilisateur, avec son propre abonnement (Codex, Claude Code ou Gemini CLI).

**Ce qu'elle ne fait pas** : elle ne publie pas sur LinkedIn. L'API est trop
restreinte. L'utilisateur copie le texte et le colle lui-même.

**Rythme d'usage réel, à garder en tête** : une génération prend entre 20 et 100
secondes. L'utilisateur attend souvent. Les états d'attente ne sont donc pas un
détail, ils occupent une part importante du temps passé dans l'application.

---

## 2. Navigation

Barre latérale fixe, cinq entrées, toujours visible au-dessus de 768 px. En
dessous, elle devient un tiroir coulissant ouvert par un bouton, fermable par la
touche Échap ou par un clic sur le voile.

| Route | Écran |
|---|---|
| `/` | Cockpit |
| `/strategie` | Stratégie éditoriale |
| `/creer` | Créer |
| `/bibliotheque` | Bibliothèque |
| `/parametres` | Paramètres |

Quatre redirections héritées d'une version antérieure : `/idees` et `/atelier`
vers `/creer`, `/calendrier` vers la Bibliothèque en vue planning, `/runner` vers
les Paramètres en section diagnostics.

Le titre de la barre latérale porte le nom du produit et le numéro de version.

---

## 3. Les cinq écrans

### 3.1 Cockpit

Point d'entrée. Répond à « où en suis-je et que dois-je faire maintenant ».

Composition actuelle, de haut en bas :

1. **Quatre cartes de mesure** : Stratégie (état textuel), Idées, Drafts,
   Planifiés (compteurs). Chacune porte une icône colorée selon l'état :
   vert quand l'étape a du contenu, ambre quand la stratégie n'est pas
   configurée, gris neutre quand un compteur est à zéro.
2. **Barre de progression du pipeline** en cinq segments : Stratégie, Idées,
   Drafts, Planifiés, Publiés. Un segment allumé signifie que l'étape a du
   contenu.
3. **Bloc « Prochaine action »**, l'élément le plus mis en scène de l'écran. Il
   calcule l'urgence réelle dans cet ordre : posts dont la date de publication
   est arrivée, puis brouillons sans date, puis idées sans brouillon, puis
   relance du pipeline. Il porte un titre, une explication et un bouton.
4. **Deux colonnes** : derniers brouillons et dernières idées, trois éléments
   chacune, avec le pilier éditorial, le titre, la longueur en caractères et un
   lien d'ouverture.

**États à couvrir** : premier lancement (tous les compteurs à zéro, le bloc
d'action affiche un accueil en trois étapes numérotées avec un bouton, les
colonnes affichent des états vides avec un bouton chacun), usage courant,
chargement.

### 3.2 Stratégie éditoriale

Formulaire long en six onglets. C'est l'écran le plus dense et le plus rebutant.

| Onglet | Contenu |
|---|---|
| Profil | Nom, positionnement, bio, résumé d'expertise. Un indicateur de complétude en cinq segments, avec le message de conséquence : « Profil incomplet, impactera la qualité de post-writer » |
| Offres | Liste répétable : nom, promesse, problèmes traités, preuves, appels à l'action |
| ICPs | Liste répétable de cibles : segment, douleurs, objections, résultats attendus, vocabulaire qui résonne, comportement LinkedIn |
| Piliers | Liste répétable : libellé, description, position, pilier par défaut |
| Voix | Règles d'écriture typées (à faire, à éviter, anti-style, règle de format), plus une section de neuf familles de marqueurs d'écriture IA à cocher |
| Socle éditorial | Texte long généré par l'IA à partir de tout le reste. Un bouton le régénère. Une coche sur l'onglet indique qu'il existe |

**Motif de champ actuel, systématique** : libellé, puis phrase d'aide, puis
champ, puis exemple en italique. Quatre lignes par champ. Sur un formulaire de
cette longueur, c'est le principal problème de densité.

### 3.3 Créer

Deux moitiés dans un même écran.

**En haut, trois portes d'entrée** présentées en trois colonnes égales :

1. Saisir une idée : titre, angle, pilier
2. Transformer une veille : titre de la source, résumé, puis génération directe
   d'un brouillon
3. Générer depuis la stratégie : l'application propose des sujets à partir des
   piliers, ICPs et offres

En dessous, la liste des idées en attente, chacune ouvrable dans l'atelier.

**En bas, l'atelier de production**, en deux colonnes :

- **Colonne de gauche, 340 px, collée en défilement** : le guide. Il affiche
  l'étape en cours sur quatre, un rappel de tout ce qui a déjà été choisi
  (typologie, objectif, structure, accroche), l'état courant en une phrase, et
  le contexte éditorial envoyé au modèle.
- **Colonne de droite** : le bandeau de progression pendant une génération, puis
  le panneau de l'étape en cours.

**Les quatre étapes** :

1. **Cadrage** : choisir une typologie parmi cinq (expertise, contrarien, étude
   de cas, tutoriel, leadership d'opinion) et un objectif parmi quatre
   (notoriété, autorité, conversion, engagement)
2. **Structure** : l'IA propose trois schémas narratifs avec leur justification,
   l'utilisateur en choisit un
3. **Accroche** : l'IA propose trois à cinq premières phrases, avec leur famille,
   l'utilisateur en choisit une
4. **Brouillon** : le texte complet. Sous le texte, la longueur en caractères,
   le rapport des marqueurs d'écriture IA repérés avec l'extrait exact de
   chacun, une mise en garde permanente sur les limites de cette détection, et
   après une correction, la comparaison avant/après paragraphe par paragraphe
   avec l'ancien texte barré et le nouveau mis en avant.

Les actions de l'étape 4 : revenir au cadrage, changer la structure, changer
l'accroche, lancer la correction premium, modifier le texte à la main, copier le
post.

### 3.4 Bibliothèque

Deux onglets.

**Brouillons** : deux cartes de mesure en tête (nombre de brouillons visibles,
longueur moyenne), un champ de recherche, un filtre de statut, puis la liste.
Chaque carte porte le titre, un extrait tronqué proprement, le pilier en pastille
colorée, des mots-clés, la longueur en caractères, et six actions : créer une
variante, planifier, modifier, retravailler, supprimer.

**Planning** : les posts planifiés par date, avec copie du texte et passage au
statut publié.

### 3.5 Paramètres

Écran le plus sobre, en cartes empilées.

- **Thème** : clair, sombre, système
- **Moteur d'exécution** : trois cartes, une par outil (Codex, Claude Code,
  Gemini CLI), chacune avec son état (non installé, installé, connecté), les
  commandes d'installation et de connexion copiables, et un bouton de sélection.
  Le choix est contraignant : si le moteur retenu n'est pas connecté, la
  génération échoue en le nommant plutôt que de basculer en silence.
- **Diagnostics** : historique des exécutions, ouverture des journaux
- **Espace de travail** : export, purge des journaux avec confirmation
- **Visite guidée** : relance

---

## 4. Éléments transverses

- **Visite guidée** au premier lancement : sept étapes, dialogue modal, avec
  compteur d'étape, titre, corps, prochaine action, et trois boutons (passer,
  précédent, suivant)
- **Notifications** temporaires en bas d'écran, quatre types
- **Bandeau de progression IA** : phase en cours, libellé d'intention, temps
  écoulé, étape courante sur total
- **Boîtes de confirmation** pour toute action destructive
- **Infobulles d'aide** sur les termes métier, quinze termes définis
- **États vides** pédagogiques avec un bouton d'action
- **Squelettes de chargement**

---

## 5. Système visuel en place

**Ce qui existe et doit être conservé ou amélioré, pas jeté.**

- **Couleur primaire verrouillée** : `#0a66c2`, le bleu LinkedIn. Ce point n'est
  pas négociable.
- **Thème clair et sombre**, complets, avec un jeu de variables CSS. Le thème
  suit le système par défaut.
- **62 variables de conception** : espacement en échelle de 4 px sur 9 paliers,
  6 rayons, 7 tailles de police, 4 graisses, 4 niveaux d'ombre, mouvement,
  effets de verre, dégradés.
- **Police embarquée** : Inter Variable, licence libre, axe de graisse de 100 à
  900. Aucune dépendance réseau.
- **11 primitives React** : bouton (5 variantes), carte, champ, onglets,
  compteur d'étapes, squelette, infobulle, état vide, boîte de confirmation,
  progression IA, icônes.
- **Icônes SVG maison**, dans l'esprit lucide : trait de 1,75, extrémités
  arrondies, sans remplissage, en `currentColor`.
- **Animations** via la bibliothèque `motion`, avec respect de la préférence de
  mouvement réduit.

---

## 6. Contraintes non négociables

1. **Aucun emoji nulle part.** Icônes SVG professionnelles uniquement.
2. **Aucun cadratin** dans les textes de l'interface.
3. **Français parfaitement accentué**, majuscules comprises.
4. **Couleur primaire `#0a66c2`.**
5. **Aucune dépendance réseau à l'exécution.** Une politique de sécurité stricte
   bloque toute ressource externe : pas de CDN, pas de police distante, pas
   d'image hébergée. Tout doit être embarqué.
6. **Accessibilité** : contraste WCAG AA minimum, focus visible au clavier,
   rôles ARIA sur les onglets et les dialogues, mouvement réduit respecté.
7. **Aucune valeur en dur** : passer par les variables existantes, ou en ajouter.
8. **Pas de dépendance npm supplémentaire** sans nécessité démontrée.

---

## 7. Défauts connus, non corrigés

Ce sont les points sur lesquels un travail de conception apporterait le plus.

**Densité et rythme**

- L'écran Créer présente trois colonnes égales dont la troisième est presque
  vide. Aucun bouton d'action n'est visible sans faire défiler.
- Le motif de champ à quatre lignes rend l'écran Stratégie interminable. L'aide
  contextuelle, ajoutée pour les débutants, devient du bruit pour l'utilisateur
  installé. Rien ne la replie une fois apprise.
- Sur le Cockpit, l'empilement des cartes de mesure, de la barre de progression
  et du bloc d'action occupe 44 % de la hauteur avant tout contenu réel.

**Hiérarchie**

- La hiérarchie typographique repose presque uniquement sur la taille. Les
  graisses fine et très forte existent désormais mais ne sont presque pas
  employées.
- L'échelle réellement rendue compte plus de tailles que l'échelle conçue : des
  valeurs en dur subsistent dans la feuille de style héritée.

**Couleur**

- L'application est monochrome bleu et gris. Les couleurs sémantiques (succès,
  alerte, erreur) sont déclarées mais n'apparaissent presque jamais.
- Aucune couleur d'accent secondaire.

**Dette structurelle**

- Une feuille de style héritée de 2 400 lignes coexiste avec le système de
  conception. 92 % de ses classes sont encore utilisées : elle n'est pas
  supprimable en bloc, elle demande un remplacement progressif.
- Le paquet de l'interface pèse 1,15 Mo en un seul morceau, sans découpage.

**Ce qui fonctionne et mérite d'être préservé**

- L'état de premier lancement est nettement mieux conçu que l'état rempli. Le
  produit soigne l'accueil et se dégrade à mesure qu'il se remplit.
- L'écran Paramètres est le plus lisible des cinq.
- Les états vides sont pédagogiques et portent une action.

---

## 8. Ce qui manque et n'existe nulle part

À concevoir si le périmètre le permet.

- **Aperçu du rendu LinkedIn réel**, avec la coupure « voir plus » qui décide si
  le post est lu. La limite est de 3 000 caractères, le repli se situe autour de
  210. Ces deux valeurs sont déjà calculées par le code.
- **Sélection de la persona visée** par post. La doctrine éditoriale exige une
  cible unique, l'application envoie aujourd'hui toutes les cibles au modèle sans
  jamais demander laquelle.
- **Historique des versions d'un brouillon**, qui existe en base et n'est affiché
  nulle part.
- **Suivi de performance** des posts publiés.
- **Rappel** d'une publication planifiée.

---

## 9. Où regarder

- Captures d'écran des cinq écrans, thèmes clair et sombre, plus l'état zéro
  données : `/tmp/ghost-audit/`
- Audit visuel détaillé, avec mesures de contraste : `docs/audit-2026-07-ui-ux.md`
- Audit fonctionnel, parcours et manques : `docs/audit-2026-07-fonctionnel.md`
- Variables de conception : `app/renderer/src/design-system/tokens.css`
- Primitives : `app/renderer/src/design-system/primitives/`
- Feuille de style héritée : `app/renderer/src/styles.css`

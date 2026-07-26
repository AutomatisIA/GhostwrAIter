# Maquettes de direction visuelle, importées le 25 juillet 2026

Source : projet Claude Design « Design de pipeline avec attente »,
`ff945791-6e5d-4cf5-9cf1-2d3977edc9b1`. Importé via l'outil DesignSync.

## Contenu

- `Maquettes.dc.html` : prototype cliquable, cinq états, 1400 x 900. Onglets
  Cockpit, Créer, Atelier étape 4, Attente, Stratégie.
- `support.js` : moteur d'exécution du canevas Claude Design. Code généré, rien
  à en tirer pour l'implémentation.

Pour ouvrir le prototype, servir le dossier localement, les deux fichiers doivent
être côte à côte.

## Décisions de conception extraites

Relevé mécanique sur le fichier, à confirmer par lecture complète.

### Neutres froids

`#0f141b`, `#414b57`, `#616a76`, `#cfd5dc`, `#e3e6ea`, `#e6e8ec`, `#f0f2f5`,
`#f6f7f9`, `#ffffff`.

Remplace le gris-bleu plat actuel par une échelle réellement contrastée.

### Accent secondaire

Famille ambre : `#e6b25c`, `#e0a744`, `#ecd9ab`, `#fbf1de`. Plus un corail
`#f0796f`.

C'est la réponse au constat de l'audit : les seules touches de couleur non bleue
de l'application venaient des emojis, désormais proscrits. Sans accent
secondaire, la direction aurait été plus terne que l'existant.

### Bleus

`#0a66c2`, `#0a5aab`, `#e9f1fb`, `#c3daf5`.

**Il n'y avait pas de décision à prendre.** Un relevé mécanique des couleurs de
ce fichier avait fait croire à un conflit avec la primaire verrouillée, parce
qu'il comptait les occurrences sans lire les déclarations. La maquette pose en
réalité `--pri:#0a66c2` et `--priT:#0a5aab` : le bleu LinkedIn est bien la
primaire, et `#0a5aab` en est le rôle **encre**, employé pour le texte et les
liens posés sur une surface claire.

Cette partition en deux rôles vaut pour les trois accents et elle est
structurante. En thème sombre, l'encre est plus **claire** que la surface
(`--primary-fill:#1a6fc4` contre `--primary-ink:#5aa4ea`). Traiter l'encre
comme une simple variante foncée de la surface casse le thème sombre.

### Échelle typographique

Neuf tailles : 11, 12, 13, 14, 15, 16, 17, 22, 34 px.

Sept graisses : 250, 400, 500, 600, 620, 680, 800.

L'application n'employait pratiquement que 600 et 700, ce qui aplatissait la
hiérarchie. La maquette exploite enfin l'axe complet d'Inter Variable, embarquée
depuis le commit `82d66f3`.

## Mise en oeuvre

Elle a été faite. Voir `design-import/CONSIGNES.md` pour le vocabulaire de
jetons appliqué, et les deux vérifications outillées qui la gardent :

- `npm run audit:contraste` mesure les paires de couleurs réellement employées
  et échoue si l'une passe sous son seuil WCAG AA, sur les deux thèmes. La
  maquette n'était pas conforme telle quelle : la bordure des champs au repos
  ne donnait que 1,48:1 en clair, alors qu'un champ de saisie n'est
  identifiable que par sa bordure. D'où le jeton `--line-field`, seul écart
  assumé à la maquette.
- `npm run audit:geometrie` lance l'application et relève des mesures dans le
  rendu réel : hauteur de l'onglet Profil, position de l'en-tête après
  défilement, largeur de la barre latérale. Aucune de ces portes ne se juge à
  la lecture du CSS.

Contraintes fermes du brief, toutes tenues : aucun emoji, aucun cadratin,
français accentué, aucune ressource réseau, contraste WCAG AA sur les deux
thèmes, aucune valeur en dur, thème clair et sombre traités séparément.

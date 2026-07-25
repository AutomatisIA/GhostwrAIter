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

`#0a5aab`, `#08447f`, `#e9f1fb`, `#c3daf5`.

**Point à trancher avant implémentation** : la maquette emploie `#0a5aab` comme
bleu principal, et non `#0a66c2`. La primaire était pourtant déclarée verrouillée
dans le brief. Le nouveau bleu est plus sombre. C'est une décision du
propriétaire, pas une décision de conception.

### Échelle typographique

Neuf tailles : 11, 12, 13, 14, 15, 16, 17, 22, 34 px.

Sept graisses : 250, 400, 500, 600, 620, 680, 800.

L'application n'employait pratiquement que 600 et 700, ce qui aplatissait la
hiérarchie. La maquette exploite enfin l'axe complet d'Inter Variable, embarquée
depuis le commit `82d66f3`.

## Pour implémenter

Ce chantier réécrit la couche visuelle de cinq écrans, plus les jetons, plus une
partie de la feuille héritée. Ce n'est pas un correctif.

À fournir à la session qui s'en chargera :

- `design-import/Maquettes.dc.html`, la maquette
- `docs/brief-design.md`, le brief d'origine avec les contraintes fermes
- `docs/audit-2026-07-ui-ux.md`, les défauts mesurés et les ratios de contraste
- `/tmp/ghost-design/`, les 36 captures de l'état actuel

Rappel des contraintes fermes du brief : aucun emoji, aucun cadratin, français
accentué, aucune ressource réseau, contraste WCAG AA sur les deux thèmes, aucune
valeur en dur, thème clair et sombre traités séparément.

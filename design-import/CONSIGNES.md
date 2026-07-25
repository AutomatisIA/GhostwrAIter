# Consignes de mise en oeuvre de la direction visuelle

Document de reference commun aux chantiers par ecran. La maquette de reference
est `design-import/Maquettes.dc.html`, prototype cliquable a 1400 x 900.

## Vocabulaire de jetons

Tout est deja declare. **Aucune valeur de couleur en dur n est admise**, et
aucune valeur d arrondi, de graisse ou de taille de police hors de ces jetons.

### Couleurs, `app/renderer/src/design-system/palette.css`

| Jeton | Role |
|---|---|
| `--surface-app` | fond de l application, derriere les surfaces |
| `--surface-raised` | surface des cartes, listes, barres |
| `--surface-sunken` | surface creusee : champs, etiquettes, survol de ligne |
| `--line` | trait de separation |
| `--line-strong` | trait de delimitation |
| `--line-field` | bordure des composants interactifs, seule conforme AA |
| `--ink` | texte principal |
| `--ink-muted` | texte secondaire |
| `--ink-subtle` | texte tertiaire, surtitres, metadonnees |
| `--primary-fill` | surface pleine primaire, sous du texte blanc |
| `--primary-ink` | texte et trait primaires, sur surface claire |
| `--primary-tint` | fond teinte primaire |
| `--primary-line` | bordure de bloc teinte primaire |
| `--amber-fill` | trait et surface ambre |
| `--amber-ink` | texte ambre |
| `--amber-tint` | fond teinte ambre |
| `--amber-line` | bordure de bloc teinte ambre |
| `--state-ok`, `--state-ko` | encre de validation, encre d erreur |
| `--state-ko-fill` | surface pleine d erreur, sous du texte blanc |
| `--on-fill` | texte pose sur une surface pleine |

**Le piege a eviter.** `--primary-fill` et `--primary-ink` ne sont pas deux
nuances d une meme couleur, ce sont deux roles. En theme clair l encre est plus
sombre que la surface, en theme sombre elle est plus claire. Utiliser
`--primary-ink` comme couleur de fond, ou `--primary-fill` comme couleur de
texte sur fond clair, casse un des deux themes. Meme regle pour l ambre et pour
l erreur.

L ambre est le seul accent non bleu. Il porte **l attention**, jamais la
validation ni le succes : un brouillon jamais relu, un marqueur d ecriture IA,
une generation en cours. S il se met a signaler du positif, il ne signale plus
rien.

### Formes et typographie, `app/renderer/src/design-system/tokens.css`

Tailles : `--font-size-2xs` 11px, `xs` 12, `sm` 13, `base` 14, `md` 15, `lg` 16,
`xl` 17, `2xl` 22, `3xl` 34.

Graisses : `--font-weight-regular` 400, `medium` 500, `semibold` 600,
`title` 620, `eyebrow` 680, `bold` 800, `thin` 250.

Arrondis : `--radius-xs` 3px pour les etiquettes, `--radius-sm` et `--radius-md`
4px pour tout le reste, `--radius-circle` pour les pastilles.

Interlettrage : `--tracking-eyebrow` sur les capitales, `--tracking-title` sur
les titres de 22px, `--tracking-display` sur le 34px.

Ombres : `--shadow-1` et `--shadow-2` valent `none`. **Les cartes sont
delimitees par un trait de un pixel, jamais par une ombre.** Seules les boites
de dialogue portent une ombre.

Les chiffres qui varient dans le temps ou qui s alignent en colonne portent
`font-variant-numeric: tabular-nums`, sinon la largeur saute a chaque
rafraichissement.

## Le cadre de page

Tout ecran est enveloppe dans la primitive `PageFrame` :

```tsx
import { PageFrame } from "../../design-system/primitives";

<PageFrame eyebrow="Cockpit" actions={<>...</>}>
  ...corps de l ecran...
</PageFrame>
```

Elle rend une barre d en-tete de 44px et un corps qui defile seul. **Le corps
est le seul conteneur defilant de l application.** Ne jamais ajouter
`overflow: auto` sur un ancetre, ne jamais donner de hauteur en `vh` a un
contenu interne : cela reintroduit le defaut corrige.

Le surtitre nomme l ecran, pas l action en cours. Les actions de portee ecran
vont dans `actions`, celles de portee contenu restent dans le corps.

## Contraintes fermes

- **Aucun emoji.** Icones SVG uniquement, via `design-system/primitives/icons`.
- **Aucun cadratin** (U+2014) dans les textes affiches ni dans le code.
- **Francais parfaitement accentue** dans tout texte affiche, capitales
  comprises. Les commentaires de code restent sans accents, comme le reste du
  depot.
- **Aucune ressource reseau.** Ni police distante, ni image hebergee, ni CDN.
- **Les deux themes** sont traites. Verifier en clair et en sombre, jamais
  deduire l un de l autre.
- Ne pas modifier `styles.css`, `palette.css`, `tokens.css` ni `App.tsx` : ils
  appartiennent au chantier commun. Chaque ecran ecrit dans sa propre feuille.

## Ce qu il ne faut pas faire

La refonte precedente a echoue pour une raison identifiee : elle a applique de
la finition a des modules qui n avaient rien a dire. Le bloc le plus mis en
scene de l ecran principal affichait « Tout est en place ». Habiller un module
vide le rend plus visible sans le rendre plus utile.

Donc : si un bloc n apporte rien, le retirer plutot que le redessiner. C est une
reponse legitime et souvent la bonne.

## Portes de recette

Les portes se mesurent, elles ne s apprecient pas a l oeil. Sur ce projet, trois
correctifs de mise en page ont ete annonces comme faits alors qu ils ne l
etaient pas, parce que le verdict avait ete rendu par lecture du CSS.

- `npm run typecheck` a zero erreur
- `npm run lint` a zero erreur
- les tests de l ecran passent
- rendu verifie en theme clair **et** en theme sombre

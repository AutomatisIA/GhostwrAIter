# Audit code et architecture, 25 juillet 2026

Objet : que supprimer, que fusionner, que simplifier, dans la perspective d'un dépôt
open-source au code minimal.

Volumétrie de départ : 14 791 lignes sous `app/`, 7 337 sous `tests/`, 2 551 dans
`styles.css`. Sept dépendances d'exécution, 23 de développement.

**Correction sur ce chiffre :** les 14 791 lignes de `app/` ne sont pas toutes du code de
production. **1 466 lignes de tests y sont colocalisées**, réparties sur 19 fichiers
`*.test.ts(x)` (par exemple `app/renderer/src/feedback/useAiProgress.test.ts`, 293
lignes). Environ 10 % du total annoncé est donc du test. Deux conventions concurrentes
coexistent dans le dépôt : tests colocalisés sous `app/`, et tests séparés sous
`tests/unit/` (7 337 lignes). À trancher, une seule convention.

Note de méthode : `grep` est un proxy shell sur cette machine et ne respecte pas
correctement plusieurs `--include` combinés. Toutes les mesures de cet audit utilisent
`command grep` ou `ripgrep`.

Portes de qualité au moment de l'audit : typecheck 0 erreur, lint 0, 487 tests verts.

---

## 1. Le CSS legacy ne se purge pas, il se cible

La tâche T052 héritée de la feature 010 s'appelle « purge du CSS legacy ». Elle ne peut
pas s'exécuter comme une purge.

Méthode : extraction des 244 noms de classe de `styles.css`, puis recherche de chacun,
en mot entier et en sous-chaîne pour capter les gabarits de chaîne, dans tout
`app/renderer/src/**/*.{ts,tsx}` et `index.html`.

**225 classes sur 244 (92 %) sont encore référencées par du JSX.** Le design-system
`.ds-*` est une surcouche ajoutée par-dessus le legacy, pas un remplacement.

Réellement mort, vérifié classe par classe : **17 classes, au moins 147 lignes.**

| Classe | Lignes |
|---|---|
| `.status-grid` | 255-260 |
| `.empty-state` | 355-358 |
| `.status-card` et enfants | 578-583, 594-602 |
| `.hero-card`, `.hero-actions`, `.hero-chip` | 609-635 |
| `.checklist-card`, `.flat-checklist`, `.strategy-example-text` | 647-702 |
| `.skeleton-card` | 734-746 |
| `.correction-recommended`, `.capability-grid`, `.capability-chip`, `.run-explainer` | 934-973 |
| `.idea-card` et variantes | 1557-1578 |

Deux pièges relevés, à ne pas déclencher :

- `.settings-run-status--succeeded` et `--failed` **paraissent morts** en recherche
  littérale mais sont construits en gabarit dans `DiagnosticsPanel.tsx:96`
  (`` `settings-run-status--${run.status}` ``). Vivants, ne pas toucher.
- `@keyframes skeleton-shift` (748-756) doit survivre à la suppression de
  `.skeleton-card` : il est réutilisé par `.ds-skeleton` ligne 2202.

147 est un plancher : la détection d'usage compte en sous-chaîne, donc elle surestime le
vivant.

---

## 2. Code mort, vérifié par recherche du symbole exact

### Suppression sûre immédiate, aucun test, environ 11 lignes

| Symbole | Emplacement |
|---|---|
| `StrategyRepository.getCounts()` | `strategy.repository.ts:299-305` |
| type `RowWithCount` | `strategy.repository.ts:8`, ne sert qu'à la méthode ci-dessus |
| `themePreferenceSchema` | `shared/schemas/settings.ts:5`, composé nulle part |

### Mort côté interface mais câblé et testé, environ 300 lignes

Ce sont des décisions produit, pas du nettoyage réflexe.

| Méthode | Emplacement | Remarque |
|---|---|---|
| `workshop.createVariant` | `workshop.service.ts:465-537` | doublon de `library.createDivergentVariant` |
| `library.createVariantFromDraft` | `library.service.ts:57-171` | **troisième** implémentation du même besoin, score codé en dur à 0,84 ligne 117 contre 0,72 pour la version vivante |
| `workshop.createDraftFromContent` | `workshop.service.ts:552-627` | mort dans l'app, mais utilisé par `scripts/eval-editorial-quality.mjs:212` |
| `workshop.generateDraftFromIdea` | `workshop.service.ts:254` | raccourci complet câblé bout en bout, aucun bouton ne l'appelle |
| `execution.getDiagnostics` | `execution.service.ts:89-107` | jamais affiché |
| `settings.getAllPreferences` | `settings.service.ts:37-45` | jamais appelé par le renderer |

Sur les six, l'audit fonctionnel argumente que deux mériteraient d'être **branchées**
plutôt que supprimées : `generateDraftFromIdea` offrirait le parcours rapide qui manque,
et `getDiagnostics` renvoie le message le plus honnête de l'application.

### Ni mort ni vivant

`app/main/runner/` et `app/main/logging/` sont deux dossiers vides, résidus de refactor.
Zéro ligne, hygiène seulement.

Aucune dépendance npm morte : les 7 dépendances d'exécution et les 23 de développement
sont toutes utilisées, y compris celles qui ne le sont que par configuration
(`jsdom` via des pragmas dans 20 fichiers de test, `electron-vite` via la configuration).

Aucun composant orphelin parmi les 104 fichiers source.

---

## 3. Duplication

| Duplication | Emplacement | Résolution |
|---|---|---|
| `buildRunnerContext` | `workshop.service.ts:888` et `library.service.ts:302`, environ 90 % identiques | extraire |
| `summarizeOffers` et `summarizeIcps` | mêmes deux fichiers, **identiques mot pour mot** | extraire, environ 40 lignes gagnées |
| Mapping SQL `VariantSourceRow` | `library.service.ts:58-76` et `212-230` | disparaît si la méthode morte est supprimée, rien à extraire |
| `createId` réimplémenté en ligne | `library.service.ts:82-83` et `236-237` | les premières disparaissent avec la méthode morte, seules `236-237` sont à corriger, 2 lignes |
| `find-codex-binary.ts` (154 l.) et `find-cli-binary.ts` (144 l.) | le second est la généralisation du premier | fusion possible, 120 à 140 lignes gagnées, **mais** les chemins Windows diffèrent réellement (`Codex\bin` contre `nodejs`) : il faut une table par binaire d'abord, pas une suppression sèche |

À noter : `find-codex-binary` a 214 lignes de tests dédiés, `find-cli-binary` (utilisé par
Claude et Gemini) n'en a **aucun**. C'est cohérent avec le fait, établi par l'audit
fonctionnel, que ces deux moteurs n'avaient jamais été exercés.

Points sains à ne pas retoucher : les 8 fichiers `app/main/ipc/*.ts` passent tous par
`registerValidatedHandler`, zéro `ipcMain.handle` brut. Les écrans réutilisent tous les
primitives du design-system.

---

## 4. Tests à faible valeur, environ 600 lignes

| Fichier | Lignes | Verdict |
|---|---|---|
| `oss-metadata.test.ts` | 362 | teste le contenu texte de LICENSE, README, CONTRIBUTING. **Zéro valeur de régression.** Réduire à un test d'existence, environ 20 lignes |
| `ci-workflows.test.ts` | 325 | teste la structure YAML de 180 lignes de workflows, ratio 2:1, et ne couvre pas `auto-release.yml` qui est le plus gros. **Garder les 80 à 100 lignes d'assertions de sécurité** (aucun secret dans un `run:`, pas de `continue-on-error`), retirer le reste |
| `route-redirects.test.ts` | 37 | recopie à la main une table de routes sans importer le vrai code. Test fantôme, ne détecte aucune régression |

Effets de bord du nettoyage : la dépendance `yaml` n'est importée que par les deux
premiers, elle devient supprimable. `tests/e2e/` et `tests/integration/` ne contiennent
qu'un `.gitkeep`, `playwright.config.ts` pointe dans le vide et `@playwright/test` n'est
importé nulle part : toute l'infrastructure end-to-end est morte. À distinguer du paquet
`playwright` de base, bien vivant, utilisé par trois scripts d'audit.

---

## 5. Fichiers trop gros

| Fichier | Lignes | Cause |
|---|---|---|
| `workshop.service.ts` | 1093 | service fourre-tout |
| `LibraryScreen.tsx` | 762 | un seul composant gère deux onglets |
| `CockpitScreen.tsx` | 450 | JSX monolithique |
| `IdeaSelector.tsx` | 438 | trois parcours dans un composant |
| `library.service.ts` | 410 | passe sous 400 par la seule extraction du trio dupliqué |

Découpage proposé pour `workshop.service.ts`, en trois modules :

1. le pipeline éditorial, les 8 méthodes publiques ;
2. un calculateur de qualité, `computeDraftQualityScore` et `estimateDraftQuality`,
   lignes 989-1056 ;
3. un enregistreur d'exécutions, `persistExecutionRun`, `recordDraftVersion` et
   `syncDraftTags`, lignes 931-1093.

Pour `LibraryScreen.tsx` : extraire les deux onglets en `LibraryTab` et `PlanningTab`,
montés conditionnellement.

---

## 6. Bundle

1 134 ko en un seul morceau, parce que `App.tsx:11-15` importe les cinq écrans
statiquement et qu'aucun `React.lazy` n'existe dans le renderer.

Nuance honnête : Electron charge depuis le disque, il n'y a pas de coût réseau. Le gain
porte sur l'analyse et l'exécution au démarrage, pas sur le téléchargement.

Correctif simple : convertir les cinq imports d'écrans en `React.lazy` avec un
`<Suspense>` autour des routes. Chaque écran devient un morceau séparé, sans
réarchitecture. L'alternative `manualChunks` isolant un lot d'éditeurs tiers améliore le
cache mais n'a pas d'intérêt ici, faute de cache HTTP en local.

`motion`, utilisé dans 15 fichiers, est structurel au design-system animé : ce n'est pas
un candidat à la suppression.

---

## 7. Traces de l'ancien nom

`docs/architecture.md` est publié dans le dépôt public et contient des liens en **chemin
absolu** vers `/Users/philippe/Dev/LinkedIn-Poster/...`, c'est-à-dire le disque local du
mainteneur. Cassés pour tout cloneur, et ils exposent une arborescence privée. Correction
triviale, risque nul, à faire en premier.

Volumétrie du reste : 205 occurrences de « linkedin » dans 71 fichiers hors
`node_modules`. Mais `specs/` (plus de 40 fichiers) est **exclu du dépôt public** par le
`.gitignore` : hors sujet, ne pas y toucher.

Trois surfaces de risque distinct subsistent :

1. **La variable `LINKEDIN_POSTER_WORKSPACE_ROOT`** (`workspace.service.ts`, un seul
   fichier source). Attention : c'est un point de configuration **documenté
   publiquement** dans `docs/exploitation.md:136`. Un renommage sec la casse en silence
   pour qui l'a configurée. Soit assumer la rupture avec mention explicite au changelog,
   soit lire les deux noms en transition.
2. **L'API `window.linkedinPoster`** : déclarée dans `app/shared/env.d.ts:16`, exposée en
   `preload/index.ts:202`, consommée dans une quinzaine de fichiers du renderer. API
   interne préchargée, aucun client tiers : renommage mécanique en un commit, avec
   `npm run typecheck` comme filet.
3. **Les huit dossiers `skills/linkedin-*`** : référencés en dur dans 9 fichiers, dont un
   `switch` à 8 cas. Renommer un dossier revient ici à renommer un identifiant métier qui
   traverse tout le pipeline. Chantier séparé, avec les tests existants comme filet.

Ordre recommandé : corriger `architecture.md` seul et tout de suite, puis les surfaces 1
et 2 en une session, puis les dossiers `skills/` séparément.

---

## 8. Récapitulatif

| Action | Lignes gagnées | Risque |
|---|---|---|
| Purger les 17 classes CSS mortes | 147+ | faible, deux pièges identifiés |
| Réduire `oss-metadata` et `ci-workflows`, supprimer `route-redirects` | ~600 | faible, garder les assertions de sécurité |
| Supprimer les deux implémentations mortes de repurpose | ~190 | moyen, décision produit |
| Fusionner `find-codex-binary` et `find-cli-binary` | 120-140 | moyen, table de chemins Windows requise |
| Extraire `buildRunnerContext`, `summarizeOffers`, `summarizeIcps` | ~40 | faible |
| Supprimer `getCounts`, `RowWithCount`, `themePreferenceSchema` | ~11 | nul |
| Corriger les liens absolus de `architecture.md` | 20 liens | nul, à faire en premier |
| Découper les quatre gros fichiers | 0 net | moyen |
| `React.lazy` sur les cinq routes | 0 net | faible |

Total supprimable sans décision produit : environ **800 lignes**. Avec décisions produit :
environ **1 200**.

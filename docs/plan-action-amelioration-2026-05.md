# GhostwrAIter — Plan d'action d'amélioration (UX/design + qualité)

> **Document historique du 30 mai 2026.** Une grande partie des constats ci-dessous a été traitée depuis par les features 006, 010, 011 et 012, et par les audits du 25 juillet 2026 (`docs/audit-2026-07-*.md`). À lire comme une archive, pas comme un état des lieux.

> Date : 2026-05-30 · Base : v1.3.0 (`aa9f7fb`, main) · Investigation : 110 .md lus, eval exécutée, renderer audité, wiring tracé.

---

## 0. Corrections à l'audit précédent (`audit-technique-fonctionnel-2026-05.md`)

Trois affirmations de l'audit du 30/05 étaient **fausses** — vérifications faites depuis :

1. **« 2 skills orphelins (topic-generator, news-to-post) sans UI » → FAUX.** Les deux ont leurs boutons dans `app/renderer/src/features/create/components/IdeaSelector.tsx` :
   - `:204` bouton « Transformer en draft » → `createFromNewsSource()` (news-to-post)
   - `:238` bouton « Générer des sujets » → `generateFromStrategy()` (topic-generator)
   - Écran atteignable via la nav « Créer » (route `/creer`), redirections legacy `/idees`+`/atelier` incluses.
   - Chaîne complète : UI → preload (`index.ts:73-76`) → IPC (`ideas-ipc.ts:121-132`) → services → skill-runner. **Effort d'activation = 0, ils sont actifs.** L'erreur venait d'avoir cherché un composant `IdeasScreen` (nom de l'ancienne UX pré-009) au lieu de `IdeaSelector`.

2. **« eval:editorial jamais lancé / ne fonctionne pas » → nuancé.** Le harness fonctionne. Il était bloqué par deux causes concrètes (voir §2), désormais identifiées.

3. **Contexte refonte UX :** les specs **008 et 009 sont déjà mergées dans main** (v1.3.0). Les branches `008-debt-settings-purge` et `009-ux-overhaul` sont des pointeurs périmés (0 commit d'avance sur main). La refonte structurelle (nav 8→5, thème dark, multi-CLI, drawer responsive, loading states, mapping d'erreurs, confirmation purge) **est livrée**. Le « design catastrophique » est donc l'état **après** 009 — le problème n'est pas la structure, c'est la **couche visuelle** (§3).

---

## 1. Pourquoi les « skills orphelins » n'en étaient pas

Aucun chantier ici. Les deux modes d'entrée d'idées (veille→post, génération depuis stratégie) sont câblés et utilisables. À retirer de la liste des manques.

> Seul reproche valide voisin : les vrais prompts éditoriaux (30+ règles) sont en dur dans `codex-cli-runner.ts`, pas dans les `SKILL.md` (qui sont des stubs). C'est un sujet de **qualité éditoriale / itérabilité** (§4), pas de wiring.

---

## 2. eval:editorial — diagnostic et remise en marche

L'objectif d'`eval:editorial` : mesurer la qualité éditoriale réelle (12 fixtures A/B/C/D → vrais appels Codex → grille de notation → rapport `dist-eval/`). C'est la **mesure de vérité** du produit. Deux blocages, tous deux corrigeables :

### Blocage 1 — pas de build préalable (résolu)
Le harness lance l'app packagée (`electron.launch({ args: ["dist-electron/main/index.js"] })`, `eval-editorial-quality.mjs:255`). Sans `npm run build` au préalable, `dist-electron/` est absent → échec silencieux. Le script ne build pas tout seul.
- **Fix immédiat** : `npm run build` avant `npm run eval:editorial` (fait — build exit 0).
- **Fix durable** : ajouter une étape build (ou un check d'existence avec message clair) en tête du harness.

### Blocage 2 — fixtures périmées vs schéma Zod strict (à corriger)
Une fois buildé, les fixtures échouent en ~2 ms (pas un vrai appel Codex) avec :
```
BENCH_HARNESS_ERROR: input: Unrecognized key: "persona"
```
Les fixtures (`scripts/eval-editorial-fixtures.mjs`, datées du 12 avr) envoient une clé `persona` (lignes 79, 92, 105, 158, 175, 192, et la liste `requiredKeys.A` ligne 258). Le schéma Zod actuel (durci par la feature 003 IPC-validation, en mode strict) **ne connaît pas `persona`** → rejet avant tout appel IA. Les fixtures précèdent le durcissement du schéma / le refactor stratégie où la persona a migré dans les ICP.
- **Fix** : aligner les fixtures sur le contrat d'entrée actuel (retirer/renommer `persona`, vérifier chaque type A/B/C/D contre les schémas `app/shared/schemas/{ideas,workshop}.ts`). Petit chantier ciblé (~½ journée).
- **Garde-fou** : ajouter un test qui valide les fixtures contre les schémas Zod (échoue en CI si un contrat dérive). `validateFixtures()` existe déjà mais ne vérifie pas contre Zod.

> **Après ce fix**, lancer la suite complète (12 fixtures, vrais appels Codex, ~10-25 min) donne la première baseline qualité chiffrée. C'est le prérequis de tout travail éditorial.

---

## 3. Le vrai problème : la couche design visuel (post-009)

> **Vérifié visuellement le 30/05** (captures des 5 écrans light+dark, app buildée lancée via Playwright — `/tmp/ghost-shots/`). **Verdict honnête : l'app n'est PAS catastrophique structurellement.** C'est une UI B2B propre et fonctionnelle (sidebar, cartes, empty-states, thème dark correct, écran Paramètres soigné). Le ressenti « catastrophique » vient de **deux choses précises et visibles à l'écran** :
> 1. **Accents français manquants partout** (« STRATEGIE », « A definir », « Systeme », « Connecte », « DONNEES », « generer », « Publies », « QUALITE MOYENNE »…). C'est LE signal qui fait paraître l'app *cassée / non-professionnelle*. Plus fort impact perçu, plus faible effort.
> 2. **Fadeur / absence d'identité** : tout est gris-bleu plat, sans hiérarchie visuelle forte ni personnalité de marque → ça ressemble à un prototype de dev, pas à un produit fini.
>
> ⚠️ **Conséquence pour le plan** : des design tokens seuls donnent de la *cohérence*, pas de la *qualité*. Tokeniser le look actuel le figerait « fade mais cohérent ». C1 doit donc viser une **direction visuelle définie** (identité, hiérarchie, polish), pas juste systématiser l'existant.

La refonte 009 a réglé la **structure** (nav, écrans, thème, responsive). Ce qui reste à traiter est la **couche visuelle**, dont la cause racine technique est nette et mesurée :

### 3.1 Cause racine — pas de design tokens (hors couleurs)
`app/renderer/src/styles.css` (1252 lignes, CSS vanilla, zéro lib) définit des tokens **couleur** complets et theme-aware, mais **0 token** de spacing, radius, typographie, shadow, motion. Conséquences mesurées :
- **19 tailles de police en CSS + 19 en dur inline** (jusqu'à `2rem`) → aucune échelle typographique.
- **13 valeurs de border-radius** distinctes (4→24px + 999) → arrondis incohérents.
- **8 box-shadow** codées en dur.
- Tous les `padding`/`gap`/`margin` = magic numbers → aucun rythme vertical.

C'est **la** source du ressenti « brouillon ».

### 3.2 Pas de primitives React partagées
Aucun `<Button>`, `<Card>`, `<Tabs>`, `<Input>`. Conséquences :
- Pattern « onglets » réimplémenté **3 fois** à la main (Library `:264`, Strategy `:67`, ThemeSelector `:36`) + une 4e variante stepper (WorkshopGuide `:30`) — aucun n'a l'affordance ni l'ARIA d'un onglet.
- **Styles inline massifs** : Cockpit 41 occurrences `style={{}}`, Library 18, Strategy 14, Engine 13. Duplication directe (ex. metric-cards Cockpit `:195-235` répètent 4× le même bloc).

### 3.3 Accessibilité quasi nulle
- **1 seule** règle `:focus-visible` dans tout le CSS → aucun anneau de focus clavier sur boutons/liens/nav/onglets.
- **0** `role="tab"`/`aria-selected`/`aria-current` ; **0** `prefers-reduced-motion`.

### 3.4 Patterns UX douteux
- Hiérarchie de boutons inversée : « Lancer la correction premium » (action IA phare) en `secondary-button`, « Modifier le texte » en `primary` (DraftPanel `:125-156`).
- Confirmations destructives = changement du **label** du bouton en « Confirmer ? » (Library `:393`) plutôt qu'un vrai dialog.
- Pas d'empty-state pour les listes filtrées vides (Library `:334`, IdeaSelector `:292`).
- Mur de 5 boutons texte gris par carte (Library `:375`), feedback = une string `status` mutée (pas de toasts).
- Stepper : `step >= index+1` marque toutes les étapes passées comme « active » → aucune distinction complété/courant.

### 3.5 Contenu — accents français manquants
**13 fichiers, ~70 occurrences** (« strategie », « Idees », « Planifies », « Resume »…). Défaut de saisie, pas d'encodage. Pour un produit FR, c'est le signal de non-qualité le plus visible à l'écran.

### 3.6 À préserver (déjà bon)
Thème light/dark/system + persistance + listener `matchMedia`. Responsive drawer < 768px. Skeletons de chargement. Tokens couleur exhaustifs. Sections Stratégie (empty-states + completeness + aria-labels).

---

## 4. Plan d'action priorisé

> Chaque chantier non-trivial passe par le workflow spec-kit (`/speckit-flow`) au moment de l'implémentation. Ici = la roadmap, pas les specs.

### 🔴 P0 — Fondations (débloquent tout le reste)

**C4 (remonté en tête). Corriger les accents français.** *(~½ j, visibilité MAXIMALE)*
13 fichiers, ~70 chaînes. C'est le défaut le plus visible à l'écran (vérifié sur captures) et celui qui fait paraître l'app non-finie. **À faire en premier** — ratio impact/effort le plus élevé du plan. Bonus : les fixtures eval ont aussi des accents manquants dans leur contenu (« lui-meme », « idees »), à corriger pour ne pas pénaliser la notation.

**C1. Direction visuelle + design tokens + primitives React.** *(~3-4 j)*
D'abord **définir une cible visuelle** (identité, hiérarchie, densité, éventuellement maquette de référence) — sinon on systématise la fadeur actuelle. Puis : échelle de tokens en `:root` (spacing 4-6 steps, radius 3-4, type-scale 5-6, shadow 3, motion) ; primitives `<Button>` (primary/secondary/danger), `<Card>`, `<Tabs>` (ARIA), `<Field>` ; rebrancher le CSS et purger les 41+ styles inline. *Décision à trancher : garder le bleu LinkedIn `#0a66c2` actuel, ou la primaire AutomatisIA `#0EA5E9` (convention globale) ? Aujourd'hui `#0EA5E9` n'est que la couleur secondaire.*

**C2. Remettre eval:editorial en marche.** *(~1 j — révisé)*
**Trois blocages identifiés** (et non un) :
1. Pas de build préalable → `npm run build` d'abord (ou check en tête de harness).
2. Fixtures envoient `persona` (clé morte, non routée) rejeté par Zod strict → la **retirer** des 12 fixtures + de `requiredKeys`.
3. **Bug grader (vérifié) :** `generateFinalDraft` retourne `{ idea, draft: {headline, bodyMarkdown}, hooks, ... }` mais le grader lit `rawOutput.headline`/`bodyMarkdown` à plat → body lu à 0 char, FAIL artificiel. Corriger le mapping du grader (lire `.draft`) pour chaque skill (post-writer/news/editor peuvent différer).

> **Signal encourageant** : après avoir levé blocages 1+2, un fixture A1 a produit un **vrai post en 44s, de bonne qualité** (coût business concret, anti-hype, accents corrects). La qualité éditoriale des prompts semble déjà décente — c'est surtout la plomberie d'eval qui est cassée, pas forcément l'éditorial. À confirmer sur les 12 fixtures une fois le grader corrigé. **Prérequis de tout travail éditorial chiffré.**

**C3. Accessibilité de base.** *(~1 j)*
`:focus-visible` global (button/a/nav/input/onglets), `prefers-reduced-motion`, ARIA sur les onglets/steppers via `<Tabs>`. *(Se fait naturellement avec C1.)*

### 🟠 P1 — Qualité produit & UX cœur

**C5. Itérer la qualité éditoriale** (dépend de C2). Extraire les prompts inline (`codex-cli-runner.ts`) vers les `SKILL.md` pour itérer sans recompiler, puis boucler eval→ajustement jusqu'au litmus test (« ça sonne comme Philippe ? »). *(~3-5 j)*

**C6. Onboarding guidé d'install CLI** (P0 si cible grand public). Wizard premier lancement : détection OS/Node/CLI/auth → boutons d'action → re-check en boucle → choix moteur. Aujourd'hui inexistant (l'app fail-fast). *(~2-3 j)*

**C7. Système de feedback unifié (toasts)** remplaçant la string `status` et les confirmations « Confirmer ? » en label ; vrais dialogs destructifs. *(~1-2 j)*

**C8. Hiérarchie de boutons + empty-states** : corriger DraftPanel (correction premium en primaire), stepper complété/courant, empty-states pour listes filtrées (Library, IdeaSelector). *(~1 j, en partie absorbé par C1)*

### 🟡 P2 — Raffinements

**C9. Toolbar d'actions Library** (5 boutons texte → icônes/menu groupé) + filtres pilier/statut/typologie/qualité/date + diff source/variante. *(~2 j)*
**C10. UX d'erreur uniforme hors atelier** (Library/Calendrier) + ne plus avaler les erreurs presse-papier. *(~1 j)*
**C11. Affichage source Codex vs fallback** dans l'atelier + score qualité explicable. *(~1 j)*
**C12. États vides pédagogiques** sur toutes les pages + prévisualisation post lisible (compteur de longueur, lecture mobile). *(~1-2 j)*
**C13. Corriger l'edge-case ideaId orphelin** (supprimer une idée pendant un atelier actif → crash step 4). *(~½ j)*

### 🟢 P3 — Distribution (cf. audit précédent §1.3, hors UX)
Code signing macOS + notarization, signing Windows, auto-update (`electron-updater`), smoke-test CI par moteur CLI. Mettre à jour les docs produit obsolètes (parcours/guide/fonctionnalités décrivent l'ancienne UX 7 pages).

---

## 5. Séquencement recommandé

1. **C4 puis C1 + C3** (accents en quick-win immédiat, puis « direction visuelle + design system + a11y ») → transforme le ressenti visuel.
2. **C2** en parallèle (indépendant) → débloque la mesure qualité.
3. **C7 + C8** (s'appuient sur les primitives de C1).
4. **C5** (qualité éditoriale, le cœur de valeur, une fois eval mesurable).
5. **C6** quand la cible grand public se confirme.
6. P2/P3 ensuite.

**Premier pas concret** : C1 (design system) ET C2 (eval) — l'un règle le « catastrophique » visuel, l'autre rend la qualité mesurable. Les deux sont des fondations sans lesquelles le reste flotte.

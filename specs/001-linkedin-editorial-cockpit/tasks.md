# Tasks: LinkedIn Editorial Cockpit MVP

**Input**: Design documents from `/specs/001-linkedin-editorial-cockpit/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**TDD Rule**: Pour toute capacite metier testable, ecrire le test d'abord, verifier l'echec, implementer le minimum necessaire, puis refactor.

## Phase 1: Setup

**Purpose**: Poser le squelette technique du produit local-first.

- [ ] T001 Créer la structure applicative décrite dans `specs/001-linkedin-editorial-cockpit/plan.md`
- [ ] T002 Initialiser l'application desktop TypeScript avec Electron, Vite et React dans `app/`
- [ ] T003 [P] Configurer Vitest, Playwright et ESLint à la racine du repo
- [ ] T004 [P] Créer les répertoires workspace initiaux `content/`, `data/`, `logs/`, `skills/`, `config/`

---

## Phase 2: Foundational

**Purpose**: Mettre en place les fondations bloquantes avant les user stories.

- [ ] T005 Configurer SQLite et le client d'accès local dans `app/main/db/`
- [ ] T006 [P] Implémenter les schémas de validation Zod pour les entités métier dans `app/shared/schemas/`
- [ ] T007 [P] Implémenter le moteur de création du workspace local dans `app/main/workspace/`
- [ ] T008 Implémenter le runner d'exécution de skills et le journal `ExecutionRun` dans `app/main/runner/`
- [ ] T009 [P] Implémenter la couche IPC sécurisée entre Electron et le renderer dans `app/preload/` et `app/main/ipc/`
- [ ] T010 Implémenter la gestion d'erreurs et des logs lisibles dans `app/main/logging/`

**Checkpoint**: L'application peut démarrer localement, initialiser son workspace, lire/écrire la base et enregistrer un run de skill.

---

## Phase 3: User Story 1 - Configurer la base strategique (Priority: P1) 🎯 MVP

**Goal**: Permettre la creation et la persistance du socle editorial.

**Independent Test**: L'utilisateur peut saisir sa strategie, fermer l'application, puis retrouver les donnees intactes.

### Tests for User Story 1

- [ ] T010A [US1] Verifier l'echec initial des tests US1 avant implementation
- [ ] T011 [P] [US1] Écrire les tests repository pour `profiles`, `offers`, `icps`, `voice_rules` dans `tests/unit/strategy-repositories.test.ts`
- [ ] T012 [P] [US1] Écrire les tests d'intégration IPC pour la sauvegarde/relecture de stratégie dans `tests/integration/strategy-ipc.test.ts`

### Implementation for User Story 1

- [ ] T013 [P] [US1] Implémenter les repositories stratégie dans `app/main/domains/strategy/`
- [ ] T014 [P] [US1] Créer l'écran `Strategie` et ses formulaires dans `app/renderer/src/features/strategy/`
- [ ] T015 [US1] Ajouter la synchronisation IPC pour charger et sauvegarder le socle stratégique
- [ ] T016 [US1] Générer les fichiers de contexte éditorial exportables dans `content/strategy/`

**Checkpoint**: Le socle stratégique est fonctionnel et testable indépendamment.

---

## Phase 4: User Story 2 - Produire un post guide pas a pas (Priority: P1)

**Goal**: Offrir l'atelier de production complet autour des skills.

**Independent Test**: A partir d'une idée brute, l'utilisateur obtient un draft corrigé avec hooks et variantes.

### Tests for User Story 2

- [ ] T016A [US2] Verifier l'echec initial des tests US2 avant implementation
- [ ] T017 [P] [US2] Écrire les tests du runner sur le contrat `runner-skill-io` dans `tests/unit/runner-contract.test.ts`
- [ ] T018 [P] [US2] Écrire les tests d'intégration du workflow atelier dans `tests/integration/editorial-workflow.test.ts`

### Implementation for User Story 2

- [ ] T019 [P] [US2] Implémenter le domaine `ideas` dans `app/main/domains/ideas/`
- [ ] T020 [P] [US2] Implémenter le domaine `drafts`, `draft_versions`, `hooks`, `variants` dans `app/main/domains/content/`
- [ ] T021 [P] [US2] Créer les définitions minimales des 8 skills V1 dans `skills/`
- [ ] T022 [US2] Implémenter le service d'orchestration du workflow éditorial dans `app/main/domains/editorial-workflow/`
- [ ] T023 [US2] Construire l'écran `Idées` dans `app/renderer/src/features/ideas/`
- [ ] T024 [US2] Construire l'écran `Atelier de production` dans `app/renderer/src/features/workshop/`
- [ ] T025 [US2] Afficher le contexte utilisé, les sorties structurées et les recommandations de correction dans l'UI

**Checkpoint**: Le parcours idée → draft validable fonctionne sans dépendre des autres user stories.

---

## Phase 5: User Story 3 - Capitaliser les contenus dans une bibliotheque locale (Priority: P2)

**Goal**: Retrouver, filtrer et réutiliser les contenus produits.

**Independent Test**: L'utilisateur peut rechercher un draft existant et en générer une variante.

### Tests for User Story 3

- [ ] T025A [US3] Verifier l'echec initial des tests US3 avant implementation
- [ ] T026 [P] [US3] Écrire les tests de recherche locale et tags dans `tests/unit/library-search.test.ts`
- [ ] T027 [P] [US3] Écrire les tests d'intégration bibliothèque/réouverture de draft dans `tests/integration/library-flow.test.ts`

### Implementation for User Story 3

- [ ] T028 [P] [US3] Implémenter les tables `tags` et `tag_links` dans la couche DB
- [ ] T029 [US3] Implémenter les services de recherche locale et filtres dans `app/main/domains/library/`
- [ ] T030 [US3] Construire l'écran `Bibliothèque` dans `app/renderer/src/features/library/`
- [ ] T031 [US3] Ajouter l'action `Créer une variante` depuis un draft sauvegardé

**Checkpoint**: La bibliothèque est testable et apporte de la valeur sans le calendrier.

---

## Phase 6: User Story 4 - Planifier la production editoriale (Priority: P3)

**Goal**: Permettre une planification simple des contenus.

**Independent Test**: Un draft peut être assigné à une date et retrouvé dans une vue calendrier.

### Tests for User Story 4

- [ ] T031A [US4] Verifier l'echec initial des tests US4 avant implementation
- [ ] T032 [P] [US4] Écrire les tests repository de `calendar_items` dans `tests/unit/calendar-repository.test.ts`
- [ ] T033 [P] [US4] Écrire les tests d'intégration de planification dans `tests/integration/calendar-flow.test.ts`

### Implementation for User Story 4

- [ ] T034 [P] [US4] Implémenter le domaine `calendar` dans `app/main/domains/calendar/`
- [ ] T035 [US4] Construire l'écran `Calendrier` dans `app/renderer/src/features/calendar/`
- [ ] T036 [US4] Relier idées et drafts à la planification depuis l'atelier et la bibliothèque

**Checkpoint**: La planification simple fonctionne sans automatisation de publication.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T037 [P] Documenter l'installation locale et le diagnostic runner dans `README.md`
- [ ] T038 Ajouter l'export complet du workspace dans `app/main/domains/export/`
- [ ] T039 Ajouter la purge locale des logs et contenus sensibles dans `app/main/domains/privacy/`
- [ ] T040 [P] Finaliser la navigation, les raccourcis clavier et les états de reprise utilisateur
- [ ] T041 Exécuter la validation décrite dans `specs/001-linkedin-editorial-cockpit/quickstart.md`

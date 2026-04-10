# Research: LinkedIn Editorial Cockpit MVP

**Branch**: `001-linkedin-editorial-cockpit` | **Date**: 2026-04-10

## Scope of this research

Cette recherche transforme le cahier des charges en decisions techniques concretes pour un MVP local-first. Elle couvre les choix structurants qui conditionnent l'architecture, les skills, le stockage et le workflow utilisateur.

---

## Decision 1: Build a desktop app, not a browser-only local web app

**Decision**: Utiliser une application desktop locale basee sur Electron avec une interface React.

**Why**:
- Le produit doit orchestrer des executions locales de Codex, lire/ecrire des fichiers, gerer des logs, exporter le workspace et fonctionner correctement hors ligne pour les fonctions non generatives.
- Une simple web app locale complexifierait l'acces systeme et la gestion du runner.
- Electron offre une voie directe pour integrer filesystem, processus enfants et SQLite dans un MVP pragmatique.

**Alternatives considered**:
- **Tauri**: plus leger, mais ajout d'une complexite Rust inutile pour un MVP centré sur productivite et iterabilite rapide.
- **Next.js web app locale**: bon DX UI, mais moins adapte au pilotage de processus et au stockage de workspace local comme source de verite.

**Consequence**:
- L'architecture sera separee entre processus principal Electron, couche IPC, UI React et services de domaine locaux.

---

## Decision 2: Store operational data in SQLite and editorial assets on disk

**Decision**: Utiliser SQLite pour les entites relationnelles et des fichiers Markdown/JSON pour les contenus exportables et les assets editoriaux.

**Why**:
- Le cahier des charges demande un stockage local durable, sauvegardable facilement et compatible avec l'export complet du workspace.
- SQLite convient bien pour les entites structurees: ideas, drafts, runs, calendar items, tags, versions.
- Les contenus editoriaux et skills gagnent a rester visibles et portables sur disque.

**Alternatives considered**:
- **Tout en fichiers JSON/Markdown**: trop fragile pour la recherche, le versioning, les filtres et les relations.
- **Base embarquee plus complexe**: inutile pour une application mono-utilisateur.

**Consequence**:
- Le workspace local contiendra a la fois une base SQLite et des repertoires `content/`, `skills/` et `exports/`.

---

## Decision 3: Use typed domain contracts for all skill executions

**Decision**: Toute execution de skill passe par un contrat JSON canonique, avec un rendu Markdown optionnel en sortie.

**Why**:
- Le cahier des charges identifie le parsing fragile comme risque fort.
- Les briques editoriales doivent etre orchestrables par l'application et reutilisables sans logique implicite dans l'UI.
- Les runs doivent etre journalisables et rejouables.

**Alternatives considered**:
- **Markdown only**: lisible, mais trop instable pour l'integration applicative.
- **Prompt free-form par ecran**: contraire a la logique de systeme editorial modulaire.

**Consequence**:
- Chaque skill definira un schema d'entree et de sortie versionne.
- L'application validera ces payloads avec Zod avant persistence.

---

## Decision 4: Implement the MVP around guided editorial workflow, not generic workspace tooling

**Decision**: La V1 couvre uniquement les ecrans et actions directement relies au flux strategie -> ideation -> redaction -> correction -> bibliotheque -> calendrier.

**Why**:
- Le principal risque du projet est le scope.
- Le cahier des charges insiste sur un parcours guide et une valeur coeur tres nette.
- Les fonctions nice-to-have, comme automatisation avancee de veille ou publication automatique, peuvent venir ensuite.

**Alternatives considered**:
- **Ajouter des integrations de veille/web automation des la V1**: augmente fortement la complexite et les risques.
- **Ajouter publication LinkedIn native**: hors perimetre MVP.

**Consequence**:
- La veille V1 sera manuelle ou semi-assistee.
- La sortie finale prioritaire reste l'assistance a la production, pas la diffusion automatisee.

---

## Decision 5: Keep skills as project-local assets with room for future externalization

**Decision**: Les skills de la V1 vivent dans `skills/` du projet et peuvent inclure `SKILL.md`, templates et schemas.

**Why**:
- Le projet doit rester personnel et facilement transportable.
- Les briques identifiees par le PDF d'origine et le cahier des charges sont stables et bien definies.
- Le fait de garder ces assets dans le repo facilite l'iteration et la version.

**Alternatives considered**:
- **Skills globales hors projet**: plus difficile a sauvegarder et moins coherent avec l'export workspace.
- **Prompts directement dans le code**: contraire a la separation moteur cognitif / application.

**Consequence**:
- Le repo sera a la fois produit applicatif et environnement editorial versionne.

---

## Decision 6: Favor a service-oriented local architecture over full CQRS/event sourcing

**Decision**: Utiliser une architecture simple a services locaux: repositories, runner services, workflow services, UI state orchestration.

**Why**:
- Le MVP a besoin de clarte et de vitesse d'execution, pas d'une architecture enterprise.
- Le besoin de trace existe deja via `ExecutionRun`, sans imposer une infrastructure event sourcing complete.

**Alternatives considered**:
- **Event sourcing complet**: trop couteux pour le MVP.
- **Architecture monolithique sans separation**: rendrait plus difficile la testabilite et l'evolution des skills.

**Consequence**:
- Les domaines seront separes sans sur-architecturer: strategy, content, execution, calendar, library.

---

## Decision 7: Use human-readable logs plus structured execution logs

**Decision**: Conserver pour chaque run un log structure en base et un log texte lisible.

**Why**:
- Le debogage du runner Codex et des skills est une exigence du cahier des charges.
- L'utilisateur doit comprendre ce qui s'est passe sans devoir inspecter du JSON brut seulement.

**Consequence**:
- Le moteur d'execution stockera inputs, outputs, statut, timestamps, erreurs, chemins de fichiers et resume lisible.

---

## Clarification outcomes integrated into design

- Le MVP cible macOS en priorite, avec architecture desktop uniquement.
- Le versioning de contenu repose sur des snapshots persistés a chaque transition majeure, pas sur un systeme de diff.
- La publication automatique, la veille automatisee et les integrations externes de calendrier sont explicitement hors scope V1.
- La recherche V1 reste deterministe et locale; aucune couche semantique n'est requise pour livrer le coeur de valeur.

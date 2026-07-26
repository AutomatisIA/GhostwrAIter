# Architecture

## Vue d'ensemble

GhostwrAIter est une application Electron local-first organisee en 3 couches:

- `main`: backend Electron, base SQLite, services metier, IPC, execution Codex
- `preload`: pont securise entre Electron et le renderer
- `renderer`: interface React qui pilote les workflows

Le point cle est simple:

- le `renderer` ne parle jamais directement a SQLite ni a Codex
- il appelle des APIs exposees par `preload`
- `preload` relaie ces appels vers des handlers IPC
- les handlers deleguent aux services metier du `main`

## Arborescence utile

- `app/main/index.ts`
  Point d'entree Electron. Cree la fenetre, initialise le workspace, ouvre la base, instancie les services, enregistre les handlers IPC.
- `app/main/workspace/workspace.service.ts`
  Cree et garantit la structure locale du workspace.
- `app/main/db/database.ts`
  Ouvre la base SQLite.
- `app/main/ipc/*.ts`
  Façade IPC par domaine.
- `app/main/domains/*`
  Logique metier par domaine.
- `app/preload/index.ts`
  Expose l'API `window.linkedinPoster.*` au renderer.
- `app/renderer/src/*`
  Ecrans React, navigation, styles.
- `app/shared/types/*`
  Contrats partages entre `main`, `preload` et `renderer`.

## Demarrage de l'application

Au lancement, [index.ts](app/main/index.ts) fait les etapes suivantes:

1. Resout le chemin du workspace.
2. Cree les dossiers requis si besoin.
3. Ouvre la base SQLite.
4. Instancie `CodexCliRunner` puis `SkillRunnerService`.
5. Instancie les services metier:
   - strategie
   - idees
   - atelier
   - bibliotheque
   - calendrier
   - execution
   - parametres
6. Enregistre les handlers IPC.
7. Cree la fenetre Electron.

## Workspace local

Le workspace est gere par [workspace.service.ts](app/main/workspace/workspace.service.ts).

Structure creee:

- `content/strategy`
- `content/ideas`
- `content/drafts`
- `content/published`
- `content/research`
- `content/exports`
- `data`
- `logs/executions`
- `skills`
- `config`

Base SQLite:

- `data/ghostwraiter.db`

Le chemin peut etre force via `LINKEDIN_POSTER_WORKSPACE_ROOT`.

## Couche Electron

### Main

Responsabilites:

- acceder au systeme de fichiers
- ouvrir SQLite
- executer Codex CLI
- ecrire les logs d'execution
- exposer les workflows via IPC

### Preload

[index.ts](app/preload/index.ts) expose un objet unique:

- `window.linkedinPoster.strategy`
- `window.linkedinPoster.ideas`
- `window.linkedinPoster.workshop`
- `window.linkedinPoster.library`
- `window.linkedinPoster.calendar`
- `window.linkedinPoster.execution`
- `window.linkedinPoster.settings`

### Renderer

Le renderer React consomme ces APIs preload comme un client applicatif. Il ne connait ni SQLite ni `codex exec`.

## Domaines metier

### Strategie

- repository: [strategy.repository.ts](app/main/domains/strategy/strategy.repository.ts)
- service IPC: [strategy-ipc.ts](app/main/ipc/strategy-ipc.ts)

Responsabilites:

- sauver le bundle strategique
- relire le bundle actif
- generer le socle editorial via `linkedin-strategy-foundation`

### Idees

- repository: [ideas.repository.ts](app/main/domains/ideas/ideas.repository.ts)
- service IPC: [ideas-ipc.ts](app/main/ipc/ideas-ipc.ts)

Responsabilites:

- creer une idee manuelle
- lister le backlog
- transformer une source de veille en draft
- generer des sujets depuis la strategie

### Atelier

- service: [workshop.service.ts](app/main/domains/workshop/workshop.service.ts)
- service IPC: [workshop-ipc.ts](app/main/ipc/workshop-ipc.ts)

Responsabilites:

- suggerer une structure
- generer des hooks
- generer un draft final
- corriger un draft
- creer une variante
- persister les runs, versions, hooks, tags et brouillons

### Bibliotheque

- service: [library.service.ts](app/main/domains/library/library.service.ts)
- service IPC: [library-ipc.ts](app/main/ipc/library-ipc.ts)

Responsabilites:

- lister les drafts
- filtrer/rechercher
- creer une variante depuis un draft existant

### Calendrier

- service: [calendar.service.ts](app/main/domains/calendar/calendar.service.ts)
- service IPC: [calendar-ipc.ts](app/main/ipc/calendar-ipc.ts)

Responsabilites:

- planifier un draft
- lister les contenus dates

### Execution

- services: [skill-runner.service.ts](app/main/domains/execution/skill-runner.service.ts), [codex-cli-runner.ts](app/main/domains/execution/codex-cli-runner.ts), [execution.service.ts](app/main/domains/execution/execution.service.ts)
- service IPC: [execution-ipc.ts](app/main/ipc/execution-ipc.ts)

Responsabilites:

- detecter la disponibilite de Codex
- executer les skills via `codex exec`
- valider le contrat de sortie par skill
- remonter une erreur si le contrat n'est pas respecte
- lister les runs et diagnostics

### Parametres / exploitation locale

- export: [export.service.ts](app/main/domains/export/export.service.ts)
- privacy/log cleanup: [privacy.service.ts](app/main/domains/privacy/privacy.service.ts)
- service IPC: [settings-ipc.ts](app/main/ipc/settings-ipc.ts)

## Base de donnees

SQLite est utilise comme source de verite locale.

Tables principales creees par les services:

- strategie:
  - `profiles`
  - `offers`
  - `icps`
  - `pillars`
  - `voice_rules`
- production:
  - `ideas`
  - `drafts`
  - `draft_versions`
  - `hooks`
  - `tags`
  - `tag_links`
- execution:
  - `execution_runs`
- planification:
  - `calendar_items`

## Flux d'une generation

Exemple `idee -> atelier -> draft`:

1. Le renderer cree ou selectionne une idee.
2. `preload` appelle `ipcRenderer.invoke`.
3. Le handler IPC appelle le service metier.
4. Le service construit le contexte runner.
5. `SkillRunnerService` verifie que Codex est disponible.
6. `CodexCliRunner` appelle `codex exec`.
7. La sortie JSON est relue et validee.
8. Le service persiste draft, hooks, versions et run.
9. Le resultat remonte au renderer.

## Principe de stricte execution

Le systeme n'utilise plus de fallback degrade.

Regle actuelle:

- si Codex n'est pas disponible: erreur
- si Codex renvoie un payload hors contrat: erreur
- si une source est trop faible: erreur
- si la sortie n'est pas jugée publiable par le skill: echec explicite attendu

Cela s'applique notamment a:

- `strategy-foundation`
- `structure-selector`
- `hook-engine`
- `post-writer`
- `post-editor`
- `repurpose`
- `news-to-post`
- `topic-generator`

## Logs et traçabilité

Les runs sont traces dans:

- la table `execution_runs`
- les logs JSON dans `logs/executions` quand le service ecrit un log fichier

Chaque run peut contenir:

- le skill execute
- le resume
- le statut
- l'input JSON
- l'output JSON
- un message d'erreur

## Limites techniques actuelles

- Le projet depend de `better-sqlite3`, donc l'environnement Node local doit rester coherent avec l'ABI attendue.
- Les tests Node complets peuvent casser si `better-sqlite3` a ete rebuild pour une autre cible que le Node local.
- La qualite editoriale depend fortement de la richesse du contexte strategie transmis aux skills.

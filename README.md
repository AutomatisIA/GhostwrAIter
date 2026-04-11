# LinkedIn Poster - Editorial Cockpit

LinkedIn Poster est une application desktop local-first pour consultants IA, conçue pour orchestrer la production de contenus LinkedIn haute qualité via des "skills" spécialisées (propulsées par Codex).

## Documentation

- `docs/guide-decouverte.md` : comprendre le produit sans contexte préalable
- `docs/fonctionnalites.md` : ce que fait chaque page et pourquoi elle existe
- `docs/parcours-utilisateur.md` : mode d'emploi concret page par page pour un premier usage
- `docs/architecture.md` : structure technique de l'application et circulation des donnees
- `docs/skills-codex.md` : skills supportees, contrats attendus et cas d'echec
- `docs/exploitation.md` : installation, diagnostic, audits reels, limites connues
- `docs/audit-pages-2026-04-11.md` : audit réel page par page et dette UX restante
- `TODO.md` : ameliorations encore possibles

## Architecture

- **Frontend**: React 19 + TypeScript + Vite.
- **Backend**: Electron (Node.js 20).
- **Stockage**: SQLite (via Drizzle ORM / better-sqlite3) + Système de fichiers local.
- **Moteur d'IA**: Codex CLI en mode strict, sans fallback degradé.

## Installation

1.  **Prérequis**: Node.js 20+ installé.
2.  **Installation des dépendances**:
    ```bash
    npm install
    ```
3.  **Initialisation du Workspace**:
    ```bash
    npm run db:init
    ```
    Cette commande crée les répertoires `content/`, `data/`, `logs/` et initialise la base SQLite.

## Lancement

```bash
npm run dev
```

La commande reconstruit automatiquement `better-sqlite3` pour l'ABI d'Electron avant de lancer l'application.

## Lanceur macOS

Pour generer une vraie application macOS ouvrable sans terminal :

```bash
npm run package:mac
```

Le build produit une application `.app` dans `dist-app/mac/LinkedIn Poster.app`.

Tu peux ensuite :

- l'ouvrir depuis le Finder
- la glisser dans `Applications`
- l'epingler au Dock

Attention: cette application packagee est une photo de l'etat du code au moment ou `npm run package:mac` a ete lance. Si tu modifies le repo ensuite, elle ne se met pas a jour toute seule.

## Lanceur "toujours a jour" pour macOS

Si tu veux un lanceur qui ouvre la derniere version locale du repo sans passer par un terminal visible :

```bash
npm run make:mac-launcher
```

Cela genere `dist-launcher/LinkedIn Poster Launcher.app`.

Ce lanceur :

- ferme l'instance en cours si besoin
- reconstruit et repackage l'application a partir du code local courant
- ouvre ensuite la nouvelle version

Ce lanceur reprend l'icone de l'application Electron et s'affiche comme `LinkedIn Poster` dans le Dock. Tu peux l'epingler a la place de l'application packagee figee.

Si tu veux simplement faire la meme chose depuis une commande shell :

```bash
npm run open:mac:latest
```

## Workflow Editorial

1.  **Stratégie**: Définissez votre socle (Profil, Offres, ICP, Règles de voix).
2.  **Idées**: Capturez vos idées dans le backlog.
3.  **Atelier**: Transformez une idée en post via le stepper guidé (Typologie -> Structure -> Hook -> Draft).
4.  **Bibliothèque**: Capitalisez vos drafts, créez des variantes.
5.  **Calendrier**: Planifiez votre présence éditoriale.

## Diagnostics et Runner

L'application utilise un système de "Runner" pour exécuter les skills.

- **Mode Codex**: si le CLI Codex est détecté et opérationnel, l'application délègue les générations à Codex.
- **Mode indisponible**: si Codex n'est pas disponible ou ne respecte pas le contrat attendu, l'application remonte une erreur explicite et n'essaie pas de produire une sortie dégradée.

Pour voir les logs d'exécution :
```bash
# Les logs JSON sont stockés dans le répertoire logs/
ls logs/executions/
```

## Tests

Le projet suit une approche TDD stricte.

```bash
# Tests unitaires et d'intégration
npm test

# Tests E2E (Playwright)
npm run test:e2e
```

La commande `npm test` reconstruit automatiquement `better-sqlite3` pour l'ABI du Node local avant d'exécuter Vitest.

Un audit réel Electron rejouable est aussi disponible :

```bash
node scripts/real-app-audit.mjs
```

## Confidentialité

Toutes les données (stratégie, drafts, idées) restent **locales** sur votre machine dans le répertoire du projet. Aucune donnée n'est envoyée à un serveur tiers, excepté les prompts envoyés au runner Codex si configuré.

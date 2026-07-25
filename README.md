# GhostwrAIter

Produisez des posts LinkedIn de qualite professionnelle, en local, avec l'IA de votre choix.

GhostwrAIter est une application desktop qui guide la production editoriale de A a Z : strategie, ideation, redaction structuree, correction, capitalisation et planification. Le contenu reste sur votre machine. Pas de backend cloud, pas de compte a creer, pas de donnees qui sortent.

L'application utilise un assistant IA externe (ChatGPT, Claude ou Gemini) via votre propre abonnement pour generer les contenus. Vous gardez le controle editorial a chaque etape.

---

## Installation

### Option A — Installeur (recommande)

Telechargez la derniere version depuis les [Releases GitHub](https://github.com/AutomatisIA/GhostwrAIter/releases) :

| Plateforme | Fichier |
|------------|---------|
| **macOS (Apple Silicon)** | `GhostwrAIter-x.x.x-arm64.dmg` |
| **macOS (Intel)** | `GhostwrAIter-x.x.x-x64.dmg` |
| **Windows** | `GhostwrAIter-x.x.x-setup.exe` |
| **Linux** | `GhostwrAIter-x.x.x.AppImage` |

Ouvrez le `.dmg`, glissez l'application dans le dossier Applications, et lancez-la depuis le Dock ou Spotlight.

### Option B — Depuis les sources (developpeurs)

Prerequis : [Node.js 20+](https://nodejs.org/) et [Git](https://git-scm.com/).

```bash
git clone https://github.com/AutomatisIA/GhostwrAIter.git
cd GhostwrAIter
npm ci
npm run dev
```

---

## Configurer un moteur IA

L'application a besoin d'un assistant IA pour generer les contenus. Installez celui qui correspond a votre abonnement :

**Codex** (ChatGPT Plus ou Team)
```bash
npm install -g @openai/codex
codex login
```

**Claude Code** (Claude Pro ou Team)
```bash
npm install -g @anthropic-ai/claude-code
claude login
```

**Gemini CLI** (Google AI Premium)
```bash
npm install -g @google/gemini-cli
gemini login
```

L'application detecte automatiquement les CLI installes. Vous pouvez en installer plusieurs et basculer dans Parametres > Moteur.

> **Pas encore d'abonnement ?** L'application fonctionne avec un compte gratuit sur certains services, mais les limites de generation seront plus basses. Un abonnement payant est recommande pour un usage editorial regulier.

---

## Ce que fait l'application

| Ecran | Role |
|-------|------|
| **Cockpit** | Vue d'ensemble du pipeline editorial, prochaine action recommandee, metriques |
| **Strategie** | Positionnement, offres, ICPs, piliers editoriaux, regles de voix |
| **Creer** | Capturer une idee (manuelle, veille, generation) puis la transformer en post via un workflow en 4 etapes |
| **Bibliotheque** | Retrouver les drafts, creer des variantes, planifier la publication |
| **Parametres** | Theme clair/sombre, choix du moteur IA, diagnostics, export |

Le workflow de production suit 4 etapes guidees :
1. **Cadrage** — choisir la typologie et l'objectif du post
2. **Structure** — selectionner un schema narratif adapte
3. **Accroche** — generer et choisir la premiere phrase
4. **Redaction** — produire le post complet, corriger, iterer

---

## Architecture

- **Electron** 41 — shell desktop multi-plateforme
- **React** 19 + **Vite** 7 — interface utilisateur
- **SQLite** — stockage local (zero serveur)
- **8 skills IA** — chaque etape du workflow est un prompt specialise avec un contrat d'entree/sortie structure

Les donnees sont stockees dans le dossier de donnees utilisateur de l'application : `~/Library/Application Support/GhostwrAIter/workspace` sur macOS, `~/.config/GhostwrAIter/workspace` sur Linux, `%APPDATA%\GhostwrAIter\workspace` sur Windows. Pour deplacer ce dossier (par exemple sur un disque externe ou hors synchronisation cloud), definissez la variable d'environnement `LINKEDIN_POSTER_WORKSPACE_ROOT` vers un chemin absolu de votre choix.

---

## Commandes utiles (developpeurs)

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lancer en mode developpement (HMR) |
| `npm run test` | Executer les tests (Vitest) |
| `npm run typecheck` | Verification TypeScript |
| `npm run lint` | Verification ESLint |
| `npm run package:mac` | Build macOS (.dmg + .app) |
| `npm run package:win` | Build Windows (.exe) |
| `npm run package:linux` | Build Linux (.AppImage) |

---

## Documentation

| Document | Contenu |
|----------|---------|
| [Guide de decouverte](docs/guide-decouverte.md) | Presentation du produit |
| [Fonctionnalites](docs/fonctionnalites.md) | Reference par ecran |
| [Parcours utilisateur](docs/parcours-utilisateur.md) | Premier lancement pas a pas |
| [Architecture](docs/architecture.md) | Architecture technique |
| [Skills Codex](docs/skills-codex.md) | Contrats des 8 skills IA |
| [Exploitation](docs/exploitation.md) | Diagnostics, logs, audits |

---

## Contribuer

Les contributions sont bienvenues. Lisez [`CONTRIBUTING.md`](CONTRIBUTING.md) avant d'ouvrir une PR. Le projet suit un workflow TDD strict et utilise spec-kit pour la specification des features. Le [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) s'applique a tous les echanges autour du projet.

Pour signaler une faille de securite, suivez le processus decrit dans [`SECURITY.md`](SECURITY.md).

Le journal des versions est tenu sur la page [Releases GitHub](https://github.com/AutomatisIA/GhostwrAIter/releases).

---

## Licence

MIT — Copyright (c) 2026 Philippe Cohen ([AutomatisIA](https://automatisia.fr))

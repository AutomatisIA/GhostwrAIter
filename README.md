# LinkedIn Poster

Produisez des posts LinkedIn de qualite professionnelle, en local, avec l'IA de votre choix.

LinkedIn Poster est une application desktop qui guide la production editoriale de A a Z : strategie, ideation, redaction structuree, correction, capitalisation et planification. Le contenu reste sur votre machine. Pas de backend cloud, pas de compte a creer, pas de donnees qui sortent.

L'application utilise un assistant IA externe (ChatGPT, Claude ou Gemini) via votre propre abonnement pour generer les contenus. Vous gardez le controle editorial a chaque etape.

---

## Demarrage rapide

### 1. Installer les prerequis

| Outil | Pourquoi | Installation |
|-------|----------|-------------|
| **Node.js 20+** | Requis pour compiler et lancer l'app | [nodejs.org](https://nodejs.org/) |
| **Git** | Cloner le depot | [git-scm.com](https://git-scm.com/) |
| **Un CLI IA** | Generer les contenus (au choix) | Voir ci-dessous |

### 2. Installer un moteur IA

Choisissez le service correspondant a votre abonnement :

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
npm install -g @anthropic-ai/gemini-cli
gemini login
```

L'application detecte automatiquement les CLI installes. Vous pouvez en installer plusieurs et basculer dans les parametres.

### 3. Lancer l'application

```bash
git clone https://github.com/AutomatisIA/LinkedIn-Poster.git
cd LinkedIn-Poster
npm ci
npm run dev
```

L'application s'ouvre. C'est pret.

### 4. Packager pour une utilisation quotidienne (optionnel)

```bash
# macOS (.app)
npm run package:mac

# Windows (.exe)
npm run package:win

# Linux (.AppImage)
npm run package:linux
```

Les builds se trouvent dans le dossier `release/`.

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

Les donnees sont stockees dans `~/LinkedInPoster/` (macOS/Linux) ou `%USERPROFILE%\LinkedInPoster\` (Windows).

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lancer en mode developpement (HMR) |
| `npm run test` | Executer les tests (374 tests, Vitest) |
| `npm run typecheck` | Verification TypeScript |
| `npm run lint` | Verification ESLint |
| `npm run package:mac` | Build macOS |
| `npm run package:win` | Build Windows |
| `npm run package:linux` | Build Linux |

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

Les contributions sont bienvenues. Lisez [`CONTRIBUTING.md`](CONTRIBUTING.md) avant d'ouvrir une PR. Le projet suit un workflow TDD strict et utilise spec-kit pour la specification des features.

Pour signaler une faille de securite, suivez le processus decrit dans [`SECURITY.md`](SECURITY.md).

---

## Licence

MIT — Copyright (c) 2026 Philippe Cohen ([AutomatisIA](https://automatisia.fr))

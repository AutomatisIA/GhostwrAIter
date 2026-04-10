# Data Model: LinkedIn Editorial Cockpit MVP

**Branch**: `001-linkedin-editorial-cockpit` | **Date**: 2026-04-10

## Storage strategy

- **SQLite**: entites relationnelles, recherche, etats, logs, versioning, calendrier
- **Filesystem**: contenus exportes, assets editoriaux, skills, templates, snapshots de runs si necessaire

---

## Core tables

### `profiles`

Socle expert principal de l'utilisateur. Une seule entree active en V1.

```sql
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  positioning TEXT NOT NULL,
  bio TEXT,
  expertise_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);
```

### `offers`

Offres commerciales reliees au systeme editorial.

```sql
CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  promise TEXT NOT NULL,
  problems TEXT NOT NULL,
  proof_points TEXT,
  cta_modes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `icps`

Definition des audiences cibles.

```sql
CREATE TABLE icps (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  segment TEXT NOT NULL,
  pains TEXT NOT NULL,
  objections TEXT,
  desired_outcomes TEXT,
  language_cues TEXT,
  linkedin_behavior TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `pillars`

Axes editoriaux servant a classer les idees et contenus.

```sql
CREATE TABLE pillars (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);
```

### `voice_rules`

Regles de ton, do/don't et anti-style.

```sql
CREATE TABLE voice_rules (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('do', 'dont', 'anti_style', 'format_rule')),
  created_at TEXT NOT NULL
);
```

### `ideas`

Backlog d'idees de contenu.

```sql
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  pillar_id TEXT REFERENCES pillars(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'watch', 'client_observation', 'repurpose', 'news')),
  title TEXT NOT NULL,
  angle TEXT,
  hypothesis TEXT,
  score REAL,
  status TEXT NOT NULL CHECK (status IN ('backlog', 'selected', 'drafting', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `drafts`

Brouillons de posts produits ou edites dans l'atelier.

```sql
CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  source_idea_id TEXT REFERENCES ideas(id) ON DELETE SET NULL,
  selected_offer_id TEXT REFERENCES offers(id) ON DELETE SET NULL,
  selected_icp_id TEXT REFERENCES icps(id) ON DELETE SET NULL,
  typology TEXT,
  structure_key TEXT,
  headline TEXT,
  body_markdown TEXT NOT NULL,
  quality_score REAL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'validated', 'scheduled', 'published', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `draft_versions`

Historique des revisions de draft.

```sql
CREATE TABLE draft_versions (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  source_run_id TEXT REFERENCES execution_runs(id) ON DELETE SET NULL,
  body_markdown TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(draft_id, version_number)
);
```

### `hooks`

Accroches produites ou retenues.

```sql
CREATE TABLE hooks (
  id TEXT PRIMARY KEY,
  draft_id TEXT REFERENCES drafts(id) ON DELETE CASCADE,
  family TEXT,
  text TEXT NOT NULL,
  score REAL,
  is_selected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

### `variants`

Variantes d'un draft source.

```sql
CREATE TABLE variants (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);
```

### `execution_runs`

Journal d'execution du runner de skills.

```sql
CREATE TABLE execution_runs (
  id TEXT PRIMARY KEY,
  skill_name TEXT NOT NULL,
  skill_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'partial')),
  input_json TEXT NOT NULL,
  output_json TEXT,
  output_markdown TEXT,
  error_message TEXT,
  log_path TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL
);
```

### `calendar_items`

Planification editoriale simple.

```sql
CREATE TABLE calendar_items (
  id TEXT PRIMARY KEY,
  idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
  draft_id TEXT REFERENCES drafts(id) ON DELETE CASCADE,
  planned_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'ready', 'published', 'missed')),
  channel TEXT NOT NULL DEFAULT 'linkedin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `tags` and `tag_links`

Etiquetage transversal pour la recherche.

```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);

CREATE TABLE tag_links (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('idea', 'draft', 'variant', 'hook')),
  entity_id TEXT NOT NULL
);
```

---

## Filesystem layout

```text
linkedin-poster/
├── app/
├── content/
│   ├── strategy/
│   ├── ideas/
│   ├── drafts/
│   ├── published/
│   ├── research/
│   └── exports/
├── data/
│   └── linkedin-poster.db
├── logs/
│   └── executions/
├── skills/
│   ├── linkedin-strategy-foundation/
│   ├── linkedin-topic-generator/
│   ├── linkedin-hook-engine/
│   ├── linkedin-structure-selector/
│   ├── linkedin-post-writer/
│   ├── linkedin-post-editor/
│   ├── linkedin-repurpose/
│   └── linkedin-news-to-post/
└── config/
```

---

## Relationships

```text
Profile
  ├── Offer (1..n)
  ├── ICP (1..n)
  └── VoiceRule (1..n)

Pillar
  └── Idea (1..n)

Idea
  ├── Draft (0..n)
  └── CalendarItem (0..n)

Draft
  ├── DraftVersion (1..n)
  ├── Hook (0..n)
  ├── Variant (0..n)
  └── CalendarItem (0..n)

ExecutionRun
  └── DraftVersion (0..n)
```

---

## Search strategy

- Index SQLite sur `ideas.title`, `drafts.headline`, `drafts.body_markdown`
- Table de tags pour le filtrage rapide
- Extension ulterieure possible vers FTS5 pour recherche plein texte si le corpus grossit

---

## Versioning strategy

- `drafts` represente l'etat courant
- `draft_versions` conserve les snapshots successifs
- `execution_runs` reference l'origine d'une generation ou correction quand applicable

---

## Seed data for MVP

- 1 profile actif
- 1 offer principale
- 1 ICP principal
- 6 piliers editoriaux par defaut
- 1 jeu initial de `voice_rules` et `anti_style`
- 8 skills declarees avec schemas minimaux

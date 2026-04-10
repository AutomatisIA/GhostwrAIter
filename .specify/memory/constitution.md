# LinkedIn Poster Constitution

## Core Principles

### I. Local-First and Confidential by Default
Toutes les donnees strategiques, editoriales et operationnelles doivent rester localement sous le controle de l'utilisateur. Aucune fonctionnalite ne doit introduire de backend applicatif tiers pour stocker le contenu du projet. Les integrations de generation s'appuient sur les mecanismes d'authentification geres par l'outil d'IA lui-meme, sans extraction manuelle de secrets.

### II. Workflow Before Prompting
Le produit doit guider un processus editorial explicite plutot que proposer un simple champ de prompt libre. Chaque fonctionnalite importante doit se rattacher a une etape identifiable du workflow: strategie, ideation, structuration, redaction, correction, capitalisation ou planification.

### III. Specialized Skills with Structured I/O
Chaque capacite cognitive doit etre encapsulee dans une skill a responsabilite claire, avec des entrees structurees et des sorties normalisees. Les echanges critiques pour l'application doivent etre parseables de maniere fiable, avec une convention JSON canonique et des rendus humains lisibles.

### IV. Test-First Development Is Mandatory
Toute logique metier testable doit suivre un cycle TDD strict: test d'abord, verification de l'echec, implementation minimale, puis refactor. Une implementation ne doit pas preceder ses tests lorsque le comportement peut etre verifie automatiquement.

### V. Human Validation Over Autonomous Publishing
L'outil assiste la production mais ne remplace pas le jugement editorial de l'utilisateur. Toute sortie doit rester inspectable, modifiable, scorée et validable humainement avant publication. Les mecanismes automatiques privilegient la transparence, la reprise et la correction plutot que l'autonomie opaque.

### VI. Simplicity for MVP, Extensibility for the System
La V1 se concentre sur le coeur de valeur: socle strategique, atelier de production, bibliotheque locale, calendrier simple et runner Codex. Toute extension doit reutiliser les contrats de donnees, journaux et skills existants, sans alourdir prematurement l'architecture.

## Security and Delivery Constraints

- Le projet doit fonctionner sans architecture SaaS du produit.
- Les secrets futurs doivent etre stockes separement et proteges autant que possible.
- La partie non generative doit rester disponible hors ligne.
- Les erreurs d'execution, d'authentification ou de parsing doivent etre visibles et journalisees.
- Tout lot de travail doit commencer par une specification dans `specs/` avant implementation significative.
- Toute fonctionnalite metier testable doit avoir un test observe en echec avant son implementation.

## Development Workflow

- Les fonctionnalites sont decrites dans un dossier `specs/<numero-feature>/`.
- Le passage de `spec.md` a `plan.md` doit confirmer les choix techniques, contraintes de stockage, UX et tests.
- Les taches d'implementation doivent respecter les priorites utilisateur de la spec.
- Les decisions qui augmentent la complexite MVP doivent etre justifiees explicitement dans le plan.

## Governance

Cette constitution prime sur les habitudes implicites du projet. Toute spec, plan ou implementation doit verifier la conformite aux six principes ci-dessus. Toute derogation doit etre documentee avec son motif, son impact et l'alternative plus simple ecartee.

**Version**: 1.0.0 | **Ratified**: 2026-04-10 | **Last Amended**: 2026-04-10

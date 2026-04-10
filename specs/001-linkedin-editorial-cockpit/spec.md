# Feature Specification: LinkedIn Editorial Cockpit MVP

**Feature Branch**: `001-linkedin-editorial-cockpit`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "Construire avec spec-kit un outil local-first de pilotage et production de posts LinkedIn pour un consultant en IA générative pour PME, à partir du cahier des charges du projet et de la méthode d'origine en briques éditoriales."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurer la base strategique (Priority: P1)

En tant que consultant IA PME, je peux configurer mon positionnement, mon offre, mon ICP, ma voix et mes piliers editoriaux dans l'application afin que chaque generation parte d'un contexte stable et exploitable.

**Why this priority**: Sans socle strategique persistant, l'outil retombe dans un usage de prompt libre et produit des contenus generiques, ce qui annule la promesse principale du produit.

**Independent Test**: Un utilisateur peut creer ou modifier son socle strategique depuis l'interface, fermer l'application, puis retrouver les donnees intactes lors de la reprise.

**Acceptance Scenarios**:

1. **Given** un espace de travail vide, **When** l'utilisateur renseigne son profil, son offre, son audience, ses regles de voix et ses piliers, **Then** le systeme sauvegarde ces informations localement dans une structure persistante.
2. **Given** une base strategique existante, **When** l'utilisateur lance une future generation de contenu, **Then** le systeme expose explicitement le contexte strategique qui sera utilise.

---

### User Story 2 - Produire un post guide pas a pas (Priority: P1)

En tant qu'utilisateur, je peux transformer une idee ou une observation terrain en post LinkedIn via un workflow guide sujet -> typologie -> structure -> hook -> redaction -> correction -> validation.

**Why this priority**: C'est le coeur de valeur du MVP. Le gain attendu est de reduire fortement le temps de production sans sacrifier la qualite, la coherence business ni la personnalite editoriale.

**Independent Test**: A partir d'une idee brute, l'utilisateur peut aller jusqu'a une version de post finalisee avec variantes et recommandations de correction, sans sortir du workflow principal.

**Acceptance Scenarios**:

1. **Given** une idee brute ou un sujet saisi manuellement, **When** l'utilisateur demande une production assistee, **Then** le systeme propose une typologie, une structure adaptee, plusieurs hooks et un brouillon redige.
2. **Given** un brouillon genere, **When** l'utilisateur lance l'etape de correction, **Then** le systeme renvoie un scoring qualite lisible, les points faibles detectes et une version amelioree.

---

### User Story 3 - Capitaliser les contenus dans une bibliotheque locale (Priority: P2)

En tant qu'utilisateur, je peux retrouver mes idees, brouillons, variantes, hooks et contenus publies dans une bibliotheque locale consultable et reutilisable.

**Why this priority**: La capitalisation transforme l'outil en systeme editorial cumulatif au lieu d'un simple generateur ponctuel.

**Independent Test**: Apres plusieurs creations, l'utilisateur peut rechercher un contenu existant par mot-cle, tags, pilier ou statut et le rouvrir pour le reutiliser.

**Acceptance Scenarios**:

1. **Given** plusieurs contenus enregistres, **When** l'utilisateur effectue une recherche, **Then** le systeme affiche les elements correspondants avec leur statut et leurs metadonnees.
2. **Given** un draft existant, **When** l'utilisateur demande une reutilisation ou une variante, **Then** le systeme cree un nouvel artefact lie a la source sans ecraser l'original.

---

### User Story 4 - Planifier la production editoriale (Priority: P3)

En tant qu'utilisateur, je peux assigner un contenu ou une idee a une date et a un statut dans un calendrier editorial simple.

**Why this priority**: La planification renforce la regularite de publication, mais elle vient apres la mise en place du socle strategique et de l'atelier de production.

**Independent Test**: Un utilisateur peut prendre un draft existant, lui affecter une date et un statut, puis le retrouver dans la vue calendrier.

**Acceptance Scenarios**:

1. **Given** un contenu pret ou en cours, **When** l'utilisateur lui assigne une date et un statut, **Then** le calendrier local affiche cet element a la bonne echeance.

## Clarifications

### Clarification Session 2026-04-10

- Le produit MVP cible un **usage mono-utilisateur local sur desktop**, avec **macOS comme plateforme prioritaire**.
- Le produit **n'inclut pas de publication automatique LinkedIn** en V1. La sortie finale est un contenu valide, exportable et planifiable.
- Le produit **n'inclut pas de veille web automatisee autonome** en V1. Les contenus de veille peuvent etre saisis manuellement ou colles depuis une source externe.
- Le socle strategique repose sur **une seule entree active de profil** en V1, avec plusieurs offres et ICP possibles rattaches a ce profil.
- La **source de verite applicative** pour les executions de skills est le **JSON canonique valide**. Le Markdown est un rendu humain complementaire.
- En cas d'indisponibilite Codex, de session expiree ou de sortie invalide, le systeme **n'ecrase jamais le draft courant** et enregistre l'execution en statut `failed` ou `partial` avec message explicite.
- La reprise de travail interrompu repose sur **des snapshots de draft** persistés localement. Le MVP suppose une **sauvegarde automatique lors des transitions d'etape du workflow** et lors des validations utilisateur.
- Le calendrier V1 est un **calendrier editorial simple mono-canal LinkedIn**, avec vue liste ou grille hebdomadaire/mensuelle, sans synchronisation externe.
- La recherche locale V1 couvre au minimum **mot-cle texte + tags + pilier + statut**. La recherche semantique est hors perimetre MVP.
- Les 8 skills V1 obligatoires sont: `linkedin-strategy-foundation`, `linkedin-topic-generator`, `linkedin-hook-engine`, `linkedin-structure-selector`, `linkedin-post-writer`, `linkedin-post-editor`, `linkedin-repurpose`, `linkedin-news-to-post`.

### Edge Cases

- Que se passe-t-il si Codex n'est pas disponible, si la session utilisateur est expiree ou si l'execution echoue pendant une etape du workflow ?
- Comment le systeme gere-t-il une sortie de skill partiellement valide, du JSON mal forme ou du Markdown inexploitable ?
- Que se passe-t-il si l'utilisateur ferme l'application au milieu d'une generation ou reprend un draft cree avec une ancienne version du contexte strategique ?
- Comment le systeme evite-t-il d'exposer ou de manipuler directement des secrets ou jetons d'authentification de l'utilisateur ?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le systeme MUST permettre la creation, la modification et la consultation d'un socle strategique local comprenant au minimum le profil expert, l'offre, l'ICP, les piliers editoriaux et les regles de voix.
- **FR-002**: Le systeme MUST stocker localement les donnees editoriales et operationnelles sans dependre d'un backend SaaS du projet.
- **FR-003**: Le systeme MUST fournir un atelier de production guide couvrant au minimum les etapes sujet, typologie, structure, hooks, redaction, correction et validation.
- **FR-004**: Le systeme MUST separer le moteur cognitif des ecrans et des donnees applicatives, avec Codex responsable des transformations de contenu et l'application responsable du workflow, du stockage et des journaux.
- **FR-005**: Le systeme MUST appeler des skills editoriales specialisees plutot qu'un prompt libre unique.
- **FR-006**: Chaque skill MUST accepter un contexte structure et produire une sortie normalisee exploitable par l'application, avec JSON canonique pour le parsing applicatif et Markdown lisible pour l'utilisateur.
- **FR-007**: Le systeme MUST journaliser chaque execution de skill avec ses entrees, sorties, erreurs et metadonnees necessaires au debogage.
- **FR-008**: Le systeme MUST permettre la sauvegarde, la consultation et la reutilisation des idees, drafts, variantes, hooks et contenus publies.
- **FR-009**: Le systeme MUST offrir une recherche locale sur les contenus sauvegardes par mot-cle et metadonnees editoriales.
- **FR-010**: Le systeme MUST permettre l'affectation d'un contenu ou d'une idee a une date et un statut dans un calendrier editorial simple.
- **FR-011**: Le systeme MUST afficher de facon explicite le contexte utilise avant ou pendant une generation afin de rendre le raisonnement applicatif transparent pour l'utilisateur.
- **FR-012**: Le systeme MUST prendre en charge une reprise de travail interrompu sur une idee, un draft ou une execution precedente.
- **FR-013**: Le systeme MUST rester exploitable hors ligne pour la consultation, l'edition et l'organisation des contenus deja stockes localement.
- **FR-014**: Le systeme MUST detecter et signaler clairement les echecs d'execution Codex, y compris l'absence de session valide.
- **FR-015**: Le systeme MUST inclure un jeu initial de skills correspondant aux briques metier du projet: strategy foundation, topic generator, hook engine, structure selector, post writer, post editor, repurpose et news-to-post.
- **FR-016**: Le systeme MUST appliquer des regles anti-style et des contraintes editoriales pour limiter les rendus artificiels, sensationnalistes ou deconnectes du terrain PME.
- **FR-017**: Le systeme MUST permettre un export local complet du workspace pour la sauvegarde.
- **FR-018**: Le systeme MUST permettre une purge locale des logs ou contenus sensibles.
- **FR-019**: Le systeme MUST considerer le JSON valide produit par une skill comme unique source de verite applicative pour une execution.
- **FR-020**: Le systeme MUST enregistrer automatiquement un snapshot local du draft a chaque transition majeure du workflow et a chaque validation manuelle.
- **FR-021**: Le systeme MUST preserver le dernier contenu valide connu lorsqu'une execution de skill echoue ou retourne une sortie non exploitable.
- **FR-022**: Le systeme MUST limiter le calendrier V1 a un canal LinkedIn unique sans synchronisation avec des agendas externes.
- **FR-023**: Le systeme MUST limiter la recherche V1 a des filtres deterministes locaux (texte, tags, pilier, statut) sans dependre d'un moteur semantique.
- **FR-024**: Le systeme MUST fonctionner avec un seul profil actif en V1, tout en permettant plusieurs offres et ICP associes.

### Key Entities *(include if feature involves data)*

- **Profile**: Le socle expert de l'utilisateur avec identite editoriale, positionnement et bio.
- **Offer**: La promesse business, les problemes resolus, les preuves et les liens entre contenu et offre.
- **ICP**: Le profil de client ideal avec douleurs, objections, langage et contexte de lecture.
- **Pillar**: Un axe editorial servant a classer les idees, contenus et priorites.
- **VoiceRule**: Les regles de ton, de style et d'anti-style appliquees sur l'ensemble des generations.
- **Idea**: Une opportunite de contenu avec angle, score, pilier et source.
- **Draft**: Un brouillon de post associe a une idee, versionnable et suivi par statut.
- **Variant**: Une version alternative d'un draft pour A/B editorial ou reutilisation multiformat.
- **Hook**: Une accroche capitalisee et reutilisable, reliee a un draft ou a un sujet.
- **ExecutionRun**: La trace d'une execution de skill avec entrees, sorties, erreurs, horodatage et logs.
- **CalendarItem**: Une planification editoriale reliee a une idee ou a un contenu.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: L'utilisateur peut configurer ou modifier son socle strategique complet sans passer par la ligne de commande.
- **SC-002**: Le systeme peut generer et sauvegarder localement au moins 20 idees de posts structurees a partir d'une skill dediee.
- **SC-003**: L'utilisateur peut aller d'une idee brute a un post finalise avec au moins une variante dans un workflow continu unique.
- **SC-004**: Chaque execution de generation ou de correction laisse une trace consultable et comprehensible pour l'utilisateur.
- **SC-005**: Un contenu sauvegarde peut etre retrouve par recherche locale en moins de 10 secondes dans un corpus de demarrage d'au moins 100 elements.
- **SC-006**: Un utilisateur peut assigner un contenu a une date et un statut sans quitter l'application.
- **SC-007**: Les contenus generes respectent le positionnement anti-hype, l'orientation PME et la voix professionnelle de l'utilisateur dans une revue humaine sur un echantillon MVP.
- **SC-008**: En cas d'erreur runner ou de sortie invalide, l'utilisateur conserve son dernier draft valide et dispose d'un message d'erreur exploitable sans perte de travail.

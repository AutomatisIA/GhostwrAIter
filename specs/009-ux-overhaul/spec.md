# Feature Specification: UX Overhaul

**Feature Branch**: `009-ux-overhaul`  
**Created**: 2026-04-12  
**Status**: Draft  
**Input**: Audit UX complet identifiant des problèmes structurels dans la navigation, la densité d'information, les pages vides, et l'absence de paramètres réels. Ajout d'un mode dark/light et compatibilité multi-CLI.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Créer un post sans page vide (Priority: P1)

L'utilisateur clique sur "Créer" dans la navigation et arrive directement sur un écran utile. Il voit ses idées récentes, peut en sélectionner une pour lancer l'atelier, ou en créer une nouvelle sur place. Il n'a jamais à naviguer vers une autre page pour revenir ensuite.

**Why this priority**: L'atelier est le cœur de l'application — c'est là que la valeur se crée. Une page vide à cet endroit détruit la confiance de l'utilisateur et casse le flux de production. C'est le problème UX le plus grave identifié.

**Independent Test**: Ouvrir l'application, cliquer sur "Créer" dans la navigation. Sans aucune action préalable, l'écran affiche un contenu utile (liste d'idées ou formulaire de création rapide). Sélectionner une idée lance directement le workflow en 4 étapes.

**Acceptance Scenarios**:

1. **Given** l'utilisateur a des idées dans son backlog, **When** il clique sur "Créer" dans la navigation, **Then** il voit la liste de ses idées avec la possibilité d'en sélectionner une pour démarrer l'atelier
2. **Given** l'utilisateur n'a aucune idée dans son backlog, **When** il clique sur "Créer", **Then** il voit un formulaire de création rapide d'idée avec une explication claire de ce qu'il doit faire
3. **Given** l'utilisateur est dans l'écran "Créer" et sélectionne une idée, **When** il confirme son choix, **Then** le workflow en 4 étapes de l'atelier démarre immédiatement dans le même écran
4. **Given** l'utilisateur est dans l'atelier (étape 2, 3 ou 4), **When** il veut changer d'idée, **Then** il peut revenir à la sélection d'idées sans perdre son contexte de navigation

---

### User Story 2 - Headers compacts et espace utile (Priority: P1)

Chaque écran affiche son contenu utile le plus haut possible. Les titres occupent une seule ligne. Les descriptions explicatives ne sont pas répétées à chaque visite — l'utilisateur régulier voit directement les données et les actions.

**Why this priority**: 120-150 pixels perdus sur chaque écran réduisent significativement l'espace de travail. Dans une app métier utilisée quotidiennement, chaque pixel compte. C'est un changement à faible effort et fort impact.

**Independent Test**: Ouvrir chaque écran et vérifier que le titre tient sur une ligne, qu'aucune description répétitive n'est affichée, et que le premier contenu actionnable est visible sans scroller.

**Acceptance Scenarios**:

1. **Given** n'importe quel écran de l'application, **When** l'utilisateur l'ouvre, **Then** le titre principal tient sur une seule ligne et le contenu utile commence dans les 80 premiers pixels sous le titre
2. **Given** un utilisateur qui a déjà visité l'application, **When** il ouvre un écran, **Then** aucune description explicative du rôle de la page n'est affichée (seul le titre et les actions sont visibles)

---

### User Story 3 - Navigation simplifiée à 5 entrées (Priority: P1)

La navigation principale ne montre que 5 entrées ordonnées logiquement : Cockpit, Stratégie, Créer, Bibliothèque, Paramètres. L'utilisateur comprend intuitivement le flux de travail : définir sa stratégie, créer du contenu, gérer ses drafts, configurer l'app.

**Why this priority**: La navigation actuelle à 8 entrées sans hiérarchie empêche l'utilisateur de comprendre le flux de travail. La réduction et le renommage rendent l'app immédiatement lisible.

**Independent Test**: Ouvrir l'application et vérifier que la sidebar contient exactement 5 entrées avec des labels clairs. Naviguer séquentiellement de Cockpit à Paramètres en passant par chaque écran.

**Acceptance Scenarios**:

1. **Given** l'application est ouverte, **When** l'utilisateur regarde la navigation, **Then** il voit exactement 5 entrées : Cockpit, Stratégie, Créer, Bibliothèque, Paramètres
2. **Given** l'ancienne URL /runner, **When** l'utilisateur y navigue, **Then** il est redirigé vers la section Diagnostics des Paramètres
3. **Given** l'ancienne URL /calendrier, **When** l'utilisateur y navigue, **Then** il est redirigé vers la Bibliothèque avec l'onglet Planification actif
4. **Given** l'ancienne URL /atelier ou /idees, **When** l'utilisateur y navigue, **Then** il est redirigé vers Créer

---

### User Story 4 - Cockpit actionnable (Priority: P2)

L'utilisateur ouvre l'application et voit immédiatement ce qu'il doit faire. Le cockpit affiche une barre de progression du pipeline éditorial, la prochaine action recommandée avec un bouton d'action direct, et des métriques cliquables qui mènent aux écrans concernés.

**Why this priority**: Le dashboard actuel est passif. Le cockpit doit guider l'utilisateur vers l'action, pas juste afficher des chiffres. C'est un changement de paradigme important mais qui dépend de la nouvelle navigation (US3).

**Independent Test**: Ouvrir l'application au premier lancement. Le cockpit affiche un guide de démarrage. Après avoir créé une stratégie et des idées, le cockpit affiche la bonne prochaine étape.

**Acceptance Scenarios**:

1. **Given** un premier lancement (aucune donnée), **When** l'utilisateur ouvre le Cockpit, **Then** il voit un assistant de démarrage en 3 étapes claires avec le premier pas actionnable
2. **Given** une stratégie complète mais aucune idée, **When** l'utilisateur ouvre le Cockpit, **Then** la prochaine action recommandée est "Créer votre première idée" avec un lien direct
3. **Given** des drafts en bibliothèque mais rien de planifié, **When** l'utilisateur ouvre le Cockpit, **Then** la prochaine action recommandée est "Planifier une publication" avec un lien direct
4. **Given** n'importe quel état, **When** l'utilisateur clique sur un compteur métrique, **Then** il navigue vers l'écran correspondant

---

### User Story 5 - Bibliothèque avec planification intégrée (Priority: P2)

L'utilisateur gère ses drafts et leur planification au même endroit. La bibliothèque propose deux vues : une vue "Drafts" (liste des contenus) et une vue "Planning" (calendrier de publication). Le formulaire de planification est accessible directement depuis un draft.

**Why this priority**: Séparer bibliothèque et calendrier en deux pages oblige l'utilisateur à des allers-retours. La fusion simplifie le flux sans perdre de fonctionnalité.

**Independent Test**: Ouvrir la Bibliothèque, voir la liste des drafts. Basculer vers la vue Planning pour voir le calendrier. Planifier un draft directement depuis sa fiche.

**Acceptance Scenarios**:

1. **Given** la Bibliothèque est ouverte, **When** l'utilisateur la regarde, **Then** il voit un sélecteur de vue avec deux options : "Drafts" et "Planning"
2. **Given** la vue Drafts est active, **When** l'utilisateur clique "Planifier" sur un draft, **Then** un panneau de planification (date + confirmation) s'ouvre en inline ou en modale sans changer de page
3. **Given** la vue Planning est active, **When** l'utilisateur regarde l'écran, **Then** il voit ses publications planifiées avec leur date et leur statut
4. **Given** un draft est planifié, **When** l'utilisateur le voit dans la vue Drafts, **Then** la date de planification est visible sur la fiche

---

### User Story 6 - Paramètres complets avec thème et diagnostics (Priority: P2)

L'utilisateur accède à une page Paramètres structurée en sections : Apparence (thème dark/light), Moteur d'exécution (CLI configuré, statut, sélection), Diagnostics (historique des exécutions, logs), et Données (export, purge). Le Runner n'est plus une page séparée.

**Why this priority**: Les paramètres actuels sont quasi-vides et le Runner est exposé inutilement. Regrouper donne une page cohérente et utile.

**Independent Test**: Ouvrir Paramètres. Changer le thème. Voir le diagnostic du moteur d'exécution. Exporter le workspace.

**Acceptance Scenarios**:

1. **Given** la page Paramètres, **When** l'utilisateur l'ouvre, **Then** il voit des sections organisées : Apparence, Moteur, Diagnostics, Données
2. **Given** la section Apparence, **When** l'utilisateur bascule le thème de clair à sombre, **Then** l'interface entière change immédiatement de palette et le choix est conservé au prochain lancement
3. **Given** la section Moteur, **When** l'utilisateur la consulte, **Then** il voit le CLI détecté (Codex/Gemini/Claude), son statut (disponible/indisponible), et les skills accessibles
4. **Given** la section Diagnostics, **When** l'utilisateur la consulte, **Then** il voit l'historique des exécutions récentes avec statut, skill utilisé, et possibilité d'ouvrir le log

---

### User Story 7 - Thème dark/light (Priority: P2)

L'utilisateur peut basculer entre un thème clair et un thème sombre depuis les Paramètres. Le thème par défaut suit la préférence système. Le choix persiste entre les sessions.

**Why this priority**: Fonctionnalité demandée explicitement. Améliore le confort visuel, surtout pour un usage prolongé.

**Independent Test**: Ouvrir les Paramètres. Basculer le thème. Vérifier que toutes les pages sont correctement rendues dans les deux modes. Relancer l'application et vérifier la persistance.

**Acceptance Scenarios**:

1. **Given** un premier lancement, **When** la préférence système est "dark", **Then** l'application s'ouvre en thème sombre
2. **Given** un premier lancement, **When** la préférence système est "light", **Then** l'application s'ouvre en thème clair
3. **Given** l'utilisateur a choisi le thème sombre dans les Paramètres, **When** il navigue sur n'importe quel écran, **Then** tous les éléments (sidebar, panneaux, cartes, formulaires, boutons) utilisent la palette sombre
4. **Given** l'utilisateur a choisi un thème, **When** il ferme et relance l'application, **Then** le thème choisi est restauré
5. **Given** le sélecteur de thème, **When** l'utilisateur le consulte, **Then** il voit trois options : Système (auto), Clair, Sombre

---

### User Story 8 - Compatibilité multi-CLI et guidance d'installation (Priority: P3)

L'utilisateur peut choisir dans les Paramètres quel moteur d'IA utiliser : Codex CLI (abonnement ChatGPT), Gemini CLI (abonnement Google) ou Claude Code CLI (abonnement Anthropic). L'application explique clairement que la génération de contenu passe par un CLI externe que l'utilisateur doit installer et dans lequel il doit se connecter avec son propre abonnement. Pour chaque CLI, l'application affiche les commandes d'installation et de connexion à copier-coller dans le terminal.

**Why this priority**: Élargit considérablement l'audience de l'application. Beaucoup d'utilisateurs ne savent pas ce qu'est un CLI — il faut les guider pas à pas. Sans cette guidance, l'app est inutilisable pour un non-développeur.

**Independent Test**: Ouvrir les Paramètres section Moteur sans aucun CLI installé. L'application explique le concept, liste les 3 options avec leurs prérequis (abonnement), et donne les commandes d'installation et de login pour chaque option.

**Acceptance Scenarios**:

1. **Given** Codex CLI est installé et authentifié, **When** l'utilisateur ouvre les Paramètres section Moteur, **Then** Codex est listé comme disponible avec un badge vert
2. **Given** Claude Code CLI est installé et authentifié, **When** l'utilisateur ouvre les Paramètres section Moteur, **Then** Claude Code est listé comme disponible avec un badge vert
3. **Given** Gemini CLI est installé et authentifié, **When** l'utilisateur ouvre les Paramètres section Moteur, **Then** Gemini est listé comme disponible avec un badge vert
4. **Given** aucun CLI n'est installé, **When** l'utilisateur ouvre les Paramètres section Moteur, **Then** il voit une explication claire du fonctionnement (l'app utilise un assistant IA via votre abonnement existant), les 3 options avec pour chacune : le nom du service, l'abonnement requis, la commande d'installation, et la commande de connexion
5. **Given** un CLI est installé mais pas connecté, **When** l'utilisateur ouvre les Paramètres section Moteur, **Then** le CLI est listé comme "installé mais non connecté" avec la commande de login à exécuter
6. **Given** l'utilisateur a sélectionné Claude Code comme moteur, **When** il lance une génération dans l'atelier, **Then** la génération utilise Claude Code CLI et le résultat est affiché normalement

---

### Edge Cases

- Que se passe-t-il si l'utilisateur redimensionne la fenêtre sous 768px ? La sidebar doit se transformer en drawer mobile comme aujourd'hui, mais avec les 5 nouvelles entrées.
- Que se passe-t-il si le CLI sélectionné devient indisponible entre deux sessions (désinstallé, déconnecté) ? L'application doit détecter l'absence au démarrage et proposer de basculer vers un autre moteur disponible, ou afficher clairement le problème.
- Que se passe-t-il si l'utilisateur a des bookmarks/raccourcis vers les anciennes URLs (/runner, /calendrier, /atelier, /idees) ? Des redirections doivent être en place.
- Que se passe-t-il si la préférence de thème stockée est corrompue ou invalide ? Revenir au thème système par défaut.
- Que se passe-t-il quand l'écran Créer charge les idées et que le réseau (SQLite) est lent ? Afficher un skeleton loader, jamais une page vide.

## Clarifications

### Session 2026-04-12

- Q: Comment l'écran "Créer" gère la transition entre la liste d'idées et le workflow atelier ? → A: Remplacement progressif — l'écran affiche d'abord les idées, puis bascule vers le workshop quand une idée est sélectionnée. Un bouton "Changer d'idée" permet de revenir à la sélection.
- Q: Quel format pour la vue Planning dans la Bibliothèque ? → A: Liste chronologique filtrée — les drafts planifiés sont affichés par date avec statut (planifié, publié, manqué). Même pattern visuel que la vue Drafts. Pas de calendrier grille.
- Q: Comment adapter les prompts éditoriaux pour les moteurs non-Codex (Gemini, Claude Code) ? → A: Prompt unique + adaptateur d'invocation — les SKILL.md restent identiques quel que soit le moteur. Chaque moteur a un adaptateur qui gère l'appel CLI et le parsing de la réponse.

## Requirements *(mandatory)*

### Functional Requirements

**Navigation et structure**

- **FR-001**: L'application DOIT présenter exactement 5 entrées de navigation principale : Cockpit, Stratégie, Créer, Bibliothèque, Paramètres
- **FR-002**: Les anciennes routes (/runner, /calendrier, /atelier, /idees) DOIVENT rediriger vers les nouvelles routes correspondantes
- **FR-003**: La navigation mobile (< 768px) DOIT fonctionner en drawer avec les 5 nouvelles entrées

**Écran Créer (fusion Idées + Atelier)**

- **FR-004**: L'écran "Créer" DOIT afficher la liste des idées existantes quand aucune idée n'est sélectionnée
- **FR-005**: L'écran "Créer" DOIT permettre de créer une idée rapide sans quitter la page
- **FR-006**: L'écran "Créer" DOIT permettre de sélectionner une idée pour démarrer le workflow atelier en 4 étapes, par remplacement progressif du contenu dans le même écran (la liste d'idées cède la place au workflow)
- **FR-006a**: L'écran "Créer" DOIT afficher un bouton "Changer d'idée" pendant le workflow atelier, permettant de revenir à la sélection d'idées
- **FR-007**: L'écran "Créer" NE DOIT JAMAIS afficher un état vide sans contenu ni action possible
- **FR-008**: Les trois modes de création d'idée (manuel, veille, stratégie) DOIVENT rester accessibles depuis l'écran "Créer"

**Headers compacts**

- **FR-009**: Les titres de page DOIVENT tenir sur une seule ligne à la taille de police standard
- **FR-010**: Les eyebrows catégoriels DOIVENT être supprimés de tous les écrans
- **FR-011**: Les descriptions explicatives sous les titres DOIVENT être supprimées ou rendues accessibles via un mécanisme discret (tooltip ou aide contextuelle)

**Cockpit**

- **FR-012**: Le Cockpit DOIT afficher une barre de progression du pipeline éditorial (Stratégie → Idées → Drafts → Planifiés → Publiés)
- **FR-013**: Le Cockpit DOIT afficher la prochaine action recommandée avec un bouton d'action direct qui navigue vers l'écran approprié
- **FR-014**: Le Cockpit DOIT afficher des compteurs métriques cliquables menant aux écrans correspondants
- **FR-015**: Au premier lancement (aucune donnée), le Cockpit DOIT afficher un assistant de démarrage en étapes claires

**Bibliothèque avec planification**

- **FR-016**: La Bibliothèque DOIT proposer deux vues : "Drafts" (liste) et "Planning" (liste chronologique des publications planifiées, triée par date, avec statut)
- **FR-017**: L'utilisateur DOIT pouvoir planifier un draft directement depuis sa fiche dans la vue Drafts
- **FR-018**: Les filtres existants (recherche, statut) DOIVENT être conservés dans la vue Drafts

**Paramètres**

- **FR-019**: La page Paramètres DOIT être structurée en sections : Apparence, Moteur, Diagnostics, Données
- **FR-020**: La section Apparence DOIT inclure un sélecteur de thème à 3 options : Système, Clair, Sombre
- **FR-021**: La section Moteur DOIT afficher les CLI détectés avec leur statut (disponible/indisponible)
- **FR-022**: La section Diagnostics DOIT afficher l'historique des exécutions (repris de l'ancien Runner)
- **FR-023**: La section Données DOIT conserver les actions existantes (export, purge logs)

**Thème dark/light**

- **FR-024**: L'application DOIT supporter deux thèmes visuels : clair et sombre
- **FR-025**: Le thème par défaut DOIT suivre la préférence système (prefers-color-scheme)
- **FR-026**: Le choix de thème DOIT persister entre les sessions
- **FR-027**: Le changement de thème DOIT s'appliquer immédiatement à tous les éléments visibles sans rechargement de page
- **FR-028**: Les deux thèmes DOIVENT conserver le style glassmorphism et la cohérence visuelle de l'application

**Multi-CLI et guidance d'installation**

- **FR-029**: L'application DOIT détecter automatiquement les CLI installés au démarrage (Codex, Gemini CLI, Claude Code CLI)
- **FR-030**: L'utilisateur DOIT pouvoir sélectionner le moteur actif depuis les Paramètres
- **FR-031**: La sélection du moteur DOIT persister entre les sessions
- **FR-032**: Quand le moteur sélectionné n'est pas disponible, l'application DOIT afficher un message clair et proposer les alternatives détectées
- **FR-033**: Le changement de moteur NE DOIT PAS nécessiter de redémarrage de l'application
- **FR-034**: Chaque moteur DOIT supporter les 8 skills éditoriaux existants avec des résultats fonctionnellement équivalents, en utilisant les mêmes SKILL.md (prompt unique) et un adaptateur d'invocation spécifique par moteur
- **FR-035**: La section Moteur DOIT expliquer en langage non-technique que l'application utilise un assistant IA externe via l'abonnement personnel de l'utilisateur (ChatGPT, Google AI, ou Claude)
- **FR-036**: Pour chaque CLI supporté, l'application DOIT afficher : le nom du service, l'abonnement requis, la commande d'installation (copiable), et la commande de connexion (copiable)
- **FR-037**: L'application DOIT distinguer trois états par CLI : non installé, installé mais non connecté, installé et connecté
- **FR-038**: Les commandes affichées DOIVENT être copiables en un clic (bouton "Copier" ou clic sur le bloc de code)

### Key Entities

- **ThemePreference**: Choix de thème de l'utilisateur (system, light, dark). Persiste localement.
- **CliEngine**: Moteur d'exécution détecté. Attributs : nom (codex, gemini, claude), chemin binaire, installState (not-installed, installed, authenticated), version détectée.
- **EngineSelection**: Choix du moteur actif par l'utilisateur. Persiste localement. Lié à un CliEngine.
- **NavigationRoute**: Route de l'application. Attributs : path, label, icône. Les anciennes routes ont un mapping de redirection vers les nouvelles.

## Assumptions

- La page Stratégie actuelle est bien conçue et n'a pas besoin d'être modifiée dans cette feature.
- Le workflow en 4 étapes de l'atelier (Cadrage → Structure → Hook → Draft) reste inchangé dans son fonctionnement interne ; seul son point d'entrée change.
- Le glassmorphism (backdrop-filter, semi-transparent backgrounds) est conservé dans les deux thèmes.
- Les redirections des anciennes routes sont suffisantes — aucune migration de données utilisateur n'est nécessaire.
- Gemini CLI utilise `gemini` comme commande et supporte un mode non-interactif.
- Claude Code CLI utilise `claude --print` comme mode non-interactif.
- La persistance des préférences (thème, moteur) utilise SQLite (table `app_settings` key-value) — cohérent avec l'architecture existante et accessible depuis le main process au démarrage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: L'utilisateur peut passer de "ouvrir l'app" à "lancer la rédaction d'un post" en 2 clics maximum (Cockpit → Créer → sélection d'idée), contre 4+ clics actuellement
- **SC-002**: Aucun écran de l'application ne présente un état vide sans contenu ni action proposée
- **SC-003**: L'espace vertical occupé par les headers est réduit d'au moins 50% par rapport à l'existant (de ~150px à ~75px ou moins)
- **SC-004**: 100% des anciennes URLs redirigent correctement vers les nouveaux écrans
- **SC-005**: Le changement de thème est instantané (< 100ms perçu) et cohérent sur tous les écrans
- **SC-006**: L'application fonctionne avec au moins 2 moteurs CLI différents (Codex + un autre)
- **SC-007**: La navigation ne contient que 5 entrées et l'utilisateur peut accéder à toute fonctionnalité existante depuis ces 5 entrées
- **SC-008**: Au premier lancement, l'utilisateur comprend quoi faire sans documentation externe (le cockpit le guide)

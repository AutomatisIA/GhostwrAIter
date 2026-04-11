# Audit Reel Des Pages

Date de l'audit: 2026-04-11

Mode de verification:

- build Electron reel
- lancement de l'application Electron
- interactions reelles via `scripts/real-app-audit.mjs`
- execution avec workspace isole
- verification du runner Codex dans l'application

## Resultat global

Le parcours principal fonctionne de bout en bout:

- strategie
- idees
- atelier
- bibliotheque
- calendrier
- runner
- parametres

Des corrections structurelles ont ete necessaires avant que ce parcours soit reellement stable:

- detection de Codex dans l'application desktop
- fallback local quand une sortie Codex est exploitable en apparence mais invalide pour l'UI
- isolation du workspace pour les audits et tests reels
- enrichissement de la page Strategie, auparavant trop reduite

## Page par page

## Tableau de bord

Etat:
Accessible, mais encore tres introductif.

Ce qui marche:

- navigation principale visible
- lecture simple des sections

Ameliorations recommandees:

- ajouter un vrai "Commencer ici"
- afficher l'etat du socle strategique
- afficher le nombre d'idees, drafts et contenus planifies

## Strategie

Etat:
Fonctionnelle apres enrichissement.

Ce qui a ete verifie reellement:

- saisie du profil
- sauvegarde locale
- generation du socle editorial

Ce qui a ete corrige:

- ajout des blocs `offres`, `ICP`, `piliers`, `regles de voix`
- persistance UI de ces blocs

Point d'attention:

- lors de l'audit reel, seule la partie profil a ete remplie dans le script, donc le socle genere reste volontairement pauvre

Ameliorations recommandees:

- pre-remplir un exemple au premier lancement
- signaler visuellement les zones encore vides

## Idees

Etat:
Fonctionnelle.

Ce qui a ete verifie reellement:

- ajout manuel d'une idee
- transformation d'une source de veille en draft

Constat:

- le wording est maintenant comprensible, mais la page gagnerait a mieux differencier:
  - capture manuelle
  - veille
  - generation depuis la strategie

Ameliorations recommandees:

- separer visuellement les 3 usages
- montrer plus clairement ce qui a ete cree apres une transformation de veille

## Atelier

Etat:
Fonctionnel, mais encore lourd en perception utilisateur.

Ce qui a ete verifie reellement:

- ouverture depuis une idee
- selection de structure
- generation de hooks
- generation du draft final

Ce qui a ete corrige:

- fallback automatique si Codex retourne une reponse incomplete

Constats UX:

- les actions longues bloquent la perception de l'interface
- l'utilisateur ne voit pas assez clairement qu'une generation est en cours

Ameliorations recommandees:

- ajouter un etat de chargement clair par etape
- afficher la source du resultat: Codex ou fallback local
- mieux separer la configuration, les hooks et le draft

## Bibliotheque

Etat:
Fonctionnelle.

Ce qui a ete verifie reellement:

- chargement des drafts
- recherche
- creation d'une variante

Constat:

- la creation de variante bloque l'interface pendant l'execution

Ameliorations recommandees:

- ajouter un feedback de progression
- afficher plus clairement le draft source et la variante
- permettre un filtre par pilier et par statut

## Calendrier

Etat:
Fonctionnel.

Ce qui a ete verifie reellement:

- ouverture depuis la bibliotheque
- selection d'une date
- enregistrement d'un draft planifie

Ameliorations recommandees:

- afficher le draft source plus lisiblement
- permettre le changement de statut depuis la page
- distinguer les brouillons, variantes et contenus prets

## Runner

Etat:
Fonctionnel apres correction.

Ce qui a ete verifie reellement:

- Codex detecte dans l'application
- mode runner affiche en `codex`
- liste des runs recentes visible

Ce qui a ete corrige:

- enrichissement du PATH pour trouver `codex` hors terminal
- validation des sorties Codex avant injection dans l'UI

Ameliorations recommandees:

- afficher l'erreur detaillee quand une run echoue
- permettre d'ouvrir un log directement

## Parametres

Etat:
Fonctionnel.

Ce qui a ete verifie reellement:

- export du workspace
- purge des logs

Ameliorations recommandees:

- expliciter ce que contient l'export
- demander confirmation avant purge

## Resume des corrections deja apportees

- la page Strategie permet maintenant de saisir les briques editoriales qui manquaient
- le runner detecte Codex dans l'application desktop
- les sorties Codex invalides ne cassent plus le workflow et retombent sur le fallback local
- le workspace peut etre isole proprement pour les tests reels
- un script d'audit reel rejouable existe: `scripts/real-app-audit.mjs`

## Dette UX restante

- l'application manque encore d'etats de chargement visibles sur les actions longues
- le tableau de bord n'est pas encore un vrai ecran d'onboarding
- plusieurs pages restent plus "fonctionnelles" que "pedagogiques"

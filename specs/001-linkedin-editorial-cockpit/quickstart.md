# Quickstart: LinkedIn Editorial Cockpit MVP

**Branch**: `001-linkedin-editorial-cockpit` | **Date**: 2026-04-10

## Goal

Demarrer localement le MVP du cockpit editorial et verifier les parcours critiques de la V1.

## Prerequisites

- Node.js 20+
- npm 10+
- Codex CLI disponible sur la machine
- Session Codex/ChatGPT valide pour les tests de generation

## Initial project setup

```bash
npm install
npm run db:init
npm run dev
```

## Expected local structure after first launch

```text
data/linkedin-poster.db
logs/executions/
content/strategy/
content/ideas/
content/drafts/
skills/
```

## Manual MVP validation

### 1. Configure the strategic base

1. Ouvrir l'ecran `Strategie`
2. Renseigner le profil expert, l'offre, l'ICP principal, les piliers et les regles de voix
3. Fermer puis relancer l'application
4. Verifier que les donnees sont rechargees sans perte

### 2. Produce a post from an idea

1. Ouvrir l'ecran `Idees`
2. Creer une idee manuelle ou lancer le generateur de sujets
3. Selectionner une idee et l'envoyer dans l'atelier
4. Verifier la sequence:
   - typologie proposee
   - structure recommandee
   - liste de hooks
   - brouillon redige
   - scoring de correction
5. Valider le draft final

### 3. Inspect execution logs

1. Ouvrir l'ecran `Runner / Logs`
2. Verifier qu'un `ExecutionRun` existe pour chaque etape cognitive
3. Verifier la presence du statut, du resume, des inputs et des outputs

### 4. Reuse content from the library

1. Ouvrir `Bibliotheque`
2. Rechercher un draft par mot-cle
3. Generer une variante ou rouvrir le draft dans l'atelier

### 5. Schedule a post

1. Ouvrir `Calendrier`
2. Assigner le draft a une date et un statut
3. Verifier sa presence dans la vue calendrier

## Failure-path validation

- Simuler une indisponibilite de Codex et verifier l'affichage d'une erreur explicite
- Forcer une sortie invalide de skill et verifier le passage en statut `partial` ou `failed`
- Ouvrir un draft inacheve apres redemarrage et verifier la reprise

## Non-goals for this quickstart

- Publication automatique sur LinkedIn
- Veille web entierement automatisee
- Collaboration multi-utilisateur

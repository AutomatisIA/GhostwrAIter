# Guide de Decouverte

## Ce qu'est GhostwrAIter

GhostwrAIter est un cockpit editorial local pour produire, corriger, reutiliser et planifier des contenus LinkedIn.

Ce n'est pas un simple generateur de texte.

L'application sert a transformer une strategie editoriale en systeme de travail concret:

- definir un cap editorial clair
- capturer des idees ou de la veille
- transformer un sujet en post structure
- garder les brouillons utiles dans une bibliotheque
- planifier les publications
- suivre les executions du runner Codex

## Pourquoi l'outil existe

L'objectif est de produire des posts utiles, coherents et reutilisables sans repartir de zero a chaque fois.

Le probleme que l'outil cherche a resoudre est simple:

- trop d'idees restent au stade de note
- les posts generes par IA sont souvent generiques
- la strategie reste implicite au lieu d'etre exploitable
- les bons brouillons se perdent
- la production manque de cadence et de capitalisation

GhostwrAIter sert donc a garder la strategie, le backlog, les drafts et le calendrier dans un seul flux local.

## Pour qui

L'outil est pense pour une personne qui veut piloter sa production LinkedIn avec un niveau de controle eleve:

- consultant
- independant
- expert metier
- dirigeant
- createur qui veut une machine editoriale locale plutot qu'un SaaS

## Comment lire l'application

L'application suit un ordre logique:

1. `Strategie`
   Tu definis qui tu es, ce que tu vends, pour qui tu ecris et les regles de voix.
2. `Idees`
   Tu captures des sujets, des angles ou une source de veille.
3. `Atelier`
   Tu transformes une idee en post via structure, hook, draft puis correction.
4. `Bibliotheque`
   Tu retrouves les contenus utiles et tu fabriques des variantes.
5. `Calendrier`
   Tu donnes une date a un draft.
6. `Runner`
   Tu verifies si Codex est bien detecte et tu consultes les executions.
7. `Parametres`
   Tu exportes le workspace ou tu purges les logs.

## Parcours recommande pour un premier usage

### 1. Commencer par la strategie

Pourquoi:
Sans strategie, les generations restent pauvres ou trop generiques.

Ce qu'il faut remplir en premier:

- nom
- positionnement
- bio
- resume d'expertise
- au moins une offre
- au moins un pilier
- au moins une regle de voix

### 2. Ajouter une idee simple

Pourquoi:
C'est le point d'entree le plus rapide pour tester le flux complet.

Exemple:

- titre: `Pourquoi les PME bloquent encore sur l'adoption IA`
- angle: `Le frein n'est pas le modele, mais le cadrage`
- pilier: `Adoption IA`

### 3. Ouvrir l'atelier

Pourquoi:
L'atelier fait le vrai travail editorial.

Ce que tu obtiens:

- une structure recommandee
- plusieurs hooks
- un draft
- une trace d'execution

### 4. Creer une variante en bibliotheque

Pourquoi:
Un bon post ne doit pas rester a usage unique.

Ce que tu obtiens:

- une nouvelle version exploitable
- une nouvelle entree dans la bibliotheque

### 5. Planifier dans le calendrier

Pourquoi:
Un contenu non planifie reste souvent non publie.

## Ce que signifie "local"

Les donnees du produit restent sur la machine:

- base SQLite
- fichiers d'export
- logs d'execution
- workspace editorial

Codex est utilise pour certaines generations, mais l'application garde le controle du stockage, des ecrans et du workflow.

## Ce qu'il faut retenir

Si tu decouvres l'outil sans contexte, pense-le comme un systeme en 3 couches:

- `Strategie`: la source de verite
- `Production`: idees + atelier + bibliotheque
- `Pilotage`: calendrier + runner + parametres

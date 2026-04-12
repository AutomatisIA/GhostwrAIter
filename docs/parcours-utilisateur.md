# Parcours Utilisateur

## Objectif du document

Expliquer comment utiliser l'application sans connaitre le projet, ni Electron, ni Codex.

## Ce que l'outil fait vraiment

GhostwrAIter ne sert pas a "demander un post a une IA".

Il sert a piloter un systeme editorial local:

- clarifier une strategie
- capturer des sujets
- transformer une idee en draft
- reutiliser les contenus utiles
- planifier ce qui doit sortir

## Parcours recommande

### 1. Ouvrir `Strategie`

But:

- donner a l'application de quoi comprendre qui ecrit, pour qui, et avec quelle ligne editoriale

Ce qu'il faut remplir au minimum:

- nom
- positionnement
- bio
- resume d'expertise
- une offre
- un pilier editorial
- une regle anti-style

Pourquoi c'est important:

- sans cela, les contenus restent trop generiques

### 2. Ouvrir `Idees`

But:

- creer le backlog editorial

3 points d'entree:

- idee manuelle
- source de veille
- generation depuis la strategie

Quand utiliser chaque entree:

- idee manuelle:
  quand tu as deja un angle
- veille:
  quand une info externe doit etre transformee en prise de position
- generation strategie:
  quand tu veux remplir le backlog a partir du socle editorial

### 3. Ouvrir `Atelier`

But:

- transformer une idee en post

Etapes:

1. choisir le cadrage
2. choisir la structure
3. choisir l'accroche
4. generer le draft
5. corriger si besoin

Ce qu'il faut comprendre:

- l'atelier n'est pas un simple bouton magique
- chaque etape rend visible une decision editoriale

### 4. Ouvrir `Bibliotheque`

But:

- capitaliser ce qui a deja ete produit

Ce qu'on y fait:

- retrouver un draft
- le filtrer
- creer une variante
- l'envoyer au calendrier

Pourquoi cette page existe:

- un bon draft doit devenir une ressource, pas un texte jete

### 5. Ouvrir `Calendrier`

But:

- donner une date a un draft

Ce que cela change:

- le draft sort du statut "idee interessante"
- il entre dans une logique de cadence

### 6. Ouvrir `Runner`

But:

- verifier si Codex est disponible
- comprendre les derniers runs

Quand y aller:

- si une generation echoue
- si tu veux confirmer que le runner est bien actif
- si tu veux lire ce que le systeme a reussi ou refuse

### 7. Ouvrir `Parametres`

But:

- exploiter l'application dans le temps

Actions:

- exporter le workspace
- purger les logs

## Ce qu'est une bonne entree

### Bonne idee

- titre precis
- angle defendable
- consequence metier claire

Exemple:

- titre: `Une PME n a pas besoin de 20 cas d usage IA. Elle a besoin des 3 bons.`
- angle: `Multiplier les idees donne une impression de mouvement, mais sans priorisation on ajoute surtout du bruit, des attentes et du travail de coordination.`

### Mauvaise idee

- theme vague
- angle trop large
- pas de consequence business

Exemple:

- titre: `L IA en entreprise`
- angle: `Sujet important pour les entreprises`

## Ce qu'est une bonne source de veille

Une bonne source contient au moins:

- un fait identifiable
- un contexte
- une implication concrete

Une mauvaise source:

- reste trop vague
- ne dit pas ce qui change reellement
- forcerait l'application a inventer un angle

## Ce qu'il faut attendre de l'application

### Ce que l'application doit faire

- rendre visible le workflow editorial
- refuser une sortie trop faible
- conserver la memoire des contenus
- rendre les erreurs explicites

### Ce qu'elle ne doit pas faire

- inventer des faits
- produire un post faible "pour depanner"
- masquer une erreur de runner

## Signaux de bonne utilisation

- la strategie est renseignee
- les idees ont un angle concret
- le draft final parle de consequence, pas seulement d'opinion
- les variantes ont un vrai angle alternatif
- le calendrier contient des drafts reellement exploitables

## Signaux d'alerte

- les hooks se ressemblent tous
- les posts pourraient etre signes par n'importe qui
- la source de veille est refusee souvent
- les variantes ressemblent trop au texte source
- le runner renvoie des erreurs de contrat ou d'indisponibilite

## Si une generation echoue

1. Aller dans `Runner`
2. Lire le message d'erreur
3. Verifier si Codex est disponible
4. Verifier si l'entree fournie etait assez concrete
5. Reprendre l'angle ou la strategie si besoin

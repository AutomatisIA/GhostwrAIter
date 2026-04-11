# TODO

## Priorite haute

- Durcir encore `linkedin-repurpose` pour eliminer les ouvertures encore trop reconnaissables comme `Le sujet n est pas...` quand elles ne sont pas totalement justifiees par l angle.
- Ajouter une vraie couche de "voice profile" exploitable dans la strategie: marqueurs signature, tournures preferees, tournures interdites, rythme, chutes, CTA acceptables.
- Faire un benchmark editorial reel sur au moins 10 sujets couvrant plusieurs angles:
  - cadrage
  - ROI
  - adoption
  - gouvernance
  - veille
  - cas client
- Introduire un verdict editorial plus strict que le score numerique seul:
  - `Publier`
  - `Correct mais a retravailler`
  - `A refaire`
- Revoir l affichage du score de qualite pour qu il soit explicable et non percu comme arbitraire.

## Qualite editoriale

- Ajouter une liste centralisee de patterns interdits observes en reel:
  - openings molles
  - transitions generiques
  - conclusions trop interchangeables
  - faux contrastes trop faciles
- Mieux differencier les familles de hooks pour eviter que plusieurs hooks ressemblent a la meme idee rephrasee.
- Renforcer `linkedin-post-writer` sur les points suivants:
  - plus de tension dans la premiere phrase
  - plus de consequence business explicite plus tot
  - moins de formulations applicables a n importe quel consultant IA
- Renforcer `linkedin-news-to-post` avec de meilleurs exemples d entrees attendues, pour reduire les echecs dus a des sources trop vagues.
- Ajouter un mode de comparaison entre draft initial et variante pour verifier qu il y a un vrai changement d angle.
- Tester la stabilite editoriale sur des sujets plus sensibles:
  - budget
  - gouvernance
  - securite
  - priorisation portefeuille

## Strategie

- Ajouter un vrai module `voice profile` dans l ecran `Strategie`, au lieu de la seule regle anti-style.
- Ajouter des exemples guides pour:
  - preuves
  - CTA
  - ICP
  - langage de la cible
- Afficher clairement ce qui manque dans la strategie pour atteindre un niveau premium.
- Ajouter un controle de coherence entre offre, piliers, ICP et voix.

## Atelier

- Permettre de comparer plusieurs structures avant validation finale.
- Afficher plus clairement pourquoi une structure ou une accroche est proposee.
- Ajouter un mode "regenerer uniquement les hooks" ou "regenerer uniquement le draft" sans refaire tout le parcours.
- Ajouter une previsualisation plus lisible du post:
  - meilleur espacement
  - compteur de longueur
  - lecture mobile
- Ajouter un verdict qualitatif visible sur le draft avant correction.

## Bibliotheque

- Ajouter un diff entre draft source et variante.
- Ajouter des filtres supplementaires:
  - par typologie
  - par objectif
  - par qualite
  - par date
- Ajouter une action "ouvrir dans l atelier".
- Mieux distinguer visuellement draft source et variantes.

## Idees

- Ajouter des placeholders plus concrets sur la qualite attendue d une idee.
- Ajouter un validateur de qualite minimale avant envoi dans l atelier.
- Mieux expliquer pourquoi une source de veille est refusee.
- Ajouter un mode "transformer en idee seulement" pour la veille, sans forcer directement un draft.

## Runner

- Ajouter un historique plus utile des runs:
  - duree
  - payload resume
  - raison d echec lisible
- Ajouter une vue "contrat casse" avec comparaison entre sortie attendue et sortie recue.
- Ajouter un export simplifie des logs de runs editoriaux reels.

## UX / UI

- Continuer la refonte dans un langage plus proche de LinkedIn, mais sans tomber dans le clone.
- Ajouter plus d etats de chargement longs sur les actions Codex.
- Ajouter des etats vides plus pedagogiques sur toutes les pages.
- Mieux separer visuellement:
  - configuration
  - resultat
  - explication
- Revoir la lisibilite des cartes de hooks et des cartes de structure.
- Ajouter une vue mobile plus soignee pour les pages longues.

## Tests et audit

- Garder `scripts/real-app-audit.mjs` comme smoke test reel principal et le rendre moins fragile encore.
- Etendre `scripts/benchmark-editorial-quality.mjs` a plus de sujets et a une sortie comparative.
- Ajouter des fixtures editoriales plus riches pour les tests unitaires.
- Rejouer les tests DB complets des que l environnement Node local est stabilise.

## Environnement et tooling

- Fixer proprement le probleme local `better-sqlite3` / Node `v25.x` pour pouvoir relancer toute la suite de tests Node.
- Documenter une version Node cible stricte pour le dev local.
- Ajouter un script de verification d environnement avant lancement.

## Packaging macOS

- Finaliser le lanceur `LinkedIn Poster` pour usage quotidien:
  - icone definitive
  - emplacement clair
  - doc de mise a jour
- Etudier une distribution plus propre pour macOS:
  - bundle installe dans `Applications`
  - eventuelle signature
  - experience de lancement plus fluide


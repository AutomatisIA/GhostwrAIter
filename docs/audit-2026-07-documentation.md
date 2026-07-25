# Audit de la documentation, 25 juillet 2026

Objet : justesse et minimalisme de la documentation, dans la perspective d'une
publication open-source. Toute affirmation ci-dessous a été vérifiée contre le code réel
avant d'être qualifiée de fausse.

---

## Correction préalable

Les trois documents produit soupçonnés de décrire encore l'ancienne interface à 8 pages
(`parcours-utilisateur.md`, `guide-decouverte.md`, `fonctionnalites.md`) sont **déjà à
jour**. Ils ont été réécrits par le commit `2b2d817` du 31 mai et décrivent correctement
les cinq écrans actuels, vérifiés contre `app/renderer/src/app/App.tsx:29-34`.

La dette documentaire est ailleurs : des liens cassés, deux commandes inexistantes, un
paquet npm qui n'existe pas, et deux affirmations devenues fausses sans avoir été
corrigées.

---

## 1. Ce qui casse un parcours dès le premier essai

### Le paquet Gemini annoncé n'existe pas, dans la documentation ET dans le code

`README.md:57` et **`app/main/domains/execution/gemini-engine.ts:48`** annoncent tous
deux :

```
npm install -g @anthropic-ai/gemini-cli
```

Vérifié sur le registre npm :

| Paquet | Résultat |
|---|---|
| `@anthropic-ai/gemini-cli` | **404, n'existe pas** |
| `@google/gemini-cli` | existe, version 0.52.0 |

Ce n'est pas seulement une erreur de documentation. La chaîne est dans le code, donc
**l'écran Paramètres affiche cette commande à l'utilisateur, avec un bouton Copier à
côté**. Un utilisateur qui veut installer Gemini depuis l'application obtient une erreur
404.

Explication plausible de l'origine : copie du modèle `@anthropic-ai/claude-code` sans
changer l'organisation.

### Le chemin des données annoncé est faux, avec une conséquence de confidentialité

`README.md:92` annonce :

> Les données sont stockées dans `~/GhostwrAIter/` (macOS/Linux) ou
> `%USERPROFILE%\GhostwrAIter\` (Windows).

Le chemin réel, vérifié via `app/main/index.ts:75` et `workspace.service.ts`, est
`app.getPath("userData")/workspace`, soit sur macOS
`~/Library/Application Support/GhostwrAIter/workspace`.

L'erreur est aggravée par `docs/exploitation.md:371-376`, qui recommande explicitement de
ne pas synchroniser ce dossier vers un service cloud. Un utilisateur qui se fie au README
pour exclure le bon dossier de sa synchronisation iCloud ou OneDrive laisserait en réalité
ses données passer par le cloud, tout en croyant l'avoir empêché.

### Deux fichiers documentent une commande npm inexistante

`CONTRIBUTING.md:39` et `.github/PULL_REQUEST_TEMPLATE.md` demandent de lancer
`npm run real-app-audit`. Vérifié : **aucun script de ce nom dans `package.json`**. La
bonne commande, correctement documentée ailleurs (`exploitation.md:90`,
`skills-codex.md:267`), est `node scripts/real-app-audit.mjs`.

Un contributeur qui suit la liste de contrôle de la pull request obtient
`npm error Missing script`.

---

## 2. Affirmations devenues fausses

### La documentation se contredit sur la sécurité

`docs/exploitation.md:386` liste comme travail restant :

> Validation zod systématique des handlers IPC, aujourd'hui plusieurs handlers acceptent
> le payload sans le parser via zod.

`SECURITY.md:38` affirme l'inverse, et a raison. Vérifié : les sept fichiers IPC passent
tous par `registerValidatedHandler`.

Chronologie relevée par l'agent : cette phrase a été écrite le 11 avril à 19h34 (commit
`9339a75`) et le manque qu'elle décrit a été comblé le même jour à 21h20 (commit
`e05c07e`). Une affirmation de sécurité fausse, corrigée moins de deux heures après avoir
été écrite, et jamais retirée depuis plus de trois mois.

Sur un dépôt public, une documentation qui annonce un trou de validation inexistant est
un signal négatif gratuit.

### Autres affirmations fausses

| Emplacement | Affirmation | Réalité |
|---|---|---|
| `exploitation.md:64,191` | « Diagnostic dans l'app : page Runner » | `Runner` n'est plus un écran. `App.tsx:73` redirige vers `/parametres?section=diagnostics` |
| `exploitation.md:286` | « une navigation drawer arrive potentiellement » | livrée en avril, commit `76ff4a9`, avant même le dernier commit ayant touché ce fichier |
| `audit-technique-fonctionnel-2026-05.md:136` et `plan-action:27,121` | « prompts en dur, SKILL.md à l'état d'ébauche » | faux depuis la feature 006, les 8 SKILL.md contiennent 265 lignes de prompt réel |
| `plan-action:64,73` | « 0 token de design, aucune primitive » | faux depuis 010, `tokens.css` plus 11 primitives |
| `plan-action:111` | fixtures avec clé `persona` rejetée | corrigé, zéro occurrence aujourd'hui |
| `AGENTS.md:7` | « Drizzle ORM » | zéro occurrence, le projet est en SQL brut sur better-sqlite3 |
| `AGENTS.md:12` | « Project Structure : `src/` » | aucun dossier `src/`, le code vit sous `app/` |
| `editorial-iteration-playbook.md:34` | « six sections » | cinq sont énumérées |

### Chemins absolus de la machine du développeur, sous l'ancien nom

Vingt liens dans `docs/architecture.md` (18) et `docs/skills-codex.md` (2) pointent vers
`/Users/philippe/Dev/LinkedIn-Poster/app/...`.

Doublement problématique : cassés pour quiconque clone le dépôt, et ils exposent le chemin
local du développeur dans un dépôt destiné à la publication.

Même famille : `.github/ISSUE_TEMPLATE/config.yml` pointe vers
`github.com/AutomatisIA/LinkedIn-Poster`, alors que le dépôt réel est `GhostwrAIter`.

---

## 3. Redondances

- **Quatre descriptions des mêmes cinq écrans** pour le même public non technique :
  `guide-decouverte.md`, `parcours-utilisateur.md`, `fonctionnalites.md` et
  `README.md:69-75`. La différenciation par profondeur est défendable, mais rien
  n'indique au lecteur lequel lire en premier ni pourquoi les trois coexistent.
- **`AGENTS.md` contre `CLAUDE.md`** : même intitulé, même prétention d'auto-génération,
  contenus contradictoires, un seul maintenu.
- **`SECURITY.md` contre `exploitation.md`** : verdicts opposés sur le même sujet. Cas le
  plus net où la redondance a produit une contradiction plutôt qu'une répétition.
- **`audit-technique-fonctionnel-2026-05.md` et `plan-action-amelioration-2026-05.md`** :
  le second existe pour corriger le premier. Redondance par construction, et les deux
  sont désormais dépassés par les features 006, 010 et 011.

---

## 4. Manques pour un public open-source

Vérifiés absents, pas supposés :

- **Aucune capture d'écran ni animation** dans tout le dépôt. Pour une application de
  bureau dont toute la proposition tient à une interface en cinq écrans, c'est le manque
  le plus coûteux pour un visiteur qui ne clonera pas.
- **Aucun `CHANGELOG.md`.** Les notes sont générées par `auto-release.yml:130` mais ne
  persistent que sur la page GitHub Releases.
- **Aucun badge** dans le README.
- **`CODE_OF_CONDUCT.md` n'est lié nulle part**, ni depuis le README ni depuis
  `CONTRIBUTING.md`. Il existe et son contenu est correct.
- **Partage linguistique non signalé** : le produit et `docs/` sont en français,
  `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` et les gabarits `.github/` sont
  en anglais. Rien ne prévient un contributeur international.

Déjà présent et correct, vérifié : README avec installation, prérequis CLI détaillés par
système, guide de contribution complet, politique de sécurité avec canal privé, licence
MIT, gabarits d'issues fonctionnels, intégration continue réelle sur trois systèmes,
Dependabot configuré.

---

## 5. Lecture du README par un visiteur

En trente secondes, on comprend ce que fait l'application, à qui elle s'adresse, quoi
installer, et l'argument local-first est posé dès la deuxième ligne. La structure est
logique.

Deux défauts cassent cette bonne impression : la commande Gemini échoue au premier
copier-coller, et le chemin des données est faux au moment exact où l'utilisateur en a
besoin pour décider ce qu'il synchronise.

Un README soigné contenant une commande d'installation cassée est pire qu'un README
sommaire qui ne se trompe pas : le premier contact avec le produit devient un message
d'erreur.

---

## 6. Plan de nettoyage

Volumétrie : 1 fichier à supprimer (210 lignes), 2 à fusionner (333 lignes), 9 à corriger
ponctuellement, 3 ajouts recommandés.

**Priorité haute, casse un parcours**
1. `gemini-engine.ts:48` et `README.md:57` : corriger le paquet en `@google/gemini-cli`.
   Le correctif dans le code prime, c'est lui que l'utilisateur copie depuis l'application.
2. `README.md:92` : corriger le chemin des données, conséquence de confidentialité.
3. `CONTRIBUTING.md:39` et `.github/PULL_REQUEST_TEMPLATE.md` : corriger la commande.
4. `exploitation.md:386` : retirer l'affirmation de sécurité fausse.

**Priorité moyenne**
5. Supprimer `docs/audit-pages-2026-04-11.md` (210 lignes), qui décrit une navigation à
   huit écrans et un mécanisme de repli supprimé depuis.
6. Fusionner les deux documents de mai en un seul, sous un bandeau « historique, en
   grande partie réalisé ». Sans cela, un contributeur perdra du temps à recorriger des
   problèmes déjà résolus.
7. Corriger les 20 liens absolus de `architecture.md` et `skills-codex.md`.
8. Corriger les deux URLs de `.github/ISSUE_TEMPLATE/config.yml`.
9. Régénérer `AGENTS.md` ou clarifier son rôle face à `CLAUDE.md`.

**Priorité basse**
10. Ajouter une ou deux captures au README, meilleur rapport valeur sur effort du lot.
11. Lier `CODE_OF_CONDUCT.md`, pointer les Releases comme changelog.
12. Corriger « six » en « cinq » dans `editorial-iteration-playbook.md:34`.

Confirmés à jour, aucune action : `parcours-utilisateur.md`, `guide-decouverte.md`,
`fonctionnalites.md`, `editorial-doctrine.md`, `CODE_OF_CONDUCT.md`, `LICENSE`,
`SECURITY.md`, `TODO.md`, les gabarits d'issues, `ci.yml`.

# Audit GhostwrAIter — technique, distribution, confidentialité & fonctionnel

> Date : 2026-05-30 · Version auditée : v1.3.0 (`aa9f7fb`) · Audit statique (code lu, app non exécutée)
> Hypothèse d'audience validée : **grand public non-technique**, install CLI assumée, compensée par un **onboarding guidé** dans l'app.

> ⚠️ **CORRECTIF (vérifié depuis, voir `plan-action-amelioration-2026-05.md` §0)** : deux affirmations ci-dessous sont **fausses**. (1) Les « 2 skills orphelins » (topic-generator, news-to-post) **ne sont PAS orphelins** — leurs boutons existent dans `IdeaSelector.tsx` (route `/creer`), câblage de bout en bout, effort = 0. L'erreur venait d'avoir cherché un composant `IdeasScreen` (ancien nom pré-009). (2) `eval:editorial` **fonctionne** : il était bloqué par l'absence de build + des fixtures périmées (clé `persona` rejetée par le schéma Zod strict) — diagnostic et fix dans le plan d'action.

---

## 0. TL;DR

1. **Le choix Electron local-first était le bon.** Pour la stratégie retenue (CLI OAuth pour éviter les frais de tokens API + onboarding qui pilote l'install), une web-app est *techniquement impossible* : seul un binaire local peut détecter, lancer et vérifier un CLI installé sur la machine de l'utilisateur. Electron n'est pas un pis-aller ici, c'est le seul outil qui rend la stratégie réalisable.
2. **L'argument confidentialité tient — mais doit être formulé correctement.** Les données *au repos* (stratégie, idées, brouillons) restent sur la machine de l'utilisateur. En revanche, le texte des prompts de génération **part chez le fournisseur LLM** (OpenAI/Anthropic/Google via le CLI). C'est vrai dans *toutes* les architectures — une web-app enverrait aussi le contenu au LLM — donc ce n'est pas un argument contre le local-first. Le vrai gain confidentialité du local-first : **aucune custody des données utilisateur par toi** (pas de serveur central, pas de responsabilité RGPD de traitement, pas de point de fuite unique).
3. **Le vrai chantier de distribution n'est pas Electron — c'est la friction d'install + les gaps packaging.** Pas de code signing, pas de notarization, pas d'auto-update, et surtout **pas d'onboarding guidé** pour l'install du CLI. Pour du grand public, ces quatre points sont bloquants et tous corrigeables sans changer d'architecture.
4. **Fonctionnellement : socle solide mais pipeline incomplet.** 5 écrans complets, 6/8 skills câblés (2 orphelins : génération d'idées et news→post ont le code backend mais zéro UI), publication LinkedIn = copier-coller manuel uniquement, qualité éditoriale jamais mesurée (`eval:editorial` jamais lancé).

---

## 1. Pertinence de la techno pour la distribution

### 1.1 Electron est-il pertinent ? Oui — et requis par ta stratégie

Ta stratégie : **CLI via OAuth** (Codex/Claude/Gemini) pour passer par l'abonnement de l'utilisateur et **ne payer aucun token API**. Cette décision a une conséquence architecturale forte :

| Capacité requise | Web-app | Electron |
|---|---|---|
| Détecter un binaire CLI installé localement | ❌ Impossible (sandbox navigateur) | ✅ `find-cli-binary.ts` scanne le PATH |
| Lancer `codex exec` / `claude --print` en sous-process | ❌ Impossible | ✅ `spawnSync` |
| Lire `codex login status` / `claude auth status` | ❌ Impossible | ✅ déjà fait |
| Stocker les données 100% chez l'utilisateur | ⚠️ nécessite IndexedDB limité | ✅ SQLite natif |
| Piloter un onboarding qui installe le CLI | ❌ Impossible | ✅ faisable |

**Conclusion : pour un produit qui repose sur des CLI OAuth locaux, Electron n'est pas un choix par défaut paresseux — c'est la seule techno qui marche.** Une web-app t'obligerait à abandonner le modèle CLI-OAuth et à repasser sur des clés API que *tu* paies. Ton instinct était juste.

> Note : Tauri serait l'alternative « Electron en plus léger » (bundle ~10× plus petit, backend Rust). Migrer maintenant serait coûteux pour un gain marginal. À garder en tête seulement si le poids du binaire (~150-200 Mo) devient un frein à l'adoption grand public.

### 1.2 Viabilité des moteurs CLI (ta question sur Claude `-p`)

Vérifié sur ta machine, Claude Code **2.1.158** :

- ✅ `-p` / `--print` **existe toujours**. Le code (`claude-engine.ts:59`) utilise déjà `--print` (forme longue), donc même robustesse.
- ✅ `claude auth status` renvoie un JSON exploitable (`{"loggedIn": true, "authMethod": "claude.ai", "apiProvider": "firstParty"}`), exit code 0. La détection d'auth du code fonctionne.
- ✅ `authMethod: claude.ai` confirme que **l'OAuth abonnement est utilisé, aucun token API facturé**. Ta stratégie de coût marche.

**Ta crainte sur la disparition de `-p` est infondée.** Le moteur Claude de GhostwrAIter est pleinement fonctionnel aujourd'hui.

**⚠️ Mais un risque réel de maintenance existe :** tu dépends de l'API en ligne de commande de **trois fournisseurs** (`codex exec`, `claude --print`, `gemini`). Ces CLI évoluent vite et sans garantie de stabilité (tu viens d'en faire l'expérience avec ta question sur `-p`). Chaque mise à jour d'un de ces outils peut casser un flag, un format de sortie JSON, ou une sous-commande d'auth. **Préconisation** : ajouter un test d'intégration « smoke » par moteur (lancer un prompt trivial, valider que la sortie parse) lancé en CI hebdomadaire, pour détecter une rupture amont avant tes utilisateurs.

### 1.3 Gaps packaging — bloquants pour le grand public, tous corrigeables

| Aspect | État actuel | Impact grand public | Priorité |
|---|---|---|---|
| **Code signing macOS** | ❌ Absent | Gatekeeper : « développeur non identifié », l'app refuse de s'ouvrir au double-clic | 🔴 Critique |
| **Notarization macOS** | ❌ Absent | Même sans signing, macOS bloque de plus en plus durement les apps non notarisées | 🔴 Critique |
| **Signing Windows (Authenticode)** | ❌ Absent | SmartScreen : « Windows a protégé votre PC », clic supplémentaire dissuasif | 🔴 Critique |
| **Auto-update** | ❌ Absent (`electron-updater` non installé) | L'utilisateur doit re-télécharger manuellement depuis GitHub. Inacceptable grand public. | 🟠 Haute |
| **better-sqlite3 multi-OS** | ✅ Géré (rebuild par target en CI) | OK | 🟢 |
| **CI/CD multi-OS** | ✅ Matrix mac/win/linux + release draft | OK | 🟢 |

**Coûts réels pour lever les bloquants :**
- macOS : compte Apple Developer (99 $/an) + `electron-builder` gère signing+notarization nativement via variables d'env (`CSC_LINK`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`). ~1 journée de setup CI.
- Windows : certificat Authenticode (OV ~100-300 $/an, ou EV pour réputation SmartScreen immédiate ~300-500 $/an). Même mécanisme `electron-builder`.
- Auto-update : `electron-updater` + publication sur GitHub Releases (déjà ta cible) ou un bucket S3. ~1 journée.

> VS Code, Slack, Notion, Figma desktop sont tous des apps Electron distribuées à des dizaines de millions de non-techniciens. **Electron n'est pas le problème de distribution — l'absence de signing/notarization/auto-update l'est.**

### 1.4 LE chantier central pour le grand public : l'onboarding d'install CLI

C'est ici que se joue ton pari « grand public qui installe quand même le CLI ». **Aujourd'hui, cet onboarding n'existe pas.** L'app détecte l'absence de CLI et échoue avec un message d'erreur (`ENGINE_UNAVAILABLE`), et l'écran Paramètres affiche bien les commandes d'install (`installCommand`, `loginCommand` exposées par `getStatus()`), mais **il n'y a aucun assistant pas-à-pas piloté** au premier lancement.

Pour ton audience, c'est LE livrable manquant prioritaire. Un wizard premier-lancement devrait :

1. Détecter l'OS et l'état (Node présent ? CLI présent ? authentifié ?).
2. Guider visuellement chaque étape manquante avec boutons d'action :
   - « Installer Node » → lien direct ou détection package manager.
   - « Installer le moteur IA » → afficher/copier la commande, idéalement la lancer dans un terminal embarqué ou via `spawn` avec feedback live.
   - « Se connecter » → lancer `codex login` / `claude login` et afficher le statut OAuth en temps réel.
3. Re-vérifier en boucle jusqu'au vert, puis débloquer l'app.
4. Choisir le moteur préféré parmi ceux détectés (Codex/Claude/Gemini).

Sans ce wizard, le taux d'abandon grand public au premier lancement sera proche de 100 %.

---

## 2. Audit confidentialité (correctif important)

### 2.1 Ce qui reste local vs ce qui part

| Donnée | Où elle vit |
|---|---|
| Stratégie éditoriale (profil, offres, ICP, piliers, voix) | 💾 SQLite local |
| Idées, brouillons, variantes, versions | 💾 SQLite local |
| Calendrier éditorial, statuts | 💾 SQLite local |
| Logs d'exécution (prompts + réponses complètes) | 💾 Fichiers JSON locaux (purgeables via UI) |
| **Texte des prompts de génération** | ☁️ **Transmis au LLM** (OpenAI/Anthropic/Google) via le CLI |

### 2.2 Le point à corriger dans ton raisonnement

Tu as choisi le local-first « pour la confidentialité des données utilisateur ». **C'était un bon choix**, mais il faut être précis sur ce qu'il protège :

- ✅ **Ce que le local-first protège vraiment** : tu n'héberges *aucune* donnée utilisateur. Pas de serveur central = pas de fuite massive possible, pas de responsabilité de traitement RGPD côté AutomatisIA, chaque machine est isolée. C'est un avantage **réel et durable** sur une web-app.
- ⚠️ **Ce que le local-first NE protège PAS** : le contenu des posts générés transite par les serveurs du fournisseur LLM. **Mais c'est vrai aussi pour une web-app** — n'importe quelle architecture qui appelle un LLM cloud envoie le contenu au LLM. Donc ce n'est *pas* un argument qui départage local-first vs web-app ; c'est une constante des deux.

**En clair : le contenu qui part chez OpenAI/Anthropic n'est pas une faiblesse de ton choix Electron. Ç'aurait été identique en web-app — et en web-app, en plus, tu aurais hébergé toutes les données au repos.**

### 2.3 Si tu veux pousser l'argument confidentialité plus loin

- **Annoncer honnêtement** dans l'app/la doc : « vos données restent sur votre machine ; le texte que vous générez est envoyé à votre fournisseur IA (OpenAI/Anthropic/Google) sous *votre* compte, soumis à *leur* politique. »
- Avantage du modèle CLI-OAuth que tu n'exploites pas encore en argument marketing : **c'est l'utilisateur, sous son propre compte ChatGPT/Claude, qui envoie ses données — pas toi.** Tu n'es jamais intermédiaire de leurs données. C'est plus protecteur qu'une web-app où tu serais responsable de traitement.
- Pour les utilisateurs les plus sensibles : documenter que ChatGPT Team / les réglages zéro-rétention coupent l'usage des données pour l'entraînement. Option future : moteur **local embarqué** (Ollama) pour un mode « rien ne quitte la machine », au prix de la qualité éditoriale.

### 2.4 Posture sécurité technique — solide

`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`. CSP stricte en prod (`connect-src 'self'` → aucun appel réseau depuis le renderer). Garde-fous de navigation (`will-navigate` + `setWindowOpenHandler`). DevTools production-gated. Validation du workspace root (5 règles anti-traversal). Allowlist DDL pour `ensureColumn()`. `npm audit` zéro vuln. **Rien à redire — c'est du bon travail (feature 002).**

---

## 3. Audit fonctionnel — complète & efficace ?

### 3.1 Ce qui marche (complet)

- **5 écrans pleinement fonctionnels** : Cockpit, Stratégie (6 onglets éditables + génération de socle), Créer/Atelier (pipeline 4 étapes cadrage→structure→hook→draft), Bibliothèque (drafts + planning), Paramètres. Routes legacy redirigées proprement. Aucun écran placeholder, aucun TODO/stub dans le code.
- **Pipeline éditorial de bout en bout** : stratégie → idée → atelier → brouillon → calendrier → (copier-coller) publication.
- **6/8 skills câblés** : structure-selector, hook-engine, post-writer, post-editor, repurpose, strategy-foundation.
- **Persistance robuste** : ~11 tables SQLite, versionnage des brouillons, migrations non-destructives via `ensureColumn()` sous allowlist.
- **Gestion d'erreur soignée dans l'Atelier** : codes mappés en messages humains (`CODEX_CLI_FAILED`, `TIMEOUT`, `INVALID_JSON`…) + bannière dédiée.

### 3.2 Ce qui manque ou cloche (limites d'efficacité)

| Manque | Détail | Impact |
|---|---|---|
| **2 skills orphelins** | `linkedin-topic-generator` (génération d'idées depuis la stratégie) et `linkedin-news-to-post` (idée depuis une actu) ont leur code backend + endpoint IPC, mais **zéro bouton dans l'UI**. | L'utilisateur ne peut pas générer d'idées automatiquement ni partir d'une veille — il doit tout saisir manuellement. Deux promesses produit dormantes à ~1 jour de wiring chacune. |
| **Publication LinkedIn = manuelle** | Aucune intégration API. `status='published'` est un simple drapeau local. Publication = copier-coller. | Voir 3.3 — ce n'est probablement *pas* une paresse mais une contrainte d'API. À assumer comme tel. |
| **Qualité éditoriale jamais mesurée** | `npm run eval:editorial` (harness existant) **jamais lancé** sur les 8 prompts. Le « litmus test » (ça sonne comme Philippe ?) n'a pas de baseline chiffrée. | C'est le cœur du produit. Sans mesure, impossible de dire si les posts générés sont *publiables*. À lancer en priorité. |
| **UX d'erreur inégale** | Atelier = robuste ; Bibliothèque/Calendrier = feedback générique, erreurs de copie presse-papier avalées silencieusement. | Frustration grand public en cas d'échec hors atelier. |
| **Prompts inline dans le code** | Les 30+ règles éditoriales par skill sont codées en dur dans `codex-cli-runner.ts`, pas dans les `SKILL.md` (qui sont des stubs). | Itérer sur la qualité éditoriale exige une recompilation TypeScript. Frein direct au chantier qualité. (Chantier 4 déjà identifié.) |
| **Risque ideaId orphelin** | Supprimer une idée pendant un atelier en cours → le flow continue avec un `ideaId` mort → crash potentiel à l'étape 4. | Bug latent, edge-case. |

### 3.3 Sur la « vraie » publication LinkedIn (avant d'en faire une roadmap)

L'API de publication LinkedIn (`w_member_social` / Community Management API) est **fortement verrouillée** : approbation partenaire LinkedIn requise, accès au posting sur profil personnel très restreint, process de validation long et incertain. **Le copier-coller manuel est probablement une nécessité, pas un raccourci.** Avant de promettre la publication automatique comme une évolution, il faut vérifier le tier d'accès réellement obtenable pour ton cas. Alternative réaliste : une extension navigateur qui pré-remplit le composeur LinkedIn (zone grise des CGU, à évaluer).

### 3.4 Verdict efficacité

L'app est **complète comme cockpit de production assistée** (de l'idée au brouillon calé), mais son **efficacité end-to-end n'est pas démontrée** tant que : (a) la qualité éditoriale n'est pas mesurée (`eval:editorial`), (b) la génération d'idées reste manuelle (skills orphelins), (c) la publication reste 100% manuelle. Un audit statique ne peut pas juger « est-ce que ça produit des posts que Philippe publierait vraiment » — seul `eval:editorial` + un test réel le diront.

---

## 4. Préconisations techniques priorisées

### 🔴 P0 — Bloquants distribution grand public
1. **Onboarding guidé d'install CLI** (wizard premier lancement, cf. §1.4). Sans lui, le grand public n'atteint jamais le premier post.
2. **Code signing + notarization macOS** et **signing Windows**. Sans eux, l'app est perçue comme un malware au lancement.
3. **Auto-update** (`electron-updater` + GitHub Releases).

### 🟠 P1 — Cœur produit / efficacité
4. **Lancer `npm run eval:editorial`** pour établir une baseline qualité, puis itérer sur les prompts. C'est la mesure de vérité du produit.
5. **Extraire les prompts inline → `SKILL.md`** (chantier 4) pour itérer la qualité sans recompiler. Prérequis pratique du point 4.
6. **Câbler les 2 skills orphelins** (génération d'idées + news→post) — code déjà là, il manque l'UI.

### 🟡 P2 — Robustesse & maintenance
7. **Smoke-test CI par moteur CLI** (hebdo) pour détecter les ruptures amont des CLI tiers avant les utilisateurs.
8. **Uniformiser l'UX d'erreur** Bibliothèque/Calendrier au niveau de l'Atelier ; ne plus avaler les erreurs de presse-papier.
9. **Corriger le edge-case ideaId orphelin** (supprimer une idée pendant un atelier actif).

### 🟢 P3 — Optionnel / horizon
10. **Mode moteur local embarqué (Ollama)** pour un argument « zéro donnée hors machine » fort, au prix de la qualité.
11. **Évaluer une extension navigateur** pour pré-remplir le composeur LinkedIn (si la publication semi-automatique a de la valeur).
12. **Tauri** : seulement si le poids du bundle Electron devient un frein mesuré à l'adoption.

---

## 5. Réponses directes à tes questions

**« La techno est-elle pertinente pour distribuer l'app ? »**
Oui. Electron est *requis* par ta stratégie CLI-OAuth (impossible en web-app). La distribution achoppe non pas sur Electron mais sur 4 manques corrigeables : onboarding, signing, notarization, auto-update.

**« Ai-je fait le bon choix en évitant la web-app pour la confidentialité ? »**
Oui, mais pour la bonne raison. Le local-first te dispense d'héberger les données utilisateur (pas de custody, pas de fuite centrale, pas de responsabilité RGPD de traitement) — *ça*, c'est le vrai gain. En revanche, le contenu généré part chez le LLM dans les deux architectures : ce n'est pas un point en faveur de l'un ou l'autre. Ton instinct était bon, ta justification mérite juste d'être reformulée.

**« L'app est-elle complète et efficace ? »**
Complète comme cockpit (5 écrans, pipeline bout-en-bout). Pas encore prouvée comme *efficace* : qualité éditoriale jamais mesurée, 2 skills d'entrée non câblés, publication manuelle. Lancer `eval:editorial` est le prochain pas de vérité.

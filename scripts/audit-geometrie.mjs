/* global window, document, getComputedStyle */
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron } from "playwright";

/**
 * Portes de recette geometriques de la direction visuelle.
 *
 * Sur ce projet, trois correctifs de mise en page ont ete annonces comme faits
 * alors qu ils ne l etaient pas, parce que le verdict avait ete rendu en lisant
 * le CSS. Une regle peut etre presente, syntaxiquement correcte, et pourtant
 * sans effet : `grid-row: 1 / -1` est inerte dans une grille implicite, un fond
 * translucide masque un cadre de focus, une specificite plus forte gagne
 * ailleurs dans la feuille. Rien de tout cela ne se voit a la lecture.
 *
 * Ce script mesure. Chaque porte est une assertion sur une valeur relevee dans
 * le rendu reel, pas sur une intention.
 *
 * Usage : npm run build puis node scripts/audit-geometrie.mjs
 */

const LARGEUR = 1400;
const HAUTEUR = 900;

const resultats = [];

/**
 * Une porte, avec un TROISIEME etat.
 *
 * `nonJoue` existe parce que ce script comptait des portes qu il n avait pas
 * jouees. Une porte enfermee dans un `if` disparaissait du total quand la
 * condition etait fausse, et le total restait plein : « 21 portes tenues sur
 * 21 » ne disait pas que trois d entre elles n avaient rien mesure. Une porte
 * qui ne peut pas mesurer doit le DIRE et rester au denominateur, sinon le
 * total change de taille avec les donnees et deux executions ne se comparent
 * plus.
 *
 * Une porte non jouee ne fait pas echouer le script : elle constate une
 * situation ou la propriete n a pas de sens. Elle est comptee a part, et une
 * porte d agregation verifie plus bas qu on n a pas TOUT esquive.
 */
function porte(nom, attendu, obtenu, passe, nonJoue = false) {
  resultats.push({ nom, attendu, obtenu, passe, nonJoue });
}

const maison = mkdtempSync(join(tmpdir(), "ghostwraiter-geometrie-"));
const espace = join(maison, "workspace");

/*
 * On mesure sur une COPIE de l espace reel quand il existe.
 *
 * Sur un espace vierge, la Bibliotheque ne rend aucune ligne, et les portes qui
 * portent sur une ligne ne trouvent rien a mesurer : elles s esquivaient en
 * silence et le total annoncait « tenues » sans les avoir jouees. C est
 * exactement le defaut trouve dans le test d accessibilite de cet ecran, dont
 * le montage mockait la liste a vide : il aurait passe en cassant tout l acces
 * clavier. Une porte qui ne peut pas mesurer doit le DIRE, jamais disparaitre.
 *
 * L espace d origine n est jamais ouvert : Electron ecrit dans la copie.
 */
const espaceReel = join(homedir(), "Library", "Application Support", "ghostwraiter", "workspace");
const surDonneesReelles = existsSync(espaceReel);
if (surDonneesReelles) {
  cpSync(espaceReel, espace, { recursive: true });
}

const app = await electron.launch({
  args: ["dist-electron/main/index.js"],
  env: {
    ...process.env,
    LINKEDIN_POSTER_WORKSPACE_ROOT: espace
  }
});

const page = await app.firstWindow();
page.setDefaultTimeout(30000);
await page.setViewportSize({ width: LARGEUR, height: HAUTEUR });
await page.waitForTimeout(2500);

try {
  // La visite guidee s ouvre automatiquement sur un espace vierge et son voile
  // intercepte tous les clics. On la ferme avant de mesurer.
  const fermer = page.getByRole("button", { name: /Fermer|Terminer|Passer/i });
  if (await fermer.first().isVisible().catch(() => false)) {
    await fermer.first().click();
    await page.waitForTimeout(400);
  }

  // ---- Porte 1 : la fenetre ne defile jamais.
  // C est la propriete structurelle dont decoule tout le reste. Si le document
  // peut defiler, l en-tete peut sortir de l ecran, quelle que soit la regle
  // qui pretend l en empecher.
  const defilementDocument = await page.evaluate(() => ({
    hauteurDocument: document.documentElement.scrollHeight,
    hauteurFenetre: window.innerHeight,
    hauteurCorps: document.body.scrollHeight
  }));
  porte(
    "La fenetre ne defile pas",
    "scrollHeight du document <= innerHeight",
    `${defilementDocument.hauteurDocument} contre ${defilementDocument.hauteurFenetre}`,
    defilementDocument.hauteurDocument <= defilementDocument.hauteurFenetre + 1
  );

  // ---- Porte 2 : la barre laterale fait 232px.
  const largeurBarre = await page
    .locator(".sidebar")
    .evaluate((n) => n.getBoundingClientRect().width);
  porte("Largeur de la barre laterale", "232 px", `${largeurBarre} px`, Math.round(largeurBarre) === 232);

  // ---- Porte 3 : l en-tete de page reste en haut apres defilement du corps.
  // Le defaut a ete signale trois fois : « le haut de l app n est plus visible
  // quand on change d ecran ». On defile le corps au maximum, puis on verifie
  // que la barre n a pas bouge d un pixel.
  async function enTeteFixe(chemin, nom) {
    await page.evaluate((c) => {
      window.location.hash = c;
    }, chemin);
    await page.waitForTimeout(900);
    await page
      .locator(".route-transition")
      .evaluate((n) => Promise.all(n.getAnimations({ subtree: true }).map((a) => a.finished)))
      .catch(() => undefined);

    const barre = page.locator(".page__bar");
    if ((await barre.count()) === 0) {
      porte(`En-tete fixe sur ${nom}`, "une barre .page__bar", "aucune barre trouvee", false);
      return;
    }

    const avant = await barre.evaluate((n) => n.getBoundingClientRect().top);
    const releve = await page.evaluate(() => {
      const corps = document.querySelector(".page__body");
      if (!corps) return null;
      corps.scrollTop = 0;
      corps.scrollTop = 999_999;
      const atteint = corps.scrollTop;
      const cadre = document.querySelector(".page");
      return {
        atteint,
        debordant: corps.scrollHeight > corps.clientHeight + 1,
        // `?? 0` rendait 0 quand `.page` avait disparu, et `0 <= 901` passait :
        // la porte anti-tautologie devenait elle-meme tautologique des que son
        // selecteur mourait. On rapporte donc l ABSENCE, jamais un zero.
        cadreTrouve: Boolean(cadre),
        hauteurPage: cadre ? Math.round(cadre.getBoundingClientRect().height) : null,
        hauteurFenetre: window.innerHeight
      };
    });
    await page.waitForTimeout(200);
    const apres = await barre.evaluate((n) => n.getBoundingClientRect().top);

    /*
     * L en-tete ne peut etre eprouve que si le corps DEBORDE.
     *
     * L ancienne porte poussait `scrollTop` au maximum puis constatait que la
     * barre n avait pas bouge. Sur un ecran dont le corps ne deborde pas,
     * `scrollTop` reste a zero et la barre aussi : elle passait sans rien
     * prouver, cinq fois de suite. Retirer l epinglage de `.page__bar` de la
     * feuille ne l aurait pas fait tomber.
     *
     * Le defilement effectif fait desormais partie de l assertion, il n est
     * plus une porte separee enfermee dans un `if (releve.debordant)` qui ne
     * s executait ni en succes ni en echec. Et quand le corps ne deborde pas,
     * la porte se declare non jouable au lieu de s attribuer un vert.
     */
    const mesurable = Boolean(releve && releve.debordant);

    porte(
      `En-tete fixe sur ${nom}`,
      "position inchangee apres un defilement REEL du corps",
      mesurable
        ? `${avant} px puis ${apres} px, ${Math.round(releve.atteint)} px defiles`
        : "le corps ne deborde pas a cette taille de fenetre, l en-tete ne peut pas bouger",
      mesurable && Math.abs(avant - apres) < 1 && releve.atteint > 0,
      !mesurable
    );

    // Porte anti-tautologie. La verification ci-dessus poussait `scrollTop` au
    // maximum puis constatait que l en-tete n avait pas bouge. Quand RIEN ne
    // defile, `scrollTop` reste a zero et l en-tete aussi : elle passait sans
    // rien prouver. Elle a effectivement laisse passer un ecran Parametres dont
    // le bas etait inatteignable, signale par le proprietaire.
    //
    // La cause etait `min-height: auto` sur `.page` : un enfant de conteneur
    // flex refuse de se reduire sous la hauteur de son contenu, donc `flex: 1`
    // ne le borne pas. `.page` faisait 2 538 px dans un parent de 900, et le
    // corps heritait de toute la hauteur du contenu. On mesure donc les deux
    // faits qui l auraient revele.
    porte(
      `Hauteur de page bornee sur ${nom}`,
      "un cadre .page mesurable, <= hauteur de la fenetre",
      releve
        ? releve.cadreTrouve
          ? `${releve.hauteurPage} px sur ${releve.hauteurFenetre} px`
          : "cadre .page introuvable, rien a mesurer"
        : "corps .page__body introuvable",
      Boolean(releve?.cadreTrouve) && releve.hauteurPage <= releve.hauteurFenetre + 1
    );
  }

  await enTeteFixe("#/", "Cockpit");
  await enTeteFixe("#/strategie", "Strategie");
  await enTeteFixe("#/creer", "Creer");
  await enTeteFixe("#/bibliotheque", "Bibliotheque");
  await enTeteFixe("#/parametres", "Parametres");

  /*
   * Porte d agregation : au moins un ecran doit avoir REELLEMENT defile.
   *
   * Sans elle, les cinq portes precedentes pourraient toutes se declarer non
   * jouables et l audit conclurait sans avoir jamais eprouve l epinglage de
   * l en-tete. Une famille entiere de portes esquivees en silence est ce que ce
   * script est cense empecher : elle doit se voir sur UNE ligne rouge, pas se
   * deduire d un total qui a change de taille.
   */
  const enTetesEprouvees = resultats.filter(
    (r) => r.nom.startsWith("En-tete fixe sur ") && !r.nonJoue
  );
  porte(
    "L en-tete a ete eprouve sous un defilement reel",
    "au moins un des cinq ecrans deborde et a pu etre mesure",
    `${enTetesEprouvees.length} ecran(s) sur 5 : ${
      enTetesEprouvees.map((r) => r.nom.replace("En-tete fixe sur ", "")).join(", ") || "aucun"
    }`,
    enTetesEprouvees.length >= 1
  );

  // ---- Porte 4 : densite de l onglet Profil de la Strategie, aides repliees.
  //
  // Ce que cette porte mesurait avant, et pourquoi son verdict ne dependait pas
  // de la mise en page.
  //
  // Elle relevait la hauteur de la section moins celle des champs, sur l etat
  // d arrivee de l ecran. Or cet etat est une PREFERENCE UTILISATEUR. Les aides
  // sont repliees par defaut, mais leur repli est persiste dans `app_settings`
  // sous la cle `strategy_help_expanded`, et ce script mesure sur une COPIE de
  // l espace reel. Sur la machine du proprietaire, qui avait deplie les quatre
  // aides du Profil, la porte relevait 414 px et tombait ; sur un espace
  // vierge, la meme porte relevait 167 px et passait. Le verdict suivait le
  // dernier clic de celui qui lance l audit, jamais la feuille de style. Une
  // porte dont le nom dit « aides repliees » et qui mesure ce qu on lui donne
  // n atteste rien.
  //
  // Les 294,7 px qui manquaient a l appel, releves dans le rendu :
  //   - les quatre paragraphes d aide deplies pesent 43,4 + 65,1 + 65,1 + 65,1
  //     = 238,7 px ;
  //   - chacun ouvre une deuxieme rangee dans la grille de sa ligne, donc
  //     quatre fois le `row-gap` de 14 px, soit 56 px.
  // Le cout par rangee valait ainsi 20 px de rembourrage, 1 px de filet, et
  // 14 + 65 px d aide DEPLIEE. Rien d inexplique, rien a corriger dans la
  // feuille : 414 px etait le cout de l onglet aides ouvertes, mesure contre un
  // seuil etabli aides fermees.
  //
  // Ce que la porte mesure desormais, et pourquoi ses seuils descendent.
  //
  // Le script force l etat qu il annonce, le VERIFIE avant de conclure, et
  // mesure deux grandeurs contre deux reperes distincts.
  //
  // Le seuil de 340 px vient de la maquette, ou il portait sur une HAUTEUR
  // TOTALE : « 304 px replie, contre 1 040 px aujourd hui ». Depuis que
  // `field-sizing: content` fait grandir les champs avec leur contenu, cette
  // porte soustrait la hauteur des champs, ce qui est juste. Mais garder au
  // passage le nombre de la maquette compare un cout de structure a un seuil
  // de hauteur totale : 255 px de jeu sur une grandeur qui en vaut 85. Une
  // porte a ce niveau n aurait plus rien arrete. Les seuils redescendent donc
  // sur la grandeur reellement mesuree, chacun derive du dessin :
  //   - formulaire seul : quatre rangees a 20 px de rembourrage, trois filets,
  //     deux bordures de surface, soit 85 px de dessin. Releve : 85 px, sur un
  //     profil vide comme sur un profil rempli, l aide repliee sortant du flux.
  //     Seuil 120 px, 35 px de jeu ;
  //   - onglet entier : le formulaire plus l indicateur de completude, seul
  //     bloc dont la hauteur depend du contenu (68 px quand les quatre champs
  //     manquent et que la ligne de consequence tient sur deux lignes, 20 px
  //     quand tout est rempli, plus 14 px de marge). Releve : 167 px a vide,
  //     119 px rempli. Seuil 200 px.
  await page.evaluate(() => {
    window.location.hash = "#/strategie";
  });
  await page.waitForTimeout(900);

  // Le repli est pilote ici, jamais herite de l espace mesure. On passe par les
  // boutons de chaque ligne plutot que par la bascule globale : leur etat se
  // lit sur `aria-expanded`, la boucle est donc idempotente quel que soit
  // l etat de depart, et elle ne depend d aucun autre composant.
  const basculerAides = (ouvrir) =>
    page.evaluate((o) => {
      const boutons = Array.from(
        document.querySelectorAll(".strategy-section .strategy-row__help-toggle")
      );
      for (const bouton of boutons) {
        if ((bouton.getAttribute("aria-expanded") === "true") !== o) bouton.click();
      }
      return boutons.length;
    }, ouvrir);

  const mesurerProfil = () =>
    page.evaluate(() => {
      const section = document.querySelector(".strategy-section");
      const surface = section?.querySelector(".strategy-surface");
      if (!section || !surface) return null;
      const champs = Array.from(surface.querySelectorAll("textarea, input"));
      const hauteurChamps = champs.reduce(
        (total, n) => total + n.getBoundingClientRect().height,
        0
      );
      const aides = Array.from(section.querySelectorAll(".strategy-row__help"));
      return {
        // Cout de STRUCTURE : tout ce qui n est pas le champ lui-meme.
        // Libelles, rembourrages, filets, et pour l onglet l indicateur de
        // completude, que la maquette place hors de la surface de saisie.
        formulaire: Math.round(surface.getBoundingClientRect().height - hauteurChamps),
        onglet: Math.round(section.getBoundingClientRect().height - hauteurChamps),
        champs: champs.length,
        plusHautChamp: champs.length
          ? Math.round(Math.max(...champs.map((n) => n.getBoundingClientRect().height)))
          : 0,
        // Etat reellement rendu au moment de la mesure, pas etat demande.
        aidesDepliees: aides.filter((n) => getComputedStyle(n).display !== "none").length
      };
    });

  const basculesTrouvees = await basculerAides(true);
  await page.waitForTimeout(400);
  const profilDeplie = await mesurerProfil();
  await basculerAides(false);
  await page.waitForTimeout(400);
  const profil = await mesurerProfil();

  /*
   * Le depliage a-t-il eu lieu ?
   *
   * `basculerAides` rendait le nombre de boutons trouves et cette valeur etait
   * JETEE. Renommer `.strategy-row__help-toggle` suffisait a ce que la boucle
   * ne clique rien : `profilDeplie` devenait identique a `profil`, les trois
   * portes du Profil restaient vertes puisqu elles n assertent que
   * `aidesDepliees === 0`, et le detail affichait « N px les quatre aides
   * ouvertes » sur une mesure prise aides FERMEES. C est le defaut que la porte
   * « Les champs longs sont bornes » venait de corriger, reintroduit un cran
   * plus haut : un texte fixe a la place d une mesure.
   */
  porte(
    "L etat deplie est reellement atteint avant de mesurer le replie",
    "4 bascules d aide trouvees, 4 aides visibles une fois ouvertes",
    `${basculesTrouvees} bascule(s) trouvee(s), ${
      profilDeplie ? profilDeplie.aidesDepliees : "?"
    } aide(s) visible(s) apres ouverture`,
    basculesTrouvees === 4 && profilDeplie?.aidesDepliees === 4
  );

  if (!profil || !profilDeplie) {
    porte(
      "Cout de structure du formulaire Profil",
      "<= 120 px hors hauteur des champs",
      "surface de saisie introuvable",
      false
    );
  } else {
    // `aidesDepliees === 0` fait partie de l assertion, et le compte est
    // affiche : si le repli echoue un jour, la porte tombe en le disant, au
    // lieu de mesurer sans bruit un autre etat que celui qu elle nomme.
    // `champs === 4` refuse de conclure sur un formulaire qui n est plus celui
    // qu on croit mesurer : un cout de structure faible sur zero champ rendu
    // serait un vert vide.
    porte(
      "Cout de structure du formulaire Profil",
      "<= 120 px hors hauteur des champs, 4 champs, aides repliees",
      `${profil.formulaire} px sur ${profil.champs} champs, ${profil.aidesDepliees} aide(s) depliee(s) ; ${profilDeplie.formulaire} px les quatre aides ouvertes`,
      profil.champs === 4 && profil.aidesDepliees === 0 && profil.formulaire <= 120
    );
    porte(
      "Cout de structure de l onglet Profil",
      "<= 200 px hors hauteur des champs, indicateur de completude compris",
      `${profil.onglet} px, dont ${profil.onglet - profil.formulaire} px d indicateur`,
      profil.champs === 4 && profil.aidesDepliees === 0 && profil.onglet <= 200
    );
    // Le plafond mesure est celui que la feuille declare, `max-height: 320px`
    // sur les zones de texte. La version precedente de cette porte assertait
    // `section - chrome > 0`, soit « la somme des hauteurs de champs est
    // positive », et affichait un texte fixe a la place de sa mesure : elle
    // etait verte sur n importe quel rendu ou un champ existe.
    porte(
      "Les champs longs sont bornes",
      "aucun champ au dela des 320 px de max-height",
      `plus haut champ ${profil.plusHautChamp} px`,
      profil.champs === 4 && profil.plusHautChamp > 0 && profil.plusHautChamp <= 320
    );
  }

  // ---- Porte 5 : sur Creer, l action primaire est atteignable sans defiler.
  await page.evaluate(() => {
    window.location.hash = "#/creer";
  });
  await page.waitForTimeout(900);
  const actionVisible = await page.evaluate((hauteur) => {
    const boutons = Array.from(
      document.querySelectorAll('.ds-button[data-variant="primary"]')
    );
    if (boutons.length === 0) return null;

    /*
     * Un rectangle n est pas une visibilite.
     *
     * La version precedente ne retenait que `r.bottom <= hauteur && r.top >= 0`.
     * Un bouton en `opacity: 0`, en `visibility: hidden` ou en
     * `pointer-events: none` garde exactement le meme rectangle : la porte
     * restait verte alors que l action etait invisible ou inerte. On mesure donc
     * aussi ce que la feuille en fait, et la largeur non nulle, qu un parent
     * replie a zero laisserait passer.
     */
    const juger = (b) => {
      const r = b.getBoundingClientRect();
      const style = getComputedStyle(b);
      const refus = [];
      if (r.bottom > hauteur || r.top < 0) refus.push("hors du pli");
      if (r.width <= 0 || r.height <= 0) refus.push("rectangle nul");
      if (style.visibility === "hidden") refus.push("visibility:hidden");
      if (style.display === "none") refus.push("display:none");
      if (style.pointerEvents === "none") refus.push("pointer-events:none");
      /*
       * Le seuil d opacite vise l INVISIBILITE, pas l opacite pleine.
       *
       * Une premiere version exigeait `> 0.99` et la porte est tombee sur le
       * rendu reel : l unique action primaire de Creer est desactivee tant que
       * le formulaire est vide, et la feuille la rend a 0,55. C est l etat
       * normal de l ecran, pas un defaut. Une porte qui crie au loup sur un
       * rendu correct se fait desactiver, et elle ne protege plus rien.
       * `<= 0.1` distingue ce que la porte doit attraper, une action rendue
       * invisible, de ce qu elle doit tolerer, une action attenuee.
       */
      if (Number.parseFloat(style.opacity) <= 0.1) refus.push(`opacity:${style.opacity}`);
      return refus;
    };

    const jugements = boutons.map(juger);
    const rects = boutons.map((b) => b.getBoundingClientRect());
    const dansLePli = rects.filter((r) => r.bottom <= hauteur && r.top >= 0);

    return {
      total: boutons.length,
      dansLePli: dansLePli.length,
      atteignables: jugements.filter((refus) => refus.length === 0).length,
      // `disabled` n est PAS un motif de refus : un bouton primaire desactive
      // tant que le formulaire est incomplet est un etat normal de l ecran, et
      // la porte porte sur l atteignabilite, pas sur l activation. Il est
      // rapporte pour que la ligne reste lisible.
      desactives: boutons.filter((b) => b.disabled).length,
      refus: jugements.filter((refus) => refus.length > 0).map((refus) => refus.join("+")),
      basLePlusHaut: Math.round(Math.min(...rects.map((r) => r.bottom)))
    };
  }, HAUTEUR);
  if (actionVisible) {
    porte(
      "Action primaire de Creer sous le pli",
      "au moins une action primaire visible, opaque et cliquable sans defiler",
      `${actionVisible.atteignables} atteignable(s) sur ${actionVisible.total}, ${actionVisible.dansLePli} dans le pli, ${actionVisible.desactives} desactive(s), bas a ${actionVisible.basLePlusHaut} px${
        actionVisible.refus.length > 0 ? ` ; refus : ${actionVisible.refus.join(" | ")}` : ""
      }`,
      actionVisible.atteignables >= 1
    );
  } else {
    porte("Action primaire de Creer", "au moins une", "aucun bouton primaire", false);
  }

  // ---- Portes de l ecran de triage de la Bibliotheque.
  //
  // Elles remplacent trois portes qui visaient `.library-row`, selecteur disparu
  // avec la refonte en deux volets. Elles n ont pas disparu en silence : elles
  // ont ECHOUE, parce que ce script exige de pouvoir mesurer et le dit quand il
  // ne le peut pas. C est ce qui a permis de les reecrire, au lieu de croire un
  // total qui n aurait plus rien couvert.
  //
  // Ce qu elles verifient tient a l argument meme de la refonte : on juge un
  // brouillon en le LISANT, pas en lisant sa fiche. Il faut donc qu un texte
  // soit reellement rendu, que le repli a 210 caracteres y soit trace, et que
  // le volet de triage defile de son cote sans emporter la page.
  await page.evaluate(() => {
    window.location.hash = "#/bibliotheque";
  });
  await page.waitForTimeout(1500);

  const triage = await page.evaluate(() => {
    // Le conteneur DEFILANT est `.library-triage__scroll`, pas
    // `.library-groups`, qui est en `overflow: visible`. Sonder le mauvais
    // element rendait `voletDebordant` faux, et la porte du defilement, placee
    // dans ce test, ne s executait jamais : ni succes, ni echec, silence. C est
    // le quatrieme cas de cette famille cette nuit, et il a ete signale par le
    // chantier qui a construit l ecran, pas par ce script.
    const volet = document.querySelector(".library-triage__scroll");
    const groupes = document.querySelector(".library-groups");
    if (!volet || !groupes) return null;
    const lecteur = document.querySelector(".library-reader__text");
    const lignes = document.querySelectorAll(".library-triage-row");
    const repli = document.querySelector(".library-reader__fold");

    volet.scrollTop = 0;
    volet.scrollTop = 999999;
    const defilementVolet = volet.scrollTop;
    volet.scrollTop = 0;

    // Mesure typographique reelle, pas theorique. La colonne de lecture etait
    // annoncee a 68 caracteres et tombait a 43 une fois la barre laterale de
    // 232 px deduite : le volet droit perdait alors sa raison d etre, qui est
    // de rendre le texte LISIBLE. On releve la largeur d un caractere dans la
    // police effectivement rendue plutot que de supposer une valeur.
    let mesureCaracteres = 0;
    if (lecteur) {
      const style = getComputedStyle(lecteur);
      const regle = document.createElement("span");
      regle.style.position = "absolute";
      regle.style.visibility = "hidden";
      regle.style.whiteSpace = "pre";
      regle.style.font = style.font;
      regle.textContent = "0".repeat(100);
      lecteur.appendChild(regle);
      const largeurCent = regle.getBoundingClientRect().width;
      regle.remove();
      if (largeurCent > 0) {
        mesureCaracteres = Math.round(
          (lecteur.getBoundingClientRect().width / largeurCent) * 100
        );
      }
    }

    return {
      lignes: lignes.length,
      mesureCaracteres,
      defilementVolet,
      voletDebordant: volet.scrollHeight > volet.clientHeight + 1,
      texteRendu: lecteur ? (lecteur.textContent ?? "").trim().length : 0,
      repliTrace: Boolean(repli)
    };
  });

  if (!triage) {
    porte(
      "Ecran de triage de la Bibliotheque",
      "un volet .library-groups a mesurer",
      surDonneesReelles ? "volet introuvable" : "espace vierge, mesure impossible",
      false
    );
  } else {
    porte(
      "Le volet de triage liste des brouillons",
      "au moins une ligne",
      `${triage.lignes} ligne(s)`,
      triage.lignes > 0
    );
    porte(
      "Le volet de lecture rend un texte",
      "plus de 200 caracteres lus",
      `${triage.texteRendu} caracteres`,
      triage.texteRendu > 200
    );
    porte(
      "Le repli a 210 caracteres est trace",
      "un marqueur de repli present",
      triage.repliTrace ? "present" : "absent",
      triage.repliTrace
    );
    porte(
      "Mesure du texte lu",
      ">= 60 caracteres par ligne",
      `${triage.mesureCaracteres} caracteres`,
      triage.mesureCaracteres >= 60
    );
    porte(
      "Le volet de triage defile de son cote",
      "contenu debordant et scrollTop > 0",
      triage.voletDebordant
        ? `${Math.round(triage.defilementVolet)} px atteints`
        : "le volet ne deborde pas, rien a mesurer",
      triage.voletDebordant && triage.defilementVolet > 0
    );
  }

  // Stabilite de hauteur au survol, sur le selecteur issu de la refonte.
  // La porte precedente visait `.library-row`, disparu : elle a echoue au lieu
  // de se taire, ce qui est exactement ce qu on lui demande.
  // La porte etait enfermee dans `if (count > 0)` : sur un espace sans ligne
  // elle quittait le total sans laisser de trace, et « N portes tenues sur N »
  // changeait de taille avec les donnees. Elle se declare desormais non jouable.
  const ligneTriage = page.locator(".library-triage-row").first();
  const lignesSurvolables = await ligneTriage.count();
  if (lignesSurvolables > 0) {
    const avantSurvol = await ligneTriage.evaluate((n) =>
      Math.round(n.getBoundingClientRect().height)
    );
    await ligneTriage.hover();
    await page.waitForTimeout(250);
    const apresSurvol = await ligneTriage.evaluate((n) =>
      Math.round(n.getBoundingClientRect().height)
    );
    porte(
      "Hauteur de ligne stable au survol",
      "aucun deplacement",
      `${avantSurvol} px puis ${apresSurvol} px`,
      avantSurvol === apresSurvol
    );
  } else {
    porte(
      "Hauteur de ligne stable au survol",
      "une ligne .library-triage-row a survoler",
      "aucune ligne rendue, rien a survoler",
      false,
      true
    );
  }

  // ---- Porte 6 : aucune ombre portee sur les cartes.
  // La direction delimite par un trait. Une ombre residuelle signale une regle
  // heritee qui a survecu au remplacement des jetons.
  //
  // Cette porte comptait les noeuds PORTEURS d une ombre sans jamais verifier
  // qu elle en avait examine un seul. Or son jeu de noeuds est vide sur les
  // ecrans visites : `.panel` n a plus aucun porteur dans l application (la
  // regle CSS survit sans element qui la porte), et `.ds-card` n est emis que
  // par `design-system/primitives/Card.tsx`, employe uniquement par les
  // panneaux de l Atelier, ou ce script ne va pas. `ombres === 0` etait donc
  // une certitude arithmetique sur zero noeud, comptee verte. On rapporte le
  // nombre de cartes examinees, et l absence de carte se declare.
  const cartes = await page.evaluate(() => {
    const noeuds = Array.from(document.querySelectorAll(".ds-card, .panel"));
    return {
      examinees: noeuds.length,
      avecOmbre: noeuds
        .map((n) => getComputedStyle(n).boxShadow)
        .filter((v) => v && v !== "none").length
    };
  });
  porte(
    "Cartes sans ombre portee",
    "au moins une carte examinee, 0 avec box-shadow",
    cartes.examinees === 0
      ? "aucune carte rendue sur cet ecran, rien a examiner"
      : `${cartes.avecOmbre} sur ${cartes.examinees} carte(s) examinee(s)`,
    cartes.examinees > 0 && cartes.avecOmbre === 0,
    cartes.examinees === 0
  );

  // ---- Porte 7 : le theme sombre rend une surface reellement sombre.
  // Verifie que la bascule agit sur les jetons de palette et pas seulement sur
  // un sous-ensemble de regles.
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await page.waitForTimeout(300);
  const sombre = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      app: style.getPropertyValue("--surface-app").trim(),
      encre: style.getPropertyValue("--ink").trim(),
      fondBarre: getComputedStyle(document.querySelector(".sidebar")).backgroundColor
    };
  });
  porte(
    "Le theme sombre atteint la barre laterale",
    "fond sombre",
    `--surface-app ${sombre.app}, barre ${sombre.fondBarre}`,
    sombre.app === "#0d1117" && !sombre.fondBarre.includes("255, 255, 255")
  );
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });
} finally {
  await app.close();
  // La copie porte l espace de travail REEL : base SQLite, posts, strategie.
  // La laisser derriere soi depose les donnees personnelles du proprietaire
  // dans un repertoire temporaire du systeme, a chaque execution. Quarante
  // copies y avaient ete relevees.
  rmSync(maison, { recursive: true, force: true });
}

let echecs = 0;
let nonJoues = 0;
const large = Math.max(...resultats.map((r) => r.nom.length));

for (const r of resultats) {
  if (r.nonJoue) {
    nonJoues += 1;
  } else if (!r.passe) {
    echecs += 1;
  }

  const marque = r.nonJoue ? "  --" : r.passe ? "  ok" : "ECHEC";
  console.log(`${marque}  ${r.nom.padEnd(large)}  attendu ${r.attendu}  obtenu ${r.obtenu}`);
}

// Le denominateur ne bouge plus avec les donnees : une porte qui ne peut pas
// mesurer reste comptee, sur sa propre ligne, au lieu de disparaitre du total.
console.log(
  `\n${resultats.length - echecs - nonJoues} portes tenues, ${nonJoues} non jouable(s), ${echecs} en echec, sur ${resultats.length}.`
);
process.exit(echecs > 0 ? 1 : 0);

import type { StrategyBundle } from "../../../shared/types/strategy";

/**
 * Construction du contexte de strategie transmis aux skills.
 *
 * Source unique : `workshop.service.ts` et `library.service.ts` portaient chacun
 * une copie quasi identique de cette logique, et `summarizeOffers` /
 * `summarizeIcps` y etaient dupliquees mot pour mot.
 *
 * Deux corrections de fond y sont appliquees, mesurees dans les audits du
 * 2026-07-25 :
 *
 * 1. Les ICP etaient amputes. L utilisateur renseigne six champs par cible,
 *    trois seulement etaient transmis. Les trois perdus (`desiredOutcomes`,
 *    `languageCues`, `linkedinBehavior`) sont precisement les plus utiles a la
 *    redaction : `languageCues` contient le vocabulaire exact de la cible.
 *
 * 2. La description de l auteur ecrasait le sujet. Sur un prompt reel, le socle
 *    editorial (8 676 car.), le resume d expertise (7 049 car.) et la bio
 *    (1 591 car.) pesaient 63 % du prompt, contre 1,6 % pour le sujet du post.
 *    Or le socle est justement la SYNTHESE produite par l application a partir
 *    des trois autres : les envoyer tous ensemble revient a repeter la meme
 *    information sous trois formes. On envoie donc le socle quand il existe, et
 *    la matiere brute seulement a defaut.
 */

export type StrategyContext = {
  profileId: string;
  foundationSummary: string | null;
  strategyProfileName: string;
  strategyPositioning: string;
  strategyBio?: string;
  strategyExpertiseSummary?: string;
  strategyOffersSummary: string;
  strategyIcpSummary: string;
  pillarLabel: string;
  pillarDescription: string;
  voiceRules: Array<{ category: string; ruleType: string; ruleText: string }>;
};

export function summarizeOffers(strategy: StrategyBundle): string {
  return strategy.offers
    .map((offer) => `${offer.name}: ${offer.promise}. Problemes: ${offer.problems}`)
    .join(" | ");
}

/**
 * Les cibles a transmettre au modele : celle qui est demandee, ou toutes.
 *
 * Point unique de la regle. Le generateur de sujets
 * (`ideas-ipc.ts`) en portait une copie mot pour mot : corriger le
 * comportement d un seul cote aurait laisse l autre en arriere sans qu aucun
 * test ne le dise.
 *
 * `find` et non `filter` : rien n impose l unicite des segments dans
 * `icpInputSchema`, et deux cibles homonymes aux douleurs differentes seraient
 * toutes deux envoyees au modele pendant que l interface affirme « une seule,
 * jamais toutes ». Sur des homonymes, la premiere gagne.
 *
 * Le repli sur la totalite couvre deux cas par le meme chemin, volontairement :
 * aucune cible demandee (idee anterieure au champ, post importe) et cible
 * introuvable (segment renomme ou supprime depuis la creation de l idee). Dans
 * les deux cas l alternative serait de choisir a la place de l utilisateur ou
 * de refuser de generer, ce qui serait pire que l ancien comportement.
 */
export function selectIcps(
  strategy: StrategyBundle,
  targetSegment?: string | null
): StrategyBundle["icps"] {
  const cible = targetSegment
    ? strategy.icps.find((icp) => icp.segment === targetSegment)
    : undefined;

  return cible ? [cible] : strategy.icps;
}

/**
 * Resume des cibles, avec la totalite des champs renseignes. Les champs vides
 * sont omis plutot que rendus comme `undefined`, pour ne pas gonfler le prompt
 * avec du bruit.
 *
 * `targetSegment` restreint le resume a UNE cible. La doctrine editoriale
 * exige une cible unique par post ; envoyer les six au modele revient a lui
 * demander d ecrire pour tout le monde, donc pour personne. C est le champ qui
 * change le plus la qualite du texte produit.
 *
 * Deux cas retombent sur la totalite des cibles, volontairement par le meme
 * chemin : aucune cible demandee (idee anterieure au champ, idee issue d une
 * veille) et cible demandee introuvable (segment renomme ou supprime dans la
 * strategie depuis la creation de l idee). Dans les deux cas l alternative
 * serait de choisir a la place de l utilisateur ou de refuser de generer, ce
 * qui serait pire que l ancien comportement.
 */
export function summarizeIcps(
  strategy: StrategyBundle,
  targetSegment?: string | null
): string {
  return selectIcps(strategy, targetSegment)
    .map((icp) => {
      const parts = [`Cible: ${icp.segment}`, `douleurs: ${icp.pains}`];
      if (icp.objections) parts.push(`objections: ${icp.objections}`);
      if (icp.desiredOutcomes) parts.push(`resultats attendus: ${icp.desiredOutcomes}`);
      if (icp.languageCues) parts.push(`vocabulaire qui resonne: ${icp.languageCues}`);
      if (icp.linkedinBehavior) parts.push(`comportement LinkedIn: ${icp.linkedinBehavior}`);
      return parts.join(". ");
    })
    .join("\n\n");
}

/**
 * Contexte complet pour un pilier donne.
 *
 * `requireVoiceRules` reflete une divergence historique entre services :
 * l atelier refuse de generer sans regles de voix, la bibliotheque l acceptait.
 * Le parametre rend cette difference explicite au lieu de la laisser implicite
 * dans deux copies de code.
 *
 * `targetIcpSegment` porte la cible visee par le post, telle qu elle a ete
 * choisie a la creation de l idee. Elle doit accompagner le post sur TOUTE sa
 * chaine : la generation et la passe de correction lisent le meme contexte, et
 * corriger avec toutes les cibles un texte ecrit pour une seule reviendrait a
 * le reecrire pour un autre public que celui pour lequel il a ete redige.
 */
export function buildStrategyContext(
  strategy: StrategyBundle,
  pillarLabel: string,
  foundationSummary: string | null,
  options: { requireVoiceRules?: boolean; targetIcpSegment?: string | null } = {}
): StrategyContext {
  if (!strategy.profile.id) {
    throw new Error("Strategy profile is missing an id.");
  }

  if (options.requireVoiceRules && strategy.voiceRules.length === 0) {
    throw new Error("Strategy is missing voice rules.");
  }

  const context: StrategyContext = {
    profileId: strategy.profile.id,
    foundationSummary,
    strategyProfileName: strategy.profile.name,
    strategyPositioning: strategy.profile.positioning,
    strategyOffersSummary: summarizeOffers(strategy),
    strategyIcpSummary: summarizeIcps(strategy, options.targetIcpSegment),
    pillarLabel,
    pillarDescription:
      strategy.pillars.find((pillar) => pillar.label === pillarLabel)?.description ?? "",
    voiceRules: strategy.voiceRules.map((rule) => ({
      category: rule.category,
      ruleType: rule.ruleType,
      ruleText: rule.ruleText
    }))
  };

  // Sans socle editorial, on retombe sur la matiere brute pour ne pas priver le
  // modele de tout contexte d auteur. Avec socle, l envoyer en plus serait une
  // redite couteuse : le socle en est deja la synthese.
  if (!foundationSummary) {
    context.strategyBio = strategy.profile.bio;
    context.strategyExpertiseSummary = strategy.profile.expertiseSummary;
  }

  return context;
}

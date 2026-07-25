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
 * Resume d une cible, avec la totalite des champs renseignes. Les champs vides
 * sont omis plutot que rendus comme `undefined`, pour ne pas gonfler le prompt
 * avec du bruit.
 */
export function summarizeIcps(strategy: StrategyBundle): string {
  return strategy.icps
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
 */
export function buildStrategyContext(
  strategy: StrategyBundle,
  pillarLabel: string,
  foundationSummary: string | null,
  options: { requireVoiceRules?: boolean } = {}
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
    strategyIcpSummary: summarizeIcps(strategy),
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

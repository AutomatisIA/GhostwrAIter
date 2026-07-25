import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { AiProgress, Button, PageFrame, Skeleton, Tabs } from "../../design-system/primitives";
import { useAiProgress } from "../../feedback/useAiProgress";
import { fadeInUp, useMotionVariants } from "../../design-system/motion/variants";
import { useStrategyBundle } from "./hooks/useStrategyBundle";
import { HelpDisclosureProvider } from "./components/HelpDisclosureProvider";
import { HelpMasterToggle } from "./components/HelpMasterToggle";
import { HELP_FIELDS, type StrategyTab } from "./components/strategy-help";
import { isFilled } from "./components/completeness-text";
import { ProfileSection } from "./components/ProfileSection";
import { OffersSection } from "./components/OffersSection";
import { IcpsSection } from "./components/IcpsSection";
import { PillarsSection } from "./components/PillarsSection";
import { VoiceRulesSection } from "./components/VoiceRulesSection";
import { AiTellFamiliesSection } from "./components/AiTellFamiliesSection";
import { FoundationSection } from "./components/FoundationSection";
import { StrategyAside } from "./components/StrategyAside";

import "./strategy.css";

const tabs: Array<{ key: StrategyTab; label: string }> = [
  { key: "profil", label: "Profil" },
  { key: "offres", label: "Offres" },
  { key: "icps", label: "ICPs" },
  { key: "piliers", label: "Piliers" },
  { key: "voix", label: "Voix" },
  { key: "socle", label: "Socle éditorial" }
];

/** Marque d onglet chiffree. Zero ne s affiche pas : un onglet vierge est nu. */
function count(saisis: number): TabMark {
  return saisis > 0 ? { text: String(saisis) } : null;
}

/** Effet du profil sur les generations, dit sans reproche ni menace d echec. */
function profileEffectText(filled: number): string {
  if (filled === 0) {
    return "Profil vide. Le modèle n'a rien pour vous distinguer : les posts sortiront interchangeables avec ceux de n'importe qui.";
  }
  if (filled < 4) {
    return "Profil partiel. Le modèle écrit avec ce qu'il a : plus les champs sont renseignés, moins les posts sont génériques.";
  }
  return "Profil complet. Les posts citeront vos chiffres et votre positionnement au lieu de rester génériques.";
}

/**
 * Marque portee a droite du libelle d onglet.
 *
 * Les cinq premiers onglets portent un decompte, le sixieme un etat en toutes
 * lettres : « à jour » ne se compte pas. `tone` vaut `attention` pour le seul
 * cas ou l utilisateur a quelque chose a faire.
 */
type TabMark = { text: string; tone?: "attention" } | null;

export function StrategyScreen() {
  const [activeTab, setActiveTab] = useState<StrategyTab>("profil");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const {
    bundle,
    loading,
    saving,
    generating,
    foundationSummary,
    foundationOutdated,
    setFoundationSummary,
    updateProfileField,
    updateOfferField,
    updateIcpField,
    updatePillarField,
    updateVoiceRuleField,
    addOffer,
    addIcp,
    addPillar,
    addVoiceRule,
    removeOffer,
    removeIcp,
    removePillar,
    removeVoiceRule,
    saveBundle,
    generateFoundation
  } = useStrategyBundle();

  const item = useMotionVariants(fadeInUp);

  // Feedback IA continu pendant la generation du socle (feature 010, T032).
  // Operation composite mono-phase (`foundation`) : on contraint le pipeline a
  // une seule etape pour une position honnete (1 / 1). Le ressenti de
  // continuite est porte par le flag local `generating` (bascule synchrone),
  // le canal `execution:progress` ne portant la phase qu'au retour de l'appel
  // (spawnSync bloque le main, research D3). Le toast existant garde le
  // resultat terminal succes/echec : pas de double annonce ici.
  const foundationProgress = useAiProgress({
    active: generating,
    activePhase: generating ? "foundation" : null,
    pipeline: ["foundation"]
  });

  // L horodatage est pose apres que `saveBundle` a rendu la main. Le hook avale
  // l erreur et la signale par un toast sans la remonter ici : distinguer le
  // succes de l echec demanderait de modifier la logique d enregistrement, qui
  // n appartient pas a ce chantier. L heure est donc celle de la derniere
  // tentative, jamais affichee avant qu il y en ait eu une.
  async function handleSave() {
    await saveBundle();
    setSavedAt(new Date());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleSave();
  }

  const profileFilled = [
    bundle.profile.name,
    bundle.profile.positioning,
    bundle.profile.bio,
    bundle.profile.expertiseSummary
  ].filter(isFilled).length;

  // Les six onglets portaient chacun une coche verte des qu ils contenaient
  // quelque chose. Six marques identiques ne hierarchisent rien, et le vert
  // reste reserve au terminal, c est a dire au post publie. On affiche donc le
  // nombre de choses SAISIES, et l etat du socle en toutes lettres puisqu il ne
  // se compte pas.
  //
  // « Saisies » et non « presentes » : les predicats sont ceux que l indicateur
  // de completude applique dans chaque onglet. Compter les lignes existantes
  // ferait afficher « 1 » a l onglet Offres au-dessus d un « 0 offre sur 1 »,
  // et deux compteurs voisins se contrediraient.
  function tabMark(tab: StrategyTab): TabMark {
    switch (tab) {
      case "profil":
        return count(profileFilled);
      case "offres":
        return count(
          bundle.offers.filter((offer) => isFilled(offer.name) && isFilled(offer.promise)).length
        );
      case "icps":
        return count(
          bundle.icps.filter((icp) => isFilled(icp.segment) && isFilled(icp.pains)).length
        );
      case "piliers":
        return count(bundle.pillars.filter((pillar) => isFilled(pillar.label)).length);
      case "voix":
        return count(bundle.voiceRules.filter((rule) => isFilled(rule.ruleText)).length);
      case "socle":
        if (foundationOutdated) return { text: "à régénérer", tone: "attention" };
        return isFilled(foundationSummary) ? { text: "à jour" } : null;
    }
  }

  const tabItems = tabs.map((tab) => {
    const mark = tabMark(tab.key);
    return {
      value: tab.key,
      label: (
        <span className="strategy-tab-label">
          {tab.label}
          {/* `aria-hidden` : le nom accessible de l onglet doit rester son
              libelle. « Voix 12 » enonce a la lecture n apprend rien, et la
              completude est deja annoncee dans le corps de l onglet par
              l indicateur, qui porte `role="status"`. */}
          {mark ? (
            <span className="strategy-tab-mark" data-tone={mark.tone} aria-hidden="true">
              {mark.text}
            </span>
          ) : null}
        </span>
      )
    };
  });

  const foundationLabel = foundationOutdated
    ? "Régénérer le socle (recommandé)"
    : foundationSummary
      ? "Régénérer le socle"
      : "Générer le socle éditorial";

  // Un seul bouton plein sur l ecran, et c est l enregistrement. La barre
  // portait aussi « Régénérer le socle », en plein lui aussi : deux actions au
  // meme rang, dont la plus voyante n etait pas la principale. La regeneration
  // est descendue dans le panneau de droite, en bouton borde.
  const barActions = (
    <>
      {savedAt ? (
        <span className="strategy-savedat">
          Enregistré à{" "}
          {savedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : null}
      <Button variant="primary" onClick={handleSave} loading={saving}>
        Enregistrer
      </Button>
    </>
  );

  // Ce que l etat du profil produit a la generation. L indicateur de completude
  // dit ce QUI MANQUE, cette phrase dit ce que le modele EN FAIT : les deux ne
  // se recouvrent pas. Elle n est rendue que sous l onglet Profil, et le cas du
  // profil entierement vide a sa propre phrase : « profil partiel » sur un
  // espace vierge decrirait un etat que l utilisateur n a pas.
  const profileEffect = activeTab !== "profil" ? null : profileEffectText(profileFilled);

  const aside = (
    <StrategyAside
      profileEffect={profileEffect}
      foundationExists={isFilled(foundationSummary)}
      foundationOutdated={foundationOutdated}
      foundationLabel={foundationLabel}
      showFreshness={activeTab !== "socle"}
      generating={generating}
      onGenerate={generateFoundation}
    />
  );

  if (loading) {
    return (
      <PageFrame eyebrow="Stratégie éditoriale">
        <div className="strategy-skeleton">
          <Skeleton variant="text" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </PageFrame>
    );
  }

  return (
    <HelpDisclosureProvider>
      <PageFrame eyebrow="Stratégie éditoriale" actions={barActions}>
        <div className="strategy-tabbar">
          <Tabs
            items={tabItems}
            value={activeTab}
            onChange={(value) => setActiveTab(value as StrategyTab)}
            aria-label="Sections de la stratégie éditoriale"
          />
          <HelpMasterToggle fields={HELP_FIELDS[activeTab]} />
        </div>

        {/* Deux colonnes, le formulaire d abord dans l ordre du document. La
            colonne de droite occupe la place que le formulaire laissait vide a
            sa droite comme sous lui : l ecran etait juge trop long alors que sa
            moitie basse ne portait rien. */}
        <div className="strategy-layout">
          {activeTab !== "socle" ? (
            <form className="strategy-panel" onSubmit={handleSubmit}>
              <motion.div key={activeTab} variants={item} initial="hidden" animate="visible">
                {activeTab === "profil" && (
                  <ProfileSection profile={bundle.profile} onUpdate={updateProfileField} />
                )}

                {activeTab === "offres" && (
                  <OffersSection
                    offers={bundle.offers}
                    onAdd={addOffer}
                    onRemove={removeOffer}
                    onUpdate={updateOfferField}
                  />
                )}

                {activeTab === "icps" && (
                  <IcpsSection
                    icps={bundle.icps}
                    onAdd={addIcp}
                    onRemove={removeIcp}
                    onUpdate={updateIcpField}
                  />
                )}

                {activeTab === "piliers" && (
                  <PillarsSection
                    pillars={bundle.pillars}
                    onAdd={addPillar}
                    onRemove={removePillar}
                    onUpdate={updatePillarField}
                  />
                )}

                {activeTab === "voix" && (
                  <>
                    <VoiceRulesSection
                      voiceRules={bundle.voiceRules}
                      onAdd={addVoiceRule}
                      onRemove={removeVoiceRule}
                      onUpdate={updateVoiceRuleField}
                    />
                    <AiTellFamiliesSection />
                  </>
                )}
              </motion.div>

              {/* Bouton par defaut du formulaire : il rend la touche Entree
                  equivalente au bouton « Enregistrer » de la barre de page, sans
                  ajouter un second bouton visible ni un doublon dans l arbre
                  d accessibilite. */}
              <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
          ) : (
            <motion.div
              key="socle"
              className="strategy-panel"
              variants={item}
              initial="hidden"
              animate="visible"
            >
              <FoundationSection
                summary={foundationSummary}
                outdated={foundationOutdated}
                onApplyManualEdit={setFoundationSummary}
                progress={
                  generating ? (
                    <AiProgress
                      phase={foundationProgress.phase}
                      intentLabel={foundationProgress.intentLabel || "Génération en cours…"}
                      elapsedMs={foundationProgress.elapsedMs}
                      currentIndex={foundationProgress.currentIndex}
                      totalSteps={foundationProgress.totalSteps}
                      state={
                        foundationProgress.state === "idle" ? "running" : foundationProgress.state
                      }
                    />
                  ) : null
                }
              />
            </motion.div>
          )}
          {aside}
        </div>
      </PageFrame>
    </HelpDisclosureProvider>
  );
}

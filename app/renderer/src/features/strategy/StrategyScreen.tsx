import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import {
  AiProgress,
  AlertTriangleIcon,
  Button,
  CheckCircleIcon,
  PageFrame,
  Skeleton,
  Tabs
} from "../../design-system/primitives";
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

import "./strategy.css";

const tabs: Array<{ key: StrategyTab; label: string }> = [
  { key: "profil", label: "Profil" },
  { key: "offres", label: "Offres" },
  { key: "icps", label: "ICPs" },
  { key: "piliers", label: "Piliers" },
  { key: "voix", label: "Voix" },
  { key: "socle", label: "Socle éditorial" }
];

/** Etat de completude porte par la coche de l onglet. */
type TabMark = "none" | "ok" | "warn";

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

  function tabMark(tab: StrategyTab): TabMark {
    switch (tab) {
      case "profil":
        return isFilled(bundle.profile.name) &&
          isFilled(bundle.profile.positioning) &&
          isFilled(bundle.profile.bio) &&
          isFilled(bundle.profile.expertiseSummary)
          ? "ok"
          : "none";
      case "offres":
        return bundle.offers.some((offer) => isFilled(offer.name) && isFilled(offer.promise))
          ? "ok"
          : "none";
      case "icps":
        return bundle.icps.some((icp) => isFilled(icp.segment) && isFilled(icp.pains))
          ? "ok"
          : "none";
      case "piliers":
        return bundle.pillars.some((pillar) => isFilled(pillar.label)) ? "ok" : "none";
      case "voix":
        return bundle.voiceRules.some((rule) => isFilled(rule.ruleText)) ? "ok" : "none";
      case "socle":
        if (foundationOutdated) return "warn";
        return isFilled(foundationSummary) ? "ok" : "none";
    }
  }

  const tabItems = tabs.map((tab) => {
    const mark = tabMark(tab.key);
    return {
      value: tab.key,
      label: (
        <span className="strategy-tab-label">
          {tab.label}
          {mark === "ok" ? (
            <span className="strategy-tab-mark" data-state="ok">
              <CheckCircleIcon size={13} />
            </span>
          ) : null}
          {mark === "warn" ? (
            <span className="strategy-tab-mark" data-state="warn">
              <AlertTriangleIcon size={13} />
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

  const barActions = (
    <>
      {savedAt ? (
        <span className="strategy-savedat">
          Enregistré à{" "}
          {savedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : null}
      <Button variant="secondary" onClick={handleSave} loading={saving}>
        Enregistrer
      </Button>
      <Button variant="primary" onClick={generateFoundation} loading={generating}>
        {foundationLabel}
      </Button>
    </>
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
      </PageFrame>
    </HelpDisclosureProvider>
  );
}

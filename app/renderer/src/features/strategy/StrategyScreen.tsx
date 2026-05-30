import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Button, Card, Skeleton, Tabs } from "../../design-system/primitives";
import {
  fadeInUp,
  staggerContainer,
  useMotionVariants
} from "../../design-system/motion/variants";
import { InfoHint } from "../../help";
import { useStrategyBundle } from "./hooks/useStrategyBundle";
import { ProfileSection } from "./components/ProfileSection";
import { OffersSection } from "./components/OffersSection";
import { IcpsSection } from "./components/IcpsSection";
import { PillarsSection } from "./components/PillarsSection";
import { VoiceRulesSection } from "./components/VoiceRulesSection";

type StrategyTab = "profil" | "offres" | "icps" | "piliers" | "voix" | "socle";

const tabs: Array<{ key: StrategyTab; label: string }> = [
  { key: "profil", label: "Profil" },
  { key: "offres", label: "Offres" },
  { key: "icps", label: "ICPs" },
  { key: "piliers", label: "Piliers" },
  { key: "voix", label: "Voix" },
  { key: "socle", label: "Socle éditorial" }
];

export function StrategyScreen() {
  const [activeTab, setActiveTab] = useState<StrategyTab>("profil");
  const [isEditingFoundation, setIsEditingFoundation] = useState(false);
  const [editedFoundation, setEditedFoundation] = useState("");

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

  const container = useMotionVariants(staggerContainer);
  const item = useMotionVariants(fadeInUp);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveBundle();
  }

  function handleStartEditFoundation() {
    setEditedFoundation(foundationSummary);
    setIsEditingFoundation(true);
  }

  function handleSaveFoundation() {
    setFoundationSummary(editedFoundation);
    setIsEditingFoundation(false);
  }

  const tabItems = tabs.map((tab) => {
    let marker = "";
    if (tab.key === "socle") {
      if (foundationOutdated) marker = " ⚠";
      else if (foundationSummary) marker = " ✓";
    }
    return { value: tab.key, label: `${tab.label}${marker}` };
  });

  if (loading) {
    return (
      <section className="panel page-panel">
        <h1>Stratégie éditoriale</h1>
        <div className="strategy-skeleton">
          <Skeleton variant="text" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </section>
    );
  }

  return (
    <section className="panel page-panel">
      <h1>Stratégie éditoriale</h1>

      <div className="strategy-tabs-bar">
        <Tabs
          items={tabItems}
          value={activeTab}
          onChange={(value) => setActiveTab(value as StrategyTab)}
          aria-label="Sections de la stratégie éditoriale"
        />
      </div>

      {activeTab !== "socle" ? (
        <form className="strategy-form" onSubmit={handleSubmit}>
          <motion.div
            key={activeTab}
            className="strategy-sections"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            {activeTab === "profil" && (
              <motion.div variants={item}>
                <ProfileSection profile={bundle.profile} onUpdate={updateProfileField} />
              </motion.div>
            )}

            {activeTab === "offres" && (
              <motion.div variants={item}>
                <OffersSection
                  offers={bundle.offers}
                  onAdd={addOffer}
                  onRemove={removeOffer}
                  onUpdate={updateOfferField}
                />
              </motion.div>
            )}

            {activeTab === "icps" && (
              <motion.div variants={item}>
                <IcpsSection
                  icps={bundle.icps}
                  onAdd={addIcp}
                  onRemove={removeIcp}
                  onUpdate={updateIcpField}
                />
              </motion.div>
            )}

            {activeTab === "piliers" && (
              <motion.div variants={item}>
                <PillarsSection
                  pillars={bundle.pillars}
                  onAdd={addPillar}
                  onRemove={removePillar}
                  onUpdate={updatePillarField}
                />
              </motion.div>
            )}

            {activeTab === "voix" && (
              <motion.div variants={item}>
                <VoiceRulesSection
                  voiceRules={bundle.voiceRules}
                  onAdd={addVoiceRule}
                  onRemove={removeVoiceRule}
                  onUpdate={updateVoiceRuleField}
                />
              </motion.div>
            )}
          </motion.div>

          <div className="form-actions">
            <Button type="submit" variant="primary" loading={saving}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : (
        <motion.div
          className="strategy-form"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={item}>
            <Card accent elevation={2} className="strategy-socle-intro">
              <h2 className="section-title-with-hint">
                Socle éditorial
                <InfoHint term="socle-editorial" />
              </h2>
              <p>
                Le socle éditorial est un résumé structuré de votre stratégie. Il est utilisé comme
                contexte par tous les modules de génération. Générez-le automatiquement depuis votre
                profil, vos offres, vos ICPs et vos piliers, ou écrivez-le à la main.
              </p>
            </Card>
          </motion.div>

          {foundationOutdated && (
            <motion.div variants={item} className="strategy-outdated-banner" role="status">
              La stratégie a été modifiée depuis la dernière génération du socle. Regénérez-le pour
              que les prochains brouillons utilisent les données à jour.
            </motion.div>
          )}

          <motion.div variants={item} className="form-actions">
            <Button
              variant={isEditingFoundation ? "secondary" : "primary"}
              onClick={generateFoundation}
              loading={generating}
            >
              {foundationOutdated
                ? "Regénérer le socle (recommandé)"
                : foundationSummary
                  ? "Regénérer le socle"
                  : "Générer le socle éditorial"}
            </Button>
            {foundationSummary && !isEditingFoundation && (
              <Button variant="secondary" onClick={handleStartEditFoundation}>
                Modifier à la main
              </Button>
            )}
          </motion.div>

          {isEditingFoundation ? (
            <motion.div variants={item} className="strategy-socle-editor">
              <textarea
                className="draft-edit-body"
                value={editedFoundation}
                onChange={(event) => setEditedFoundation(event.target.value)}
                rows={20}
                aria-label="Socle éditorial"
              />
              <div className="form-actions">
                <Button variant="primary" onClick={handleSaveFoundation}>
                  Appliquer les modifications
                </Button>
                <Button variant="secondary" onClick={() => setIsEditingFoundation(false)}>
                  Annuler
                </Button>
              </div>
            </motion.div>
          ) : foundationSummary ? (
            <motion.div variants={item}>
              <Card elevation={1} className="strategy-socle-preview">
                {foundationSummary}
              </Card>
            </motion.div>
          ) : (
            <motion.p variants={item} className="strategy-socle-hint">
              Aucun socle éditorial généré. Remplissez d'abord les onglets Profil, Offres, ICPs et
              Piliers, puis cliquez sur « Générer le socle éditorial ».
            </motion.p>
          )}
        </motion.div>
      )}
    </section>
  );
}

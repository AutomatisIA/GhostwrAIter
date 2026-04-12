import { useState, type FormEvent } from "react";
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
    status,
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

  return (
    <section className="panel page-panel">
      <h1>Stratégie éditoriale</h1>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? "primary-button" : "secondary-button"}
            style={{ padding: "8px 16px", fontSize: "0.85rem" }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.key === "socle" && foundationSummary && !foundationOutdated ? " ✓" : ""}
            {tab.key === "socle" && foundationOutdated ? " ⚠" : ""}
          </button>
        ))}
      </div>

      {activeTab !== "socle" ? (
        <form className="strategy-form" onSubmit={handleSubmit}>
          {activeTab === "profil" && (
            <>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.88rem", margin: "0 0 12px", lineHeight: 1.5 }}>
                Le minimum pour comprendre votre métier, votre promesse et votre angle éditorial.
              </p>
              <ProfileSection profile={bundle.profile} onUpdate={updateProfileField} />
            </>
          )}

          {activeTab === "offres" && (
            <>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.88rem", margin: "0 0 12px", lineHeight: 1.5 }}>
                Chaque offre décrit un service avec sa promesse et les problèmes qu'elle résout.
              </p>
              <OffersSection
                offers={bundle.offers}
                onAdd={addOffer}
                onRemove={removeOffer}
                onUpdate={updateOfferField}
              />
            </>
          )}

          {activeTab === "icps" && (
            <>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.88rem", margin: "0 0 12px", lineHeight: 1.5 }}>
                Vos clients idéaux : leurs douleurs, leurs objections, leurs mots à eux.
              </p>
              <IcpsSection
                icps={bundle.icps}
                onAdd={addIcp}
                onRemove={removeIcp}
                onUpdate={updateIcpField}
              />
            </>
          )}

          {activeTab === "piliers" && (
            <>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.88rem", margin: "0 0 12px", lineHeight: 1.5 }}>
                Les 2 à 4 thèmes qui structurent vos publications. Chaque idée et chaque post est rattaché à un pilier.
              </p>
              <PillarsSection
                pillars={bundle.pillars}
                onAdd={addPillar}
                onRemove={removePillar}
                onUpdate={updatePillarField}
              />
            </>
          )}

          {activeTab === "voix" && (
            <>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.88rem", margin: "0 0 12px", lineHeight: 1.5 }}>
                Les règles de ton qui cadrent la génération : ce qu'il faut faire, éviter, et les formats imposés.
              </p>
              <VoiceRulesSection
                voiceRules={bundle.voiceRules}
                onAdd={addVoiceRule}
                onRemove={removeVoiceRule}
                onUpdate={updateVoiceRuleField}
              />
            </>
          )}

          <div className="form-actions">
            <button type="submit" className="primary-button">
              Enregistrer
            </button>
            <span className="form-status">{status}</span>
          </div>
        </form>
      ) : (
        <div className="strategy-form">
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.88rem", margin: "0 0 12px", lineHeight: 1.5 }}>
            Le socle éditorial est un résumé structuré de votre stratégie. Il est utilisé comme contexte par tous les skills de génération.
            Vous pouvez le générer automatiquement depuis votre profil, offres, ICPs et piliers, ou l'écrire et le modifier à la main.
          </p>

          {foundationOutdated && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--color-warning-bg)", border: "1px solid var(--color-warning-border)", color: "var(--color-warning-text)", fontSize: "0.88rem", marginBottom: 12 }}>
              La stratégie a été modifiée depuis la dernière génération du socle. Regénérez-le pour que les prochains drafts utilisent les données à jour.
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="primary-button" onClick={generateFoundation}>
              {foundationOutdated ? "Regénérer le socle (recommandé)" : foundationSummary ? "Regénérer le socle" : "Générer le socle éditorial"}
            </button>
            {foundationSummary && !isEditingFoundation && (
              <button type="button" className="secondary-button" onClick={handleStartEditFoundation}>
                Modifier à la main
              </button>
            )}
            <span className="form-status">{status}</span>
          </div>

          {isEditingFoundation ? (
            <div style={{ marginTop: 16 }}>
              <textarea
                className="draft-edit-body"
                value={editedFoundation}
                onChange={(e) => setEditedFoundation(e.target.value)}
                rows={20}
                aria-label="Socle éditorial"
                style={{ minHeight: 300 }}
              />
              <div className="form-actions" style={{ marginTop: 10 }}>
                <button type="button" className="primary-button" onClick={handleSaveFoundation}>
                  Appliquer les modifications
                </button>
                <button type="button" className="secondary-button" onClick={() => setIsEditingFoundation(false)}>
                  Annuler
                </button>
              </div>
            </div>
          ) : foundationSummary ? (
            <article className="list-card" style={{ marginTop: 16, whiteSpace: "pre-wrap", fontSize: "0.92rem", lineHeight: 1.6 }}>
              {foundationSummary}
            </article>
          ) : (
            <p style={{ color: "var(--color-text-secondary)", marginTop: 16, fontStyle: "italic" }}>
              Aucun socle éditorial généré. Remplissez d'abord les onglets Profil, Offres, ICPs et Piliers, puis cliquez sur « Générer le socle éditorial ».
            </p>
          )}
        </div>
      )}
    </section>
  );
}

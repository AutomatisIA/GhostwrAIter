import type { FormEvent } from "react";
import { useStrategyBundle } from "./hooks/useStrategyBundle";
import { ProfileSection } from "./components/ProfileSection";
import { OffersSection } from "./components/OffersSection";
import { IcpsSection } from "./components/IcpsSection";
import { PillarsSection } from "./components/PillarsSection";
import { VoiceRulesSection } from "./components/VoiceRulesSection";

const firstRunChecklist = [
  "Explique en une phrase qui tu aides et sur quel probleme tu es credible.",
  "Ajoute au moins une offre avec une promesse claire et un mode d'entree simple.",
  "Definis un ICP reel, avec ses douleurs et ses mots a lui.",
  "Pose 2 a 4 piliers pour organiser les futurs sujets.",
  "Bloque 3 ou 4 regles de voix pour eviter les drafts fades."
];

export function StrategyScreen() {
  const {
    bundle,
    status,
    foundationSummary,
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

  return (
    <section className="panel page-panel">
      <h1>Strategie editoriale</h1>

      <div className="dashboard-grid dashboard-grid-secondary">
        <article className="panel checklist-card">
          <span className="status-label">Comment bien remplir cette page</span>
          <strong>Commence simple, mais concret</strong>
          <ul className="flat-checklist">
            {firstRunChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel checklist-card">
          <span className="status-label">
            Ce que l'utilisateur doit comprendre en sortant de cette page
          </span>
          <strong>Le socle doit rendre les prochains drafts evidents</strong>
          <p>
            Si cette page est bien remplie, quelqu'un qui ne te connait pas doit
            comprendre ton metier, ton client ideal, les sujets que tu veux porter
            et le ton que tu refuses.
          </p>
          <div className="status-label">Exemple de bon positionnement</div>
          <p className="strategy-example-text">
            "J'aide les PME industrielles a cadrer et deployer l'IA sans theatre
            ni promesse miracle."
          </p>
        </article>
      </div>

      <form className="strategy-form" onSubmit={handleSubmit}>
        <ProfileSection profile={bundle.profile} onUpdate={updateProfileField} />

        <OffersSection
          offers={bundle.offers}
          onAdd={addOffer}
          onRemove={removeOffer}
          onUpdate={updateOfferField}
        />

        <IcpsSection
          icps={bundle.icps}
          onAdd={addIcp}
          onRemove={removeIcp}
          onUpdate={updateIcpField}
        />

        <PillarsSection
          pillars={bundle.pillars}
          onAdd={addPillar}
          onRemove={removePillar}
          onUpdate={updatePillarField}
        />

        <VoiceRulesSection
          voiceRules={bundle.voiceRules}
          onAdd={addVoiceRule}
          onRemove={removeVoiceRule}
          onUpdate={updateVoiceRuleField}
        />

        <div className="form-actions">
          <button type="submit" className="primary-button">
            Enregistrer la strategie
          </button>
          <button type="button" className="secondary-button" onClick={generateFoundation}>
            Generer le socle editorial
          </button>
          <span className="form-status">{status}</span>
        </div>
      </form>

      {foundationSummary ? <pre className="list-card">{foundationSummary}</pre> : null}
    </section>
  );
}

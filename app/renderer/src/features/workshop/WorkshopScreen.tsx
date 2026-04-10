import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  WorkshopSession,
  PostTypology,
  PostObjective,
  StructureOption,
  HookOption
} from "@shared/types/workshop";

const TYPOLOGIES: { value: PostTypology; label: string; description: string }[] = [
  {
    value: "expertise",
    label: "Expertise",
    description: "Partage un savoir-faire technique ou une methode."
  },
  {
    value: "contrarian",
    label: "Contrarien",
    description: "Prend le contre-pied d'une idee recue sur le marche."
  },
  {
    value: "case_study",
    label: "Cas Client",
    description: "Analyse un probleme reel et les resultats obtenus."
  },
  {
    value: "tutorial",
    label: "Tuto / Guide",
    description: "Donne des etapes actionnables pour resoudre un probleme."
  },
  {
    value: "thought_leadership",
    label: "Vision",
    description: "Partage une perspective sur le futur de l'IA et des PME."
  }
];

const OBJECTIVES: { value: PostObjective; label: string }[] = [
  { value: "awareness", label: "Visibilite" },
  { value: "authority", label: "Autorite" },
  { value: "conversion", label: "Conversion" },
  { value: "engagement", label: "Engagement" }
];

export function WorkshopScreen() {
  const [searchParams] = useSearchParams();
  const ideaId = searchParams.get("ideaId");

  const [step, setStep] = useState(1);
  const [status, setStatus] = useState(
    ideaId ? "Configure ton post." : "Selectionne une idee depuis le backlog."
  );

  // Step 1 State
  const [typology, setTypology] = useState<PostTypology>("expertise");
  const [objective, setObjective] = useState<PostObjective>("awareness");

  // Step 2 State
  const [structures, setStructures] = useState<StructureOption[]>([]);
  const [selectedStructureKey, setSelectedStructureKey] = useState("");

  // Step 3 State
  const [hooks, setHooks] = useState<HookOption[]>([]);
  const [selectedHookId, setSelectedHookId] = useState("");

  // Final Step State
  const [session, setSession] = useState<WorkshopSession | null>(null);

  useEffect(() => {
    if (!ideaId) return;

    window.linkedinPoster.workshop.getSessionByIdeaId(ideaId).then((result) => {
      if (result) {
        setSession(result);
        setStep(4);
        setStatus("Draft pret.");
      }
    });
  }, [ideaId]);

  async function nextToStep2() {
    if (!ideaId) return;
    setStatus("Selection de la structure...");
    try {
      const results = await window.linkedinPoster.workshop.getSuggestedStructures(
        ideaId,
        typology,
        objective
      );
      setStructures(results);
      setSelectedStructureKey(results[0]?.key || "");
      setStep(2);
      setStatus("Choisis une structure.");
    } catch {
      setStatus(
"Erreur lors de la selection de structure.");
    }
  }

  async function nextToStep3() {
    if (!ideaId) return;
    setStatus("Generation des hooks...");
    try {
      const results = await window.linkedinPoster.workshop.generateHooks(
        ideaId,
        typology,
        selectedStructureKey
      );
      setHooks(results);
      setSelectedHookId(results[0]?.id || "");
      setStep(3);
      setStatus("Choisis ton accroche.");
    } catch {
      setStatus(
"Erreur lors de la generation des hooks.");
    }
  }

  async function nextToStep4() {
    if (!ideaId) return;
    setStatus("Generation du draft final...");
    try {
      const result = await window.linkedinPoster.workshop.generateFinalDraft(
        ideaId,
        typology,
        objective,
        selectedStructureKey,
        selectedHookId
      );
      setSession(result);
      setStep(4);
      setStatus("Draft genere !");
    } catch {
      setStatus(
"Erreur lors de la generation du draft.");
    }
  }

  async function correct() {
    if (!session) return;
    setStatus("Passe de correction...");
    try {
      const result = await window.linkedinPoster.workshop.correctDraft(session.draft.id);
      setSession(result);
      setStatus("Draft corrige.");
    } catch {
      setStatus(
"Erreur lors de la correction.");
    }
  }

  if (!ideaId) {
    return (
      <section className="panel page-panel">
        <div className="eyebrow">Production</div>
        <h1>Atelier editorial</h1>
        <p className="empty-state">Selectionne une idee depuis le backlog pour commencer.</p>
      </section>
    );
  }

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Production</div>
      <h1>Atelier editorial</h1>

      <div className="stepper-nav">
        <div className={`step-item ${step >= 1 ? "active" : ""}`}>1. Typologie</div>
        <div className={`step-item ${step >= 2 ? "active" : ""}`}>2. Structure</div>
        <div className={`step-item ${step >= 3 ? "active" : ""}`}>3. Accroche</div>
        <div className={`step-item ${step >= 4 ? "active" : ""}`}>4. Draft</div>
      </div>

      <p className="form-status">{status}</p>

      {step === 1 && (
        <div className="workshop-step">
          <h3>Choisis l'angle et l'objectif</h3>
          <div className="grid-selection">
            {TYPOLOGIES.map((t) => (
              <article
                key={t.value}
                className={`selection-card ${typology === t.value ? "selected" : ""}`}
                onClick={() => setTypology(t.value)}
              >
                <strong>{t.label}</strong>
                <p>{t.description}</p>
              </article>
            ))}
          </div>
          <div className="input-group">
            <label>Objectif prioritaire</label>
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value as PostObjective)}
            >
              {OBJECTIVES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button className="primary-button" onClick={nextToStep2}>
              Suivant : Structure
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="workshop-step">
          <h3>Selectionne une structure narrative</h3>
          <div className="grid-selection">
            {structures.map((s) => (
              <article
                key={s.key}
                className={`selection-card ${selectedStructureKey === s.key ? "selected" : ""}`}
                onClick={() => setSelectedStructureKey(s.key)}
              >
                <strong>{s.label}</strong>
                <p>{s.rationale}</p>
              </article>
            ))}
          </div>
          <div className="form-actions">
            <button className="secondary-button" onClick={() => setStep(1)}>
              Retour
            </button>
            <button className="primary-button" onClick={nextToStep3}>
              Suivant : Accroche
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="workshop-step">
          <h3>Choisis ton accroche (Hook)</h3>
          <div className="list-selection">
            {hooks.map((h) => (
              <article
                key={h.id}
                className={`selection-card list-card ${selectedHookId === h.id ? "selected" : ""}`}
                onClick={() => setSelectedHookId(h.id)}
              >
                <div className="status-label">{h.family}</div>
                <p>{h.text}</p>
                <div className="score-badge">{Math.round(h.score * 100)}%</div>
              </article>
            ))}
          </div>
          <div className="form-actions">
            <button className="secondary-button" onClick={() => setStep(2)}>
              Retour
            </button>
            <button className="primary-button" onClick={nextToStep4}>
              Generer le draft final
            </button>
          </div>
        </div>
      )}

      {step === 4 && session && (
        <div className="workshop-layout">
          <div className="workshop-sidebar">
            <article className="list-card">
              <div className="status-label">Idee source</div>
              <strong>{session.idea.title}</strong>
              <p>{session.idea.angle}</p>
            </article>

            <article className="list-card">
              <div className="status-label">Configuration</div>
              <p>Typologie : {typology}</p>
              <p>Objectif : {objective}</p>
              <p>Structure : {selectedStructureKey}</p>
            </article>

            <button className="secondary-button full-width" onClick={correct}>
              Lancer la correction premium
            </button>
          </div>

          <article className="list-card workshop-draft main-content">
            <div className="status-label">Post Final</div>
            <strong>{session.draft.headline}</strong>
            <div className="draft-body">
              {session.draft.bodyMarkdown.split("\n").map((line, i) => (
                <p key={i}>{line || "\u00A0"}</p>
              ))}
            </div>
            <div className="quality-row">
              <span>Qualite estimée</span>
              <strong>{Math.round(session.draft.qualityScore * 100)}%</strong>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

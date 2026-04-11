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

const STEP_LABELS = [
  "1. Choisir le cadrage",
  "2. Choisir la structure",
  "3. Choisir l'accroche",
  "4. Finaliser le draft"
] as const;

function formatObjectiveLabel(objective: PostObjective) {
  return OBJECTIVES.find((item) => item.value === objective)?.label ?? objective;
}

function formatTypologyDescription(typology: PostTypology) {
  return TYPOLOGIES.find((item) => item.value === typology)?.description ?? "";
}

function getQualityFeedback(score: number) {
  if (score < 0.7) {
    return {
      title: "Draft encore fragile",
      message:
        "Le texte a une base exploitable, mais il reste trop generique ou trop peu specifique pour etre publie tel quel."
    };
  }

  if (score < 0.85) {
    return {
      title: "Base correcte a renforcer",
      message:
        "Le draft tient debout, mais il merite encore un passage de concret, d'exemples ou de tension avant publication."
    };
  }

  return {
    title: "Draft solide",
    message: "Le texte est relativement propre, mais garde une relecture humaine avant publication."
  };
}

function toStoredHookOptions(session: WorkshopSession): HookOption[] {
  return session.hooks.map((hook, index) => ({
    id: hook.id,
    family: index === 0 ? "hook retenu" : "alternative deja generee",
    text: hook.text,
    score: Math.max(0.55, 0.9 - index * 0.08)
  }));
}

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

  const selectedStructure = structures.find((structure) => structure.key === selectedStructureKey);
  const selectedHook = hooks.find((hook) => hook.id === selectedHookId);
  const qualityFeedback = session ? getQualityFeedback(session.draft.qualityScore) : null;

  useEffect(() => {
    if (!ideaId) return;

    window.linkedinPoster.workshop.getSessionByIdeaId(ideaId).then((result) => {
      if (result) {
        const restoredTypology = result.draft.typology ?? "expertise";
        const restoredObjective = result.draft.objective ?? "awareness";
        const restoredStructureKey = result.draft.structureKey ?? "";
        const restoredStructureLabel = result.draft.structureLabel ?? restoredStructureKey;
        const restoredHooks = toStoredHookOptions(result);
        const restoredHookId =
          restoredHooks.find((hook) => hook.text === result.draft.selectedHookText)?.id ??
          restoredHooks[0]?.id ??
          "";

        setTypology(restoredTypology);
        setObjective(restoredObjective);
        setStructures(
          restoredStructureKey
            ? [
                {
                  key: restoredStructureKey,
                  label: restoredStructureLabel,
                  rationale: "Structure deja utilisee dans le draft courant."
                }
              ]
            : []
        );
        setSelectedStructureKey(restoredStructureKey);
        setHooks(restoredHooks);
        setSelectedHookId(restoredHookId);
        setSession(result);
        setStep(4);
        setStatus("Draft pret.");
      }
    });
  }, [ideaId]);

  async function reopenStructureSelection() {
    if (!ideaId) return;

    setStatus("Rechargement des structures...");

    try {
      const results = await window.linkedinPoster.workshop.getSuggestedStructures(
        ideaId,
        typology,
        objective
      );
      setStructures(results);
      setSelectedStructureKey((current) =>
        current && results.some((structure) => structure.key === current)
          ? current
          : (results[0]?.key ?? "")
      );
      setStep(2);
      setStatus("Choisis une structure.");
    } catch {
      setStatus("Erreur lors du rechargement des structures.");
    }
  }

  async function reopenHookSelection() {
    if (!ideaId) return;

    let structureKey = selectedStructureKey;

    if (!structureKey) {
      setStatus("Chargement de la structure actuelle...");
      try {
        const structureResults = await window.linkedinPoster.workshop.getSuggestedStructures(
          ideaId,
          typology,
          objective
        );
        setStructures(structureResults);
        structureKey = structureResults[0]?.key ?? "";
        setSelectedStructureKey(structureKey);
      } catch {
        setStatus("Erreur lors du chargement de la structure.");
        return;
      }
    }

    if (!structureKey) {
      setStatus("Aucune structure disponible pour generer des hooks.");
      return;
    }

    setStatus("Rechargement des hooks...");

    try {
      const hookResults = await window.linkedinPoster.workshop.generateHooks(
        ideaId,
        typology,
        structureKey
      );
      setHooks(hookResults);
      setSelectedHookId((current) =>
        current && hookResults.some((hook) => hook.id === current)
          ? current
          : (hookResults[0]?.id ?? "")
      );
      setStep(3);
      setStatus("Choisis ton accroche.");
    } catch {
      setStatus("Erreur lors du rechargement des hooks.");
    }
  }

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
        selectedStructure?.label ?? "",
        selectedHookId,
        selectedHook?.text ?? "",
        hooks
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
      <p>
        L'atelier transforme une idee en post en passant par une structure,
        une accroche puis un draft. Le but est de garder une generation visible
        et pilotable, et pas un simple bloc de texte opaque.
      </p>

      <div className="workshop-frame">
        <aside className="workshop-guide">
          <article className="editor-card">
            <span className="status-label">Parcours de production</span>
            <strong>{STEP_LABELS[step - 1]}</strong>
            <p>
              L'atelier te montre a chaque etape ce qui a deja ete choisi et ce qu'il
              reste a decider avant le draft final.
            </p>
            <div className="stepper-nav">
              {STEP_LABELS.map((label, index) => (
                <div
                  key={label}
                  className={`step-item ${step >= index + 1 ? "active" : ""}`}
                >
                  {label}
                </div>
              ))}
            </div>
          </article>

          <article className="editor-card">
            <span className="status-label">Resume courant</span>
            <div className="workshop-summary">
              <div>
                <span className="status-label">Typologie retenue</span>
                <strong>{TYPOLOGIES.find((item) => item.value === typology)?.label}</strong>
                <p>{formatTypologyDescription(typology)}</p>
              </div>
              <div>
                <span className="status-label">Objectif retenu</span>
                <strong>{formatObjectiveLabel(objective)}</strong>
              </div>
              <div>
                <span className="status-label">Structure</span>
                <strong>{selectedStructure?.label ?? "Pas encore choisie"}</strong>
              </div>
              <div>
                <span className="status-label">Accroche</span>
                <strong>{selectedHook?.text ?? "Pas encore choisie"}</strong>
              </div>
            </div>
          </article>

          <article className="editor-card">
            <span className="status-label">Etat actuel</span>
            <p className="form-status">{status}</p>
          </article>
        </aside>

        <div className="workshop-stage">
          {step === 1 && (
            <div className="workshop-step">
              <h3>Choisis l'angle et l'objectif</h3>
              <p className="step-description">
                Commence par definir le type de post et son objectif prioritaire.
                Cela sert a orienter la structure et le niveau de tension du draft.
              </p>
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
              <p className="step-description">
                La structure determine l'ordre du raisonnement. Choisis celle qui
                sert le mieux l'idee et l'objectif retenu.
              </p>
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
              <p className="step-description">
                L'accroche sert a faire entrer le lecteur dans le sujet. Le score
                donne un signal de potentiel, pas une verite absolue.
              </p>
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
                  <div className="status-label">Pret a publier ou retravailler</div>
                  <strong>{session.draft.headline}</strong>
                  <p>
                    Le draft est genere. Tu peux maintenant le corriger, le relire
                    ou l'envoyer dans la bibliotheque puis au calendrier.
                  </p>
                </article>

                {qualityFeedback ? (
                  <article className="list-card">
                    <div className="status-label">Lecture critique</div>
                    <strong>{qualityFeedback.title}</strong>
                    <p>{qualityFeedback.message}</p>
                  </article>
                ) : null}

                <article className="list-card">
                  <div className="status-label">Contexte utilise</div>
                  <p>Pilier : {session.contextUsed.pillarLabel}</p>
                  <p>Voix : {session.contextUsed.voiceGuardrail}</p>
                  <p>Skills : {session.contextUsed.activeSkills.join(", ")}</p>
                </article>

                <article className="list-card">
                  <div className="status-label">Configuration</div>
                  <p>Typologie : {TYPOLOGIES.find((item) => item.value === typology)?.label}</p>
                  <p>Objectif : {formatObjectiveLabel(objective)}</p>
                  <p>Structure : {selectedStructure?.label ?? selectedStructureKey}</p>
                  <p>Accroche : {selectedHook?.text ?? session.draft.selectedHookText ?? "Non definie"}</p>
                </article>

                <div className="workshop-summary">
                  <button className="secondary-button full-width" onClick={() => setStep(1)}>
                    Revoir le cadrage
                  </button>
                  <button className="secondary-button full-width" onClick={reopenStructureSelection}>
                    Changer la structure
                  </button>
                  <button className="secondary-button full-width" onClick={reopenHookSelection}>
                    Changer l'accroche
                  </button>
                </div>

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
        </div>
      </div>
    </section>
  );
}

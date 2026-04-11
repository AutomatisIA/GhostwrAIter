import { useEffect, useState, type FormEvent } from "react";
import type { StrategyBundleInput } from "@shared/schemas/strategy";

const emptyBundle: StrategyBundleInput = {
  profile: {
    name: "",
    positioning: "",
    bio: "",
    expertiseSummary: ""
  },
  offers: [],
  icps: [],
  pillars: [],
  voiceRules: []
};

function createEmptyOffer() {
  return {
    name: "",
    promise: "",
    problems: "",
    proofPoints: "",
    ctaModes: ""
  };
}

function createEmptyIcp() {
  return {
    segment: "",
    pains: "",
    objections: "",
    desiredOutcomes: "",
    languageCues: "",
    linkedinBehavior: ""
  };
}

function createEmptyPillar(position: number) {
  return {
    label: "",
    description: "",
    position,
    isDefault: position === 0
  };
}

function createEmptyVoiceRule() {
  return {
    category: "",
    ruleText: "",
    ruleType: "anti_style" as const
  };
}

const firstRunChecklist = [
  "Explique en une phrase qui tu aides et sur quel probleme tu es credible.",
  "Ajoute au moins une offre avec une promesse claire et un mode d'entree simple.",
  "Definis un ICP reel, avec ses douleurs et ses mots a lui.",
  "Pose 2 a 4 piliers pour organiser les futurs sujets.",
  "Bloque 3 ou 4 regles de voix pour eviter les drafts fades."
];

export function StrategyScreen() {
  const [bundle, setBundle] = useState<StrategyBundleInput>(emptyBundle);
  const [status, setStatus] = useState("Chargement du socle strategique...");
  const [foundationSummary, setFoundationSummary] = useState("");

  useEffect(() => {
    let isMounted = true;

    window.linkedinPoster.strategy
      .getActiveBundle()
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setBundle({
          profile: {
            name: result.profile.name,
            positioning: result.profile.positioning,
            bio: result.profile.bio ?? "",
            expertiseSummary: result.profile.expertiseSummary ?? ""
          },
          offers: result.offers.map((offer) => ({
            name: offer.name,
            promise: offer.promise,
            problems: offer.problems,
            proofPoints: offer.proofPoints ?? "",
            ctaModes: offer.ctaModes ?? ""
          })),
          icps: result.icps.map((icp) => ({
            segment: icp.segment,
            pains: icp.pains,
            objections: icp.objections ?? "",
            desiredOutcomes: icp.desiredOutcomes ?? "",
            languageCues: icp.languageCues ?? "",
            linkedinBehavior: icp.linkedinBehavior ?? ""
          })),
          pillars: result.pillars.map((pillar, index) => ({
            label: pillar.label,
            description: pillar.description ?? "",
            position: pillar.position ?? index,
            isDefault: pillar.isDefault ?? index === 0
          })),
          voiceRules: result.voiceRules.map((rule) => ({
            category: rule.category,
            ruleText: rule.ruleText,
            ruleType: rule.ruleType
          }))
        });
        setStatus("Socle strategique charge.");
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setStatus("Aucune strategie active. Vous pouvez en creer une.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateProfileField(
    field: keyof StrategyBundleInput["profile"],
    value: string
  ) {
    setBundle((current) => ({
      ...current,
      profile: {
        ...current.profile,
        [field]: value
      }
    }));
  }

  function updateOfferField(
    index: number,
    field: keyof StrategyBundleInput["offers"][number],
    value: string
  ) {
    setBundle((current) => ({
      ...current,
      offers: current.offers.map((offer, currentIndex) =>
        currentIndex === index ? { ...offer, [field]: value } : offer
      )
    }));
  }

  function updateIcpField(
    index: number,
    field: keyof StrategyBundleInput["icps"][number],
    value: string
  ) {
    setBundle((current) => ({
      ...current,
      icps: current.icps.map((icp, currentIndex) =>
        currentIndex === index ? { ...icp, [field]: value } : icp
      )
    }));
  }

  function updatePillarField(
    index: number,
    field: keyof StrategyBundleInput["pillars"][number],
    value: string | boolean
  ) {
    setBundle((current) => ({
      ...current,
      pillars: current.pillars.map((pillar, currentIndex) =>
        currentIndex === index ? { ...pillar, [field]: value } : pillar
      )
    }));
  }

  function updateVoiceRuleField(
    index: number,
    field: keyof StrategyBundleInput["voiceRules"][number],
    value: string
  ) {
    setBundle((current) => ({
      ...current,
      voiceRules: current.voiceRules.map((rule, currentIndex) =>
        currentIndex === index ? { ...rule, [field]: value } : rule
      )
    }));
  }

  function removeOffer(index: number) {
    setBundle((current) => ({
      ...current,
      offers: current.offers.filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function removeIcp(index: number) {
    setBundle((current) => ({
      ...current,
      icps: current.icps.filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function removePillar(index: number) {
    setBundle((current) => ({
      ...current,
      pillars: current.pillars
        .filter((_, currentIndex) => currentIndex !== index)
        .map((pillar, currentIndex) => ({
          ...pillar,
          position: currentIndex,
          isDefault: current.pillars[index]?.isDefault ? currentIndex === 0 : pillar.isDefault
        }))
    }));
  }

  function removeVoiceRule(index: number) {
    setBundle((current) => ({
      ...current,
      voiceRules: current.voiceRules.filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedBundle: StrategyBundleInput = {
      ...bundle,
      pillars: bundle.pillars.map((pillar, index) => ({
        ...pillar,
        position: index
      }))
    };

    await window.linkedinPoster.strategy.saveBundle(normalizedBundle);
    setStatus("Strategie enregistree localement.");
  }

  async function handleGenerateFoundation() {
    try {
      const result = await window.linkedinPoster.strategy.generateFoundation();
      setFoundationSummary(result.summaryMarkdown);
      setStatus("Socle editorial genere.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setFoundationSummary("");
      setStatus(`Erreur lors de la generation du socle editorial : ${message}`);
    }
  }

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Socle</div>
      <h1>Strategie editoriale</h1>
      <p>
        Cette page definit la source de verite de l'outil. Tu y poses qui tu aides,
        ce que tu vends, les sujets a pousser et les regles de ton a respecter
        avant toute generation.
      </p>

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
          <span className="status-label">Ce que l'utilisateur doit comprendre en sortant de cette page</span>
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
        <section className="editor-section">
          <div className="section-heading">
            <div>
              <h2>Profil et positionnement</h2>
              <p>Le minimum pour comprendre ton metier, ta promesse et ton angle editorial.</p>
            </div>
          </div>

          <label className="field">
            <span>Nom</span>
            <input
              aria-label="Nom"
              value={bundle.profile.name}
              onChange={(event) => updateProfileField("name", event.target.value)}
              placeholder="Ex. Philippe"
            />
          </label>

          <label className="field">
            <span>Positionnement</span>
            <input
              aria-label="Positionnement"
              value={bundle.profile.positioning}
              onChange={(event) => updateProfileField("positioning", event.target.value)}
              placeholder="Ex. Consultant IA generative pour PME industrielles"
            />
          </label>

          <label className="field">
            <span>Bio</span>
            <textarea
              aria-label="Bio"
              value={bundle.profile.bio}
              onChange={(event) => updateProfileField("bio", event.target.value)}
              rows={4}
              placeholder="Ex. J'aide les dirigeants a passer d'experimentations floues a des cas d'usage rentables."
            />
          </label>

          <label className="field">
            <span>Resume d'expertise</span>
            <textarea
              aria-label="Resume d'expertise"
              value={bundle.profile.expertiseSummary}
              onChange={(event) => updateProfileField("expertiseSummary", event.target.value)}
              rows={3}
              placeholder="Ex. Audit IA, cadrage des cas d'usage, copilotes metier, adoption terrain."
            />
          </label>
        </section>

        <section className="editor-section">
          <div className="section-heading">
            <div>
              <h2>Offres</h2>
              <p>Chaque offre sert a relier les posts a un probleme concret et a un CTA credible.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setBundle((current) => ({
                  ...current,
                  offers: [...current.offers, createEmptyOffer()]
                }))
              }
            >
              Ajouter une offre
            </button>
          </div>

          {bundle.offers.length === 0 ? (
            <p className="empty-state">Aucune offre. Ajoute au moins une offre si tu veux orienter tes contenus vers le business.</p>
          ) : null}

          {bundle.offers.map((offer, index) => (
            <article key={`offer-${index}`} className="editor-card">
              <div className="section-heading compact">
                <strong>Offre {index + 1}</strong>
                <button
                  type="button"
                  className="secondary-button danger-button"
                  onClick={() => removeOffer(index)}
                >
                  Retirer
                </button>
              </div>

              <label className="field">
                <span>Nom de l'offre {index + 1}</span>
                <input
                  aria-label={`Nom de l'offre ${index + 1}`}
                  value={offer.name}
                  onChange={(event) => updateOfferField(index, "name", event.target.value)}
                  placeholder="Ex. Audit IA PME"
                />
              </label>

              <label className="field">
                <span>Promesse de l'offre {index + 1}</span>
                <textarea
                  aria-label={`Promesse de l'offre ${index + 1}`}
                  rows={2}
                  value={offer.promise}
                  onChange={(event) => updateOfferField(index, "promise", event.target.value)}
                  placeholder="Ex. Prioriser les cas d'usage utiles en 10 jours."
                />
              </label>

              <label className="field">
                <span>Problemes traites par l'offre {index + 1}</span>
                <textarea
                  aria-label={`Problemes traites par l'offre ${index + 1}`}
                  rows={2}
                  value={offer.problems}
                  onChange={(event) => updateOfferField(index, "problems", event.target.value)}
                  placeholder="Ex. Trop d'idees IA, aucune priorisation, pas de sponsor clair."
                />
              </label>

              <label className="field">
                <span>Preuves ou resultats</span>
                <textarea
                  value={offer.proofPoints ?? ""}
                  onChange={(event) => updateOfferField(index, "proofPoints", event.target.value)}
                  rows={2}
                  placeholder="Ex. 3 missions menees, 2 pilotes lances, 1 roadmap validee."
                />
              </label>

              <label className="field">
                <span>CTA ou mode d'entree</span>
                <input
                  value={offer.ctaModes ?? ""}
                  onChange={(event) => updateOfferField(index, "ctaModes", event.target.value)}
                  placeholder="Ex. Appel diagnostic de 30 minutes."
                />
              </label>
            </article>
          ))}
        </section>

        <section className="editor-section">
          <div className="section-heading">
            <div>
              <h2>ICP</h2>
              <p>Les personas permettent d'ecrire pour des problemes et un langage reel, pas pour “tout le monde”.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setBundle((current) => ({
                  ...current,
                  icps: [...current.icps, createEmptyIcp()]
                }))
              }
            >
              Ajouter un ICP
            </button>
          </div>

          {bundle.icps.map((icp, index) => (
            <article key={`icp-${index}`} className="editor-card">
              <div className="section-heading compact">
                <strong>ICP {index + 1}</strong>
                <button
                  type="button"
                  className="secondary-button danger-button"
                  onClick={() => removeIcp(index)}
                >
                  Retirer
                </button>
              </div>

              <label className="field">
                <span>Segment {index + 1}</span>
                <input
                  aria-label={`Segment ${index + 1}`}
                  value={icp.segment}
                  onChange={(event) => updateIcpField(index, "segment", event.target.value)}
                  placeholder="Ex. Dirigeant de PME de 20 a 200 personnes"
                />
              </label>

              <label className="field">
                <span>Douleurs principales {index + 1}</span>
                <textarea
                  aria-label={`Douleurs principales ${index + 1}`}
                  rows={2}
                  value={icp.pains}
                  onChange={(event) => updateIcpField(index, "pains", event.target.value)}
                  placeholder="Ex. Trop de bruit, peu de ROI, equipe pas alignee."
                />
              </label>

              <label className="field">
                <span>Objections</span>
                <textarea
                  rows={2}
                  value={icp.objections ?? ""}
                  onChange={(event) => updateIcpField(index, "objections", event.target.value)}
                  placeholder="Ex. J'ai peur d'un gadget de plus ou d'un projet sans adoption."
                />
              </label>

              <label className="field">
                <span>Resultats attendus</span>
                <textarea
                  rows={2}
                  value={icp.desiredOutcomes ?? ""}
                  onChange={(event) =>
                    updateIcpField(index, "desiredOutcomes", event.target.value)
                  }
                  placeholder="Ex. Un premier cas d'usage rentable et defendable en interne."
                />
              </label>

              <label className="field">
                <span>Indices de langage</span>
                <textarea
                  rows={2}
                  value={icp.languageCues ?? ""}
                  onChange={(event) => updateIcpField(index, "languageCues", event.target.value)}
                  placeholder="Ex. Concret, rentable, equipe, process, risque."
                />
              </label>

              <label className="field">
                <span>Comportement LinkedIn</span>
                <textarea
                  rows={2}
                  value={icp.linkedinBehavior ?? ""}
                  onChange={(event) =>
                    updateIcpField(index, "linkedinBehavior", event.target.value)
                  }
                  placeholder="Ex. Lit des retours terrain, commente peu, partage les cas reels."
                />
              </label>
            </article>
          ))}
        </section>

        <section className="editor-section">
          <div className="section-heading">
            <div>
              <h2>Piliers editoriaux</h2>
              <p>Les piliers servent a organiser le backlog, la bibliotheque et le calendrier.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setBundle((current) => ({
                  ...current,
                  pillars: [...current.pillars, createEmptyPillar(current.pillars.length)]
                }))
              }
            >
              Ajouter un pilier
            </button>
          </div>

          {bundle.pillars.map((pillar, index) => (
            <article key={`pillar-${index}`} className="editor-card">
              <div className="section-heading compact">
                <strong>Pilier {index + 1}</strong>
                <button
                  type="button"
                  className="secondary-button danger-button"
                  onClick={() => removePillar(index)}
                >
                  Retirer
                </button>
              </div>

              <label className="field">
                <span>Label du pilier {index + 1}</span>
                <input
                  aria-label={`Label du pilier ${index + 1}`}
                  value={pillar.label}
                  onChange={(event) => updatePillarField(index, "label", event.target.value)}
                  placeholder="Ex. Adoption IA"
                />
              </label>

              <label className="field">
                <span>Description du pilier</span>
                <textarea
                  rows={2}
                  value={pillar.description ?? ""}
                  onChange={(event) =>
                    updatePillarField(index, "description", event.target.value)
                  }
                  placeholder="Ex. Comment cadrer, embarquer l'equipe et deployer sans friction."
                />
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={pillar.isDefault}
                  onChange={(event) => updatePillarField(index, "isDefault", event.target.checked)}
                />
                <span>Pilier par defaut</span>
              </label>
            </article>
          ))}
        </section>

        <section className="editor-section">
          <div className="section-heading">
            <div>
              <h2>Regles de voix</h2>
              <p>Ces regles evitent les rendus fades, trop corporate ou deconnectes du terrain.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setBundle((current) => ({
                  ...current,
                  voiceRules: [...current.voiceRules, createEmptyVoiceRule()]
                }))
              }
            >
              Ajouter une regle de voix
            </button>
          </div>

          {bundle.voiceRules.map((rule, index) => (
            <article key={`voice-rule-${index}`} className="editor-card">
              <div className="section-heading compact">
                <strong>Regle {index + 1}</strong>
                <button
                  type="button"
                  className="secondary-button danger-button"
                  onClick={() => removeVoiceRule(index)}
                >
                  Retirer
                </button>
              </div>

              <label className="field">
                <span>Categorie</span>
                <input
                  value={rule.category}
                  onChange={(event) =>
                    updateVoiceRuleField(index, "category", event.target.value)
                  }
                  placeholder="Ex. Anti-style"
                />
              </label>

              <label className="field">
                <span>Type de regle</span>
                <select
                  value={rule.ruleType}
                  onChange={(event) =>
                    updateVoiceRuleField(index, "ruleType", event.target.value)
                  }
                >
                  <option value="do">A faire</option>
                  <option value="dont">A eviter</option>
                  <option value="anti_style">Anti-style</option>
                  <option value="format_rule">Regle de format</option>
                </select>
              </label>

              <label className="field">
                <span>Texte de la regle {index + 1}</span>
                <textarea
                  aria-label={`Texte de la regle ${index + 1}`}
                  rows={2}
                  value={rule.ruleText}
                  onChange={(event) =>
                    updateVoiceRuleField(index, "ruleText", event.target.value)
                  }
                  placeholder="Ex. Pas de jargon, pas de promesse miracle"
                />
              </label>
            </article>
          ))}
        </section>

        <div className="form-actions">
          <button type="submit" className="primary-button">
            Enregistrer la strategie
          </button>
          <button type="button" className="secondary-button" onClick={handleGenerateFoundation}>
            Generer le socle editorial
          </button>
          <span className="form-status">{status}</span>
        </div>
      </form>

      {foundationSummary ? <pre className="list-card">{foundationSummary}</pre> : null}
    </section>
  );
}

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
          offers: result.offers,
          icps: result.icps,
          pillars: result.pillars,
          voiceRules: result.voiceRules
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await window.linkedinPoster.strategy.saveBundle(bundle);
    setStatus("Strategie enregistree localement.");
  }

  async function handleGenerateFoundation() {
    const result = await window.linkedinPoster.strategy.generateFoundation();
    setFoundationSummary(result.summaryMarkdown);
    setStatus("Socle editorial genere.");
  }

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Socle</div>
      <h1>Strategie editoriale</h1>
      <p>
        Definis ici le profil actif, le positionnement et les bases qui
        alimenteront toutes les futures generations.
      </p>

      <form className="strategy-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Nom</span>
          <input
            value={bundle.profile.name}
            onChange={(event) => updateProfileField("name", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Positionnement</span>
          <input
            aria-label="Positionnement"
            value={bundle.profile.positioning}
            onChange={(event) =>
              updateProfileField("positioning", event.target.value)
            }
          />
        </label>

        <label className="field">
          <span>Bio</span>
          <textarea
            value={bundle.profile.bio}
            onChange={(event) => updateProfileField("bio", event.target.value)}
            rows={4}
          />
        </label>

        <label className="field">
          <span>Resume d'expertise</span>
          <textarea
            value={bundle.profile.expertiseSummary}
            onChange={(event) =>
              updateProfileField("expertiseSummary", event.target.value)
            }
            rows={3}
          />
        </label>

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

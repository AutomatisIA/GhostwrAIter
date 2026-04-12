import { useEffect, useState, type FormEvent } from "react";
import type { IdeaInput, IdeaRecord, NewsSourceInput } from "@shared/types/ideas";

const emptyIdea: IdeaInput = {
  title: "",
  angle: "",
  pillarLabel: ""
};

const emptyNewsSource: NewsSourceInput = {
  sourceTitle: "",
  sourceSummary: ""
};

type IdeaSelectorProps = {
  onSelect: (ideaId: string) => void;
};

export function IdeaSelector({ onSelect }: IdeaSelectorProps) {
  const [ideas, setIdeas] = useState<IdeaRecord[]>([]);
  const [form, setForm] = useState<IdeaInput>(emptyIdea);
  const [newsSource, setNewsSource] = useState<NewsSourceInput>(emptyNewsSource);
  const [status, setStatus] = useState("Chargement des idees...");
  const [loading, setLoading] = useState(true);
  const [isCreatingIdea, setIsCreatingIdea] = useState(false);
  const [isCreatingFromNews, setIsCreatingFromNews] = useState(false);
  const [isGeneratingFromStrategy, setIsGeneratingFromStrategy] = useState(false);
  const [query, setQuery] = useState("");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [strategyPillars, setStrategyPillars] = useState<string[]>([]);

  async function loadIdeas() {
    const result = await window.linkedinPoster.ideas.listIdeas();
    setIdeas(result);
    setStatus(result.length > 0 ? "Backlog charge." : "Aucune idee pour le moment.");
  }

  useEffect(() => {
    Promise.all([
      window.linkedinPoster.ideas.listIdeas(),
      window.linkedinPoster.strategy.getActiveBundle().catch(() => null)
    ]).then(([loadedIdeas, bundle]) => {
      setIdeas(loadedIdeas);
      setStatus(loadedIdeas.length > 0 ? "Backlog charge." : "Aucune idee pour le moment.");
      if (bundle) {
        const labels = bundle.pillars.map((p) => p.label).filter(Boolean);
        setStrategyPillars(labels);
        if (labels.length > 0) {
          setForm((current) =>
            current.pillarLabel ? current : { ...current, pillarLabel: labels[0] ?? "" }
          );
        }
      }
    }).catch(() => {
      setStatus("Impossible de charger les idees.");
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingIdea(true);
    setStatus("Creation de l'idee en cours...");
    try {
      const created = await window.linkedinPoster.ideas.createIdea(form);
      setForm(emptyIdea);
      await loadIdeas();
      setStatus("Idee ajoutee au backlog.");
      onSelect(created.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setStatus(`Erreur lors de la creation de l'idee : ${message}`);
    } finally {
      setIsCreatingIdea(false);
    }
  }

  async function handleNewsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingFromNews(true);
    setStatus("Transformation de la veille en cours...");
    try {
      const result = await window.linkedinPoster.ideas.createFromNewsSource(newsSource);
      setNewsSource(emptyNewsSource);
      await loadIdeas();
      setStatus("Draft veille cree depuis la source collee.");
      onSelect(result.idea.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setStatus(`Erreur lors de la transformation de la veille : ${message}`);
    } finally {
      setIsCreatingFromNews(false);
    }
  }

  const visibleIdeas = ideas.filter((idea) => {
    const matchesQuery =
      query.trim().length === 0 ||
      `${idea.title} ${idea.angle} ${idea.pillarLabel}`
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesPillar = pillarFilter === "all" || idea.pillarLabel === pillarFilter;
    return matchesQuery && matchesPillar;
  });

  const pillarOptions = Array.from(new Set(ideas.map((idea) => idea.pillarLabel))).sort();

  return (
    <>
      <div className="ideas-modes">
        <article className="ideas-mode-card">
          <div className="ideas-mode-icon" aria-hidden="true">Idée</div>
          <h2>Saisir une idée</h2>
          <p className="ideas-mode-description">
            Quand tu as déjà un sujet en tête. Remplis le titre, l'angle et
            le pilier éditorial pour l'envoyer dans le backlog.
          </p>
          <form className="strategy-form" onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label className="field">
              <span>Titre du sujet</span>
              <input
                aria-label="Titre du sujet"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Angle</span>
              <textarea
                aria-label="Angle"
                rows={3}
                value={form.angle}
                onChange={(event) =>
                  setForm((current) => ({ ...current, angle: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Pilier éditorial</span>
              {strategyPillars.length > 0 ? (
                <select
                  aria-label="Pilier éditorial"
                  value={form.pillarLabel}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, pillarLabel: event.target.value }))
                  }
                >
                  {strategyPillars.map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label="Pilier éditorial"
                  value={form.pillarLabel}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, pillarLabel: event.target.value }))
                  }
                  placeholder="Aucun pilier défini — remplis la stratégie d'abord"
                />
              )}
            </label>
            <div className="form-actions" style={{ marginTop: "auto", paddingTop: 12 }}>
              <button type="submit" className="primary-button" disabled={isCreatingIdea}>
                Ajouter l'idée
              </button>
            </div>
          </form>
        </article>

        <article className="ideas-mode-card">
          <div className="ideas-mode-icon" aria-hidden="true">Veille</div>
          <h2>Transformer une veille</h2>
          <p className="ideas-mode-description">
            Quand tu veux réagir à un article externe. Colle le titre et le
            résumé de la source pour obtenir un draft initial.
          </p>
          <form className="strategy-form" onSubmit={handleNewsSubmit} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label className="field">
              <span>Titre source</span>
              <input
                aria-label="Titre source"
                value={newsSource.sourceTitle}
                onChange={(event) =>
                  setNewsSource((current) => ({ ...current, sourceTitle: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Résumé source</span>
              <textarea
                aria-label="Résumé source"
                rows={3}
                value={newsSource.sourceSummary}
                onChange={(event) =>
                  setNewsSource((current) => ({ ...current, sourceSummary: event.target.value }))
                }
              />
            </label>
            <div className="form-actions" style={{ marginTop: "auto", paddingTop: 12 }}>
              <button type="submit" className="primary-button" disabled={isCreatingFromNews}>
                Transformer en draft
              </button>
            </div>
          </form>
        </article>

        <article className="ideas-mode-card">
          <div className="ideas-mode-icon" aria-hidden="true">Stratégie</div>
          <h2>Générer depuis la stratégie</h2>
          <p className="ideas-mode-description">
            Quand tu veux que l'app propose des sujets à partir des piliers
            éditoriaux, des ICPs et des offres de ta stratégie active.
          </p>
          <div className="form-actions" style={{ marginTop: "auto", paddingTop: 12 }}>
            <button
              type="button"
              className="primary-button"
              disabled={isGeneratingFromStrategy}
              onClick={async () => {
                setIsGeneratingFromStrategy(true);
                setStatus("Génération des sujets en cours...");
                try {
                  await window.linkedinPoster.ideas.generateFromStrategy();
                  await loadIdeas();
                  setStatus("Sujets générés depuis la stratégie.");
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Erreur inconnue";
                  setStatus(`Erreur lors de la génération des sujets : ${message}`);
                } finally {
                  setIsGeneratingFromStrategy(false);
                }
              }}
            >
              Générer des sujets
            </button>
          </div>
        </article>
      </div>

      {status && !loading ? <p className="form-status">{status}</p> : null}

      {ideas.length > 0 ? (
        <div className="filter-bar">
          <label className="field compact-field">
            <span>Filtrer les idees</span>
            <input
              aria-label="Filtrer les idees"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sujet, angle, pilier..."
            />
          </label>
          <label className="field compact-field">
            <span>Filtrer par pilier</span>
            <select
              aria-label="Filtrer par pilier"
              value={pillarFilter}
              onChange={(event) => setPillarFilter(event.target.value)}
            >
              <option value="all">Tous les piliers</option>
              {pillarOptions.map((pillar) => (
                <option key={pillar} value={pillar}>
                  {pillar}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {loading ? (
        <div className="list-grid" aria-label="Chargement des idees">
          <article className="list-card skeleton-card" />
          <article className="list-card skeleton-card" />
        </div>
      ) : null}

      <div className="list-grid">
        {visibleIdeas.map((idea) => (
          <article key={idea.id} className="list-card">
            <div className="status-label">{idea.pillarLabel}</div>
            <strong>{idea.title}</strong>
            <p>{idea.angle}</p>
            <button
              type="button"
              className="secondary-button"
              style={{ padding: "8px 16px", fontSize: "0.85rem", marginTop: 10 }}
              onClick={() => onSelect(idea.id)}
            >
              Selectionner
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

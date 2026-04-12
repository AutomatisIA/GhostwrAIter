import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
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

export function IdeasScreen() {
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

  async function loadIdeas() {
    const result = await window.linkedinPoster.ideas.listIdeas();
    setIdeas(result);
    setStatus(result.length > 0 ? "Backlog charge." : "Aucune idee pour le moment.");
  }

  useEffect(() => {
    loadIdeas().catch(() => {
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
      await window.linkedinPoster.ideas.createIdea(form);
      setForm(emptyIdea);
      await loadIdeas();
      setStatus("Idee ajoutee au backlog.");
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
      await window.linkedinPoster.ideas.createFromNewsSource(newsSource);
      setNewsSource(emptyNewsSource);
      await loadIdeas();
      setStatus("Draft veille cree depuis la source collee.");
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
    <section className="panel page-panel">
      <div className="eyebrow">Backlog</div>
      <h1>Idees editoriales</h1>
      <p>
        Cette page sert a saisir un sujet a la main, transformer une source de
        veille ou lancer une generation depuis la strategie. L'objectif est de
        ne jamais perdre un bon angle avant de l'envoyer dans l'atelier.
      </p>

      <div className="insight-strip">
        <article className="insight-card">
          <span className="status-label">Volume</span>
          <strong>{loading ? "..." : `${visibleIdeas.length} idee${visibleIdeas.length > 1 ? "s" : ""} visible${visibleIdeas.length > 1 ? "s" : ""}`}</strong>
        </article>
        <article className="insight-card">
          <span className="status-label">Piliers</span>
          <strong>{loading ? "..." : `${pillarOptions.length || 0} pilier${pillarOptions.length > 1 ? "s" : ""}`}</strong>
        </article>
      </div>

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

      <div className="ideas-modes">
        <article className="ideas-mode-card">
          <div className="ideas-mode-icon" aria-hidden="true">Idee</div>
          <h2>Saisir une idee</h2>
          <p className="ideas-mode-description">
            Quand tu as deja un sujet en tete. Remplis le titre, l'angle et
            le pilier editorial pour l'envoyer dans le backlog.
          </p>
          <form className="strategy-form" onSubmit={handleSubmit}>
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
              <span>Pilier editorial</span>
              <input
                aria-label="Pilier editorial"
                value={form.pillarLabel}
                onChange={(event) =>
                  setForm((current) => ({ ...current, pillarLabel: event.target.value }))
                }
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={isCreatingIdea}>
                Ajouter l'idee
              </button>
            </div>
          </form>
        </article>

        <article className="ideas-mode-card">
          <div className="ideas-mode-icon" aria-hidden="true">Veille</div>
          <h2>Transformer une veille</h2>
          <p className="ideas-mode-description">
            Quand tu veux reagir a un article externe. Colle le titre et le
            resume de la source pour obtenir un draft initial.
          </p>
          <form className="strategy-form" onSubmit={handleNewsSubmit}>
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
              <span>Resume source</span>
              <textarea
                aria-label="Resume source"
                rows={3}
                value={newsSource.sourceSummary}
                onChange={(event) =>
                  setNewsSource((current) => ({ ...current, sourceSummary: event.target.value }))
                }
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="secondary-button" disabled={isCreatingFromNews}>
                Transformer la veille en draft
              </button>
            </div>
          </form>
        </article>

        <article className="ideas-mode-card">
          <div className="ideas-mode-icon" aria-hidden="true">Strategie</div>
          <h2>Generer depuis la strategie</h2>
          <p className="ideas-mode-description">
            Quand tu veux que l'app propose des sujets a partir des piliers
            editoriaux, des ICPs et des offres de ta strategie active.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={isGeneratingFromStrategy}
              onClick={async () => {
                setIsGeneratingFromStrategy(true);
                setStatus("Generation des sujets en cours...");
                try {
                  await window.linkedinPoster.ideas.generateFromStrategy();
                  await loadIdeas();
                  setStatus("Sujets generes depuis la strategie.");
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Erreur inconnue";
                  setStatus(`Erreur lors de la generation des sujets : ${message}`);
                } finally {
                  setIsGeneratingFromStrategy(false);
                }
              }}
            >
              Generer des sujets depuis la strategie
            </button>
          </div>
        </article>
      </div>

      {status && !loading ? <p className="form-status">{status}</p> : null}

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
            <Link className="inline-link" to={`/atelier?ideaId=${idea.id}`}>
              Ouvrir dans l'atelier
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

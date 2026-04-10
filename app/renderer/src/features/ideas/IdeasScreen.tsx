import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { IdeaInput, IdeaRecord } from "@shared/types/ideas";

const emptyIdea: IdeaInput = {
  title: "",
  angle: "",
  pillarLabel: ""
};

export function IdeasScreen() {
  const [ideas, setIdeas] = useState<IdeaRecord[]>([]);
  const [form, setForm] = useState<IdeaInput>(emptyIdea);
  const [status, setStatus] = useState("Chargement des idees...");

  async function loadIdeas() {
    const result = await window.linkedinPoster.ideas.listIdeas();
    setIdeas(result);
    setStatus(result.length > 0 ? "Backlog charge." : "Aucune idee pour le moment.");
  }

  useEffect(() => {
    loadIdeas().catch(() => {
      setStatus("Impossible de charger les idees.");
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await window.linkedinPoster.ideas.createIdea(form);
    setForm(emptyIdea);
    await loadIdeas();
    setStatus("Idee ajoutee au backlog.");
  }

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Backlog</div>
      <h1>Idees editoriales</h1>
      <p>Capture les angles terrain qui serviront de point d'entree au workflow de production.</p>

      <form className="strategy-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Titre du sujet</span>
          <input
            aria-label="Titre du sujet"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>Angle</span>
          <textarea
            aria-label="Angle"
            rows={3}
            value={form.angle}
            onChange={(event) => setForm((current) => ({ ...current, angle: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>Pilier</span>
          <input
            aria-label="Pilier"
            value={form.pillarLabel}
            onChange={(event) =>
              setForm((current) => ({ ...current, pillarLabel: event.target.value }))
            }
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="primary-button">
            Ajouter l'idee
          </button>
          <span className="form-status">{status}</span>
        </div>
      </form>

      <div className="list-grid">
        {ideas.map((idea) => (
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

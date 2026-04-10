import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { WorkshopSession } from "@shared/types/workshop";

export function WorkshopScreen() {
  const [searchParams] = useSearchParams();
  const ideaId = searchParams.get("ideaId");
  const [session, setSession] = useState<WorkshopSession | null>(null);
  const [status, setStatus] = useState(
    ideaId ? "Chargement de l'atelier..." : "Selectionne une idee depuis le backlog."
  );

  useEffect(() => {
    if (!ideaId) {
      return;
    }

    window.linkedinPoster.workshop
      .getSessionByIdeaId(ideaId)
      .then((result) => {
        if (!result) {
          setStatus("Aucune session encore generee pour cette idee.");
          return;
        }

        setSession(result);
        setStatus(result.run.summary);
      })
      .catch(() => {
        setStatus("Impossible de charger la session d'atelier.");
      });
  }, [ideaId]);

  async function generate() {
    if (!ideaId) {
      return;
    }

    const result = await window.linkedinPoster.workshop.generateFromIdea(ideaId);
    setSession(result);
    setStatus(result.run.summary);
  }

  async function correct() {
    if (!session) {
      return;
    }

    const result = await window.linkedinPoster.workshop.correctDraft(session.draft.id);
    setSession(result);
    setStatus(result.run.summary);
  }

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Production</div>
      <h1>Atelier editorial</h1>
      <p>
        Transforme une idee en draft structure, puis lance une passe de correction premium.
      </p>

      <div className="form-actions">
        <button type="button" className="primary-button" onClick={generate} disabled={!ideaId}>
          Generer le draft
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={correct}
          disabled={!session}
        >
          Lancer la correction
        </button>
        <span className="form-status">{status}</span>
      </div>

      {session ? (
        <div className="workshop-layout">
          <article className="list-card">
            <div className="status-label">{session.idea.pillarLabel}</div>
            <strong>{session.idea.title}</strong>
            <p>{session.idea.angle}</p>
          </article>

          <article className="list-card">
            <div className="status-label">Contexte utilise</div>
            <strong>{session.contextUsed.strategyPositioning ?? "Contexte local"}</strong>
            <p>{session.contextUsed.voiceGuardrail}</p>
            <p>{session.contextUsed.activeSkills.join(", ")}</p>
          </article>

          <article className="list-card">
            <div className="status-label">Hooks</div>
            {session.hooks.map((hook) => (
              <p key={hook.id}>{hook.text}</p>
            ))}
          </article>

          <article className="list-card workshop-draft">
            <div className="status-label">Draft</div>
            <strong>{session.draft.headline}</strong>
            <p>{session.draft.bodyMarkdown}</p>
            <div className="quality-row">
              <span>Qualite</span>
              <strong>{Math.round(session.draft.qualityScore * 100)}%</strong>
            </div>
            <p>{session.versions.length} snapshot(s)</p>
            <div className="status-label">{session.run.summary}</div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

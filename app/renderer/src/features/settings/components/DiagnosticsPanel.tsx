import { useEffect, useState } from "react";
import type { ExecutionRunEntry } from "@shared/types/execution";

function formatSkillLabel(skillName: string) {
  const labels: Record<string, string> = {
    "linkedin-post-writer": "Rediger un post",
    "linkedin-post-editor": "Corriger un post",
    "linkedin-hook-engine": "Generer des accroches",
    "linkedin-news-to-post": "Transformer une veille en draft",
    "linkedin-structure-selector": "Choisir une structure",
    "linkedin-repurpose": "Creer des variantes",
    "linkedin-strategy-foundation": "Generer un socle editorial",
    "linkedin-topic-generator": "Generer des sujets"
  };

  return labels[skillName] ?? skillName;
}

function formatRunStatus(status: ExecutionRunEntry["status"]) {
  if (status === "succeeded") return "Succes";
  if (status === "failed") return "Echec";
  return "Partiel";
}

type DiagnosticsPanelProps = {
  defaultExpanded?: boolean;
};

export function DiagnosticsPanel({ defaultExpanded = false }: DiagnosticsPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [runs, setRuns] = useState<ExecutionRunEntry[]>([]);
  const [loading, setLoading] = useState(defaultExpanded);
  const [openLogError, setOpenLogError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    let mounted = true;
    window.linkedinPoster.execution
      .listRuns()
      .then((data) => { if (mounted) setRuns(data); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [expanded]);

  async function handleOpenLog(runId: string) {
    setOpenLogError(null);
    try {
      await window.linkedinPoster.execution.openRunLog(runId);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible d'ouvrir le log technique.";
      setOpenLogError(message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <button
        type="button"
        className="secondary-button"
        onClick={() => setExpanded((v) => !v)}
        style={{ alignSelf: "flex-start" }}
      >
        {expanded ? "Masquer l'historique" : "Afficher l'historique des runs"}
      </button>

      {expanded ? (
        <>
          {loading ? <p>Chargement...</p> : null}

          {openLogError ? (
            <article className="error-banner" role="alert">
              <div className="error-banner-body">
                <strong>{openLogError}</strong>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpenLogError(null)}
              >
                Fermer
              </button>
            </article>
          ) : null}

          {!loading && runs.length === 0 ? <p>Aucun run enregistre.</p> : null}

          <div className="list-grid">
            {runs.map((run) => (
              <article key={run.id} className="list-card" style={{ padding: "12px 16px" }}>
                <div className="status-label">{formatRunStatus(run.status)}</div>
                <strong>{formatSkillLabel(run.skillName)}</strong>
                <p>{run.summary}</p>
                {run.status === "failed" && (run.errorCode || run.errorMessage) ? (
                  <div className="error-detail">
                    <span className="status-label">Detail technique</span>
                    {run.errorCode ? <code className="error-code">{run.errorCode}</code> : null}
                    {run.errorMessage ? <p>{run.errorMessage}</p> : null}
                  </div>
                ) : null}
                {run.status === "failed" ? (
                  <div className="form-actions" style={{ marginTop: "8px" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleOpenLog(run.id)}
                      disabled={!run.hasLog}
                      title={
                        !run.hasLog
                          ? "Aucun log technique n'a ete enregistre pour ce run."
                          : undefined
                      }
                    >
                      Ouvrir le log
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

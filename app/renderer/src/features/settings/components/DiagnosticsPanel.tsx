import { useEffect, useState } from "react";
import type { ExecutionRunEntry } from "@shared/types/execution";
import { Button, useToast } from "../../../design-system/primitives";

function formatSkillLabel(skillName: string) {
  const labels: Record<string, string> = {
    "linkedin-post-writer": "Rédiger un post",
    "linkedin-post-editor": "Corriger un post",
    "linkedin-hook-engine": "Générer des accroches",
    "linkedin-news-to-post": "Transformer une veille en draft",
    "linkedin-structure-selector": "Choisir une structure",
    "linkedin-repurpose": "Créer des variantes",
    "linkedin-strategy-foundation": "Générer un socle éditorial",
    "linkedin-topic-generator": "Générer des sujets"
  };

  return labels[skillName] ?? skillName;
}

function formatRunStatus(status: ExecutionRunEntry["status"]) {
  if (status === "succeeded") return "Succès";
  if (status === "failed") return "Échec";
  return "Partiel";
}

type DiagnosticsPanelProps = {
  defaultExpanded?: boolean;
};

export function DiagnosticsPanel({ defaultExpanded = false }: DiagnosticsPanelProps) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [runs, setRuns] = useState<ExecutionRunEntry[]>([]);
  const [loading, setLoading] = useState(defaultExpanded);

  useEffect(() => {
    if (!expanded) return;
    let mounted = true;
    window.linkedinPoster.execution
      .listRuns()
      .then((data) => {
        if (mounted) setRuns(data);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [expanded]);

  async function handleOpenLog(runId: string) {
    try {
      await window.linkedinPoster.execution.openRunLog(runId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Impossible d'ouvrir le journal technique.";
      toast.show({ kind: "error", message });
    }
  }

  return (
    <div className="settings-diagnostics">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? "Masquer l'historique" : "Afficher l'historique des générations"}
      </Button>

      {expanded ? (
        <>
          {loading ? <p className="settings-diagnostics__note">Chargement…</p> : null}

          {!loading && runs.length === 0 ? (
            <p className="settings-diagnostics__note">
              Aucune génération enregistrée pour l'instant.
            </p>
          ) : null}

          {runs.length > 0 ? (
            <div className="settings-runs">
              {runs.map((run) => (
                <div className="settings-run" key={run.id}>
                  <div className="settings-run__head">
                    <span className="settings-run__title">{formatSkillLabel(run.skillName)}</span>
                    <span className={`settings-run__status settings-run__status--${run.status}`}>
                      {formatRunStatus(run.status)}
                    </span>
                  </div>

                  <p className="settings-run__summary">{run.summary}</p>

                  {run.status === "failed" && (run.errorCode || run.errorMessage) ? (
                    <div className="settings-run__error">
                      {run.errorCode ? (
                        <code className="settings-run__error-code">{run.errorCode}</code>
                      ) : null}
                      {run.errorMessage ? (
                        <p className="settings-run__error-message">{run.errorMessage}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {run.status === "failed" ? (
                    <div className="settings-run__action">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenLog(run.id)}
                        disabled={!run.hasLog}
                        title={
                          !run.hasLog
                            ? "Aucun journal technique n'a été enregistré pour cette génération."
                            : undefined
                        }
                      >
                        Ouvrir le journal
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

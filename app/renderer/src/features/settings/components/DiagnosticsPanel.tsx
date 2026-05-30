import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { ExecutionRunEntry } from "@shared/types/execution";
import { Button, Card, useToast } from "../../../design-system/primitives";
import { fadeInUp, staggerContainer, useMotionVariants } from "../../../design-system/motion/variants";

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

  const container = useMotionVariants(staggerContainer);
  const item = useMotionVariants(fadeInUp);

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
          {loading ? <p className="settings-diagnostics-loading">Chargement…</p> : null}

          {!loading && runs.length === 0 ? (
            <p className="settings-diagnostics-empty">Aucune génération enregistrée pour l'instant.</p>
          ) : null}

          <motion.div
            className="list-grid"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            {runs.map((run) => (
              <motion.div key={run.id} variants={item}>
                <Card elevation={1} className="settings-run-card">
                  <span className={`status-label settings-run-status settings-run-status--${run.status}`}>
                    {formatRunStatus(run.status)}
                  </span>
                  <strong>{formatSkillLabel(run.skillName)}</strong>
                  <p>{run.summary}</p>
                  {run.status === "failed" && (run.errorCode || run.errorMessage) ? (
                    <div className="error-detail">
                      <span className="status-label">Détail technique</span>
                      {run.errorCode ? <code className="error-code">{run.errorCode}</code> : null}
                      {run.errorMessage ? <p>{run.errorMessage}</p> : null}
                    </div>
                  ) : null}
                  {run.status === "failed" ? (
                    <div className="settings-run-action">
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
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </>
      ) : null}
    </div>
  );
}

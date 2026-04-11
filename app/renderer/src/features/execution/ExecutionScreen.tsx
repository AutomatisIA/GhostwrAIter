import { useEffect, useState } from "react";
import type {
  ExecutionDiagnostics,
  ExecutionRunEntry
} from "@shared/types/execution";

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
  if (status === "succeeded") {
    return "Succes";
  }

  if (status === "failed") {
    return "Echec";
  }

  return "Partiel";
}

export function ExecutionScreen() {
  const [diagnostics, setDiagnostics] = useState<ExecutionDiagnostics | null>(null);
  const [runs, setRuns] = useState<ExecutionRunEntry[]>([]);

  useEffect(() => {
    Promise.all([
      window.linkedinPoster.execution.getDiagnostics(),
      window.linkedinPoster.execution.listRuns()
    ]).then(([loadedDiagnostics, loadedRuns]) => {
      setDiagnostics(loadedDiagnostics);
      setRuns(loadedRuns);
    });
  }, []);

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Runner</div>
      <h1>Comprendre ce que fait le runner</h1>
      <p>
        Cette page explique comment l'application produit ses resultats. Tu peux
        verifier le mode actuel, voir les capacites detectees et relire les runs
        recents avec une interpretation plus metier que technique.
      </p>

      {diagnostics ? (
        <>
          <div className="dashboard-grid dashboard-grid-secondary">
            <article className="panel metric-card">
              <span className="status-label">Mode actuel</span>
              <strong>{diagnostics.runnerMode}</strong>
              <p>
                {diagnostics.runnerMode === "codex"
                  ? "Les generations s'executent via Codex, sans degradation silencieuse."
                  : "Aucune generation n'est autorisee tant que Codex n'est pas disponible."}
              </p>
            </article>
            <article className="panel metric-card">
              <span className="status-label">Lecture rapide</span>
              <strong>
                {diagnostics.codexAvailable
                  ? diagnostics.runnerMode === "codex"
                    ? "Codex disponible et actif."
                    : "Codex detecte, mais le runner n'est pas operationnel."
                  : "Codex indisponible."}
              </strong>
              <p>{diagnostics.message}</p>
            </article>
          </div>

          <article className="list-card">
            <span className="status-label">Capacites detectees</span>
            <div className="capability-grid">
              {diagnostics.availableSkills.map((skill) => (
                <div key={skill} className="capability-chip">
                  <strong>{formatSkillLabel(skill)}</strong>
                  <span>{skill}</span>
                </div>
              ))}
            </div>
          </article>
        </>
      ) : null}

      <div className="list-grid">
        {runs.map((run) => (
          <article key={run.id} className="list-card">
            <div className="status-label">{formatRunStatus(run.status)}</div>
            <strong>{formatSkillLabel(run.skillName)}</strong>
            <p className="run-tech-label">{run.skillName}</p>
            <p>{run.summary}</p>
            <div className="run-explainer">
              <span className="status-label">Ce que cela veut dire</span>
              <p>
                {run.status === "succeeded"
                  ? "Le runner a renvoye une sortie exploitable pour cette etape."
                  : run.status === "failed"
                    ? "Cette etape n'a pas produit de sortie exploitable."
                    : "Cette etape a produit une sortie partielle ou degradee."}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

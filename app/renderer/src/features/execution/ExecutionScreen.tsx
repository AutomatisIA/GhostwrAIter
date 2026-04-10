import { useEffect, useState } from "react";
import type {
  ExecutionDiagnostics,
  ExecutionRunEntry
} from "@shared/types/execution";

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
      <h1>Execution et diagnostic</h1>
      <p>Consulte l'etat du runner local et les dernieres executions de skills du cockpit.</p>

      {diagnostics ? (
        <article className="list-card">
          <strong>{diagnostics.message}</strong>
          <p>Mode: {diagnostics.runnerMode}</p>
          <div>
            {diagnostics.availableSkills.map((skill) => (
              <span key={skill} className="status-label">
                {skill}
              </span>
            ))}
          </div>
        </article>
      ) : null}

      <div className="list-grid">
        {runs.map((run) => (
          <article key={run.id} className="list-card">
            <strong>{run.skillName}</strong>
            <p>{run.summary}</p>
            <div className="status-label">{run.status}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

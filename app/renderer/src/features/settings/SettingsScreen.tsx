import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ThemeSelector } from "./components/ThemeSelector";
import { EnginePanel } from "./components/EnginePanel";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";

type PurgeState =
  | { stage: "idle" }
  | { stage: "confirming"; count: number }
  | { stage: "done"; deletedCount: number };

export function SettingsScreen() {
  const [searchParams] = useSearchParams();
  const [exportPath, setExportPath] = useState("");
  const [purgeState, setPurgeState] = useState<PurgeState>({ stage: "idle" });
  const [status, setStatus] = useState("");

  const autoExpandDiagnostics = searchParams.get("section") === "diagnostics";

  async function handleExport() {
    try {
      const result = await window.linkedinPoster.settings.exportWorkspace();
      setExportPath(result.exportPath);
    } catch {
      setExportPath("Erreur lors de l'export.");
    }
  }

  async function handleAskConfirm() {
    try {
      const result = await window.linkedinPoster.settings.countExecutionLogs();
      setPurgeState({ stage: "confirming", count: result.count });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setStatus(`Erreur: ${message}`);
    }
  }

  async function handleConfirmPurge() {
    try {
      const result = await window.linkedinPoster.settings.purgeExecutionLogs();
      setPurgeState({ stage: "done", deletedCount: result.deletedCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setStatus(`Erreur: ${message}`);
    }
  }

  function handleCancelPurge() {
    setPurgeState({ stage: "idle" });
  }

  return (
    <section className="panel page-panel">
      <h1>Parametres</h1>

      <div className="strategy-form" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Apparence */}
        <article className="list-card">
          <span className="status-label">Apparence</span>
          <ThemeSelector />
        </article>

        {/* Moteur d'execution */}
        <article className="list-card">
          <span className="status-label">Moteur d'execution</span>
          <EnginePanel />
        </article>

        {/* Diagnostics */}
        <article className="list-card">
          <span className="status-label">Diagnostics</span>
          <DiagnosticsPanel defaultExpanded={autoExpandDiagnostics} />
        </article>

        {/* Donnees */}
        <article className="list-card">
          <span className="status-label">Donnees</span>
          <div className="form-actions">
            <button type="button" className="primary-button" onClick={handleExport}>
              Exporter le workspace
            </button>

            {purgeState.stage === "idle" || purgeState.stage === "done" ? (
              <button type="button" className="secondary-button" onClick={handleAskConfirm}>
                Purger les logs
              </button>
            ) : null}

            {purgeState.stage === "confirming" ? (
              <>
                <button
                  type="button"
                  className="secondary-button danger-button"
                  onClick={handleConfirmPurge}
                >
                  Confirmer la suppression des {purgeState.count} logs
                </button>
                <button type="button" className="secondary-button" onClick={handleCancelPurge}>
                  Annuler
                </button>
              </>
            ) : null}
          </div>

          {status ? <p className="form-status">{status}</p> : null}
          {exportPath ? <p>{exportPath}</p> : null}
          {purgeState.stage === "done" ? (
            <p>{purgeState.deletedCount} logs supprimes localement.</p>
          ) : null}
        </article>
      </div>
    </section>
  );
}

import { useState } from "react";

type PurgeState =
  | { stage: "idle" }
  | { stage: "confirming"; count: number }
  | { stage: "done"; deletedCount: number };

export function SettingsScreen() {
  const [exportPath, setExportPath] = useState("");
  const [purgeState, setPurgeState] = useState<PurgeState>({ stage: "idle" });

  async function handleExport() {
    const result = await window.linkedinPoster.settings.exportWorkspace();
    setExportPath(result.exportPath);
  }

  async function handleAskConfirm() {
    const result = await window.linkedinPoster.settings.countExecutionLogs();
    setPurgeState({ stage: "confirming", count: result.count });
  }

  async function handleConfirmPurge() {
    const result = await window.linkedinPoster.settings.purgeExecutionLogs();
    setPurgeState({ stage: "done", deletedCount: result.deletedCount });
  }

  function handleCancelPurge() {
    setPurgeState({ stage: "idle" });
  }

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Parametres</div>
      <h1>Maintenance locale</h1>
      <p>
        Cette page regroupe les actions de maintenance. Tu peux exporter ton
        workspace pour le sauvegarder ou purger les logs si tu veux nettoyer les
        traces d'execution locales.
      </p>

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

      {exportPath ? <p>{exportPath}</p> : null}
      {purgeState.stage === "done" ? (
        <p>{purgeState.deletedCount} logs supprimes localement.</p>
      ) : null}
    </section>
  );
}

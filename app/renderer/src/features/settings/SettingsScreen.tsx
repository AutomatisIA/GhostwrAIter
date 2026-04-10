import { useState } from "react";

export function SettingsScreen() {
  const [exportPath, setExportPath] = useState("");
  const [purgeMessage, setPurgeMessage] = useState("");

  async function handleExport() {
    const result = await window.linkedinPoster.settings.exportWorkspace();
    setExportPath(result.exportPath);
  }

  async function handlePurge() {
    const result = await window.linkedinPoster.settings.purgeExecutionLogs();
    setPurgeMessage(`${result.deletedCount} logs supprimes localement.`);
  }

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Parametres</div>
      <h1>Maintenance locale</h1>
      <p>Exporte le workspace local et purger les journaux sensibles depuis un ecran dedie.</p>

      <div className="form-actions">
        <button type="button" className="primary-button" onClick={handleExport}>
          Exporter le workspace
        </button>
        <button type="button" className="secondary-button" onClick={handlePurge}>
          Purger les logs
        </button>
      </div>

      {exportPath ? <p>{exportPath}</p> : null}
      {purgeMessage ? <p>{purgeMessage}</p> : null}
    </section>
  );
}

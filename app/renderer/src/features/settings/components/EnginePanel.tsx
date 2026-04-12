import { useEffect, useState, useCallback } from "react";
import type { CliEngineStatus, CliEngineName } from "@shared/types/settings";

function statusBadge(installState: CliEngineStatus["installState"]) {
  switch (installState) {
    case "authenticated":
      return <span className="engine-badge engine-badge--ok">Connecte</span>;
    case "installed":
      return <span className="engine-badge engine-badge--warn">Installe</span>;
    case "not-installed":
      return <span className="engine-badge engine-badge--off">Non installe</span>;
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      type="button"
      className="btn-copy"
      onClick={handleCopy}
      title="Copier"
    >
      {copied ? "Copie !" : "Copier"}
    </button>
  );
}

export function EnginePanel() {
  const [engines, setEngines] = useState<CliEngineStatus[]>([]);
  const [activeEngine, setActiveEngine] = useState<CliEngineName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    Promise.all([
      window.linkedinPoster.settings.detectEngines(),
      window.linkedinPoster.settings.getActiveEngine()
    ])
      .then(([detected, active]) => {
        setEngines(detected.engines);
        setActiveEngine(active.engine);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Impossible de charger les moteurs IA.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSelect = useCallback(
    (name: CliEngineName) => {
      window.linkedinPoster.settings
        .setActiveEngine(name)
        .then((selection) => {
          setActiveEngine(selection.engine);
          refresh();
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Impossible de changer le moteur.");
        });
    },
    [refresh]
  );

  if (error) {
    return <p>{error}</p>;
  }

  if (loading) {
    return <p>Chargement...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
        LinkedIn Poster utilise un assistant IA pour generer vos contenus via votre abonnement existant.
      </p>

      <div className="ideas-modes">
        {engines.map((engine) => {
          const isActive = engine.name === activeEngine;
          const canSelect = engine.installState === "authenticated";

          return (
            <button
              key={engine.name}
              type="button"
              className={`idea-card${isActive ? " idea-card--selected" : ""}`}
              onClick={() => canSelect && handleSelect(engine.name)}
              style={{
                cursor: canSelect ? "pointer" : "default",
                opacity: engine.installState === "not-installed" ? 0.7 : 1,
                textAlign: "left"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{engine.displayName}</strong>
                {statusBadge(engine.installState)}
              </div>

              <span style={{ color: "var(--color-text-secondary)", fontSize: "0.85em", display: "block", marginTop: "4px" }}>
                {engine.subscriptionLabel}
              </span>

              {engine.installState === "not-installed" && (
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <code className="engine-command">{engine.installCommand}</code>
                    <CopyButton text={engine.installCommand} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <code className="engine-command">{engine.loginCommand}</code>
                    <CopyButton text={engine.loginCommand} />
                  </div>
                </div>
              )}

              {engine.installState === "installed" && (
                <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <code className="engine-command">{engine.loginCommand}</code>
                  <CopyButton text={engine.loginCommand} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

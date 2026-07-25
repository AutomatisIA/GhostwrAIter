import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import type { CliEngineStatus, CliEngineName } from "@shared/types/settings";
import {
  Button,
  Card,
  Skeleton,
  useToast,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { fadeInUp, staggerContainer, useMotionVariants } from "../../../design-system/motion/variants";

function statusBadge(installState: CliEngineStatus["installState"]) {
  switch (installState) {
    case "authenticated":
      return (
        <span className="engine-badge engine-badge--ok">
          <CheckCircleIcon size={14} /> Connecté
        </span>
      );
    case "installed":
      return (
        <span className="engine-badge engine-badge--warn">
          <AlertTriangleIcon size={14} /> Installé
        </span>
      );
    case "not-installed":
      return (
        <span className="engine-badge engine-badge--off">
          <XCircleIcon size={14} /> Non installé
        </span>
      );
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
    <button type="button" className="btn-copy" onClick={handleCopy} title="Copier">
      {copied ? "Copié !" : "Copier"}
    </button>
  );
}

export function EnginePanel() {
  const toast = useToast();
  const [engines, setEngines] = useState<CliEngineStatus[]>([]);
  const [activeEngine, setActiveEngine] = useState<CliEngineName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const container = useMotionVariants(staggerContainer);
  const item = useMotionVariants(fadeInUp);

  const refresh = useCallback(() => {
    Promise.all([
      window.linkedinPoster.settings.detectEngines(),
      window.linkedinPoster.settings.getActiveEngine()
    ])
      .then(([detected, active]) => {
        setEngines(detected.engines);
        setActiveEngine(active.engine);
        setError(null);
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
    (name: CliEngineName, displayName: string) => {
      window.linkedinPoster.settings
        .setActiveEngine(name)
        .then((selection) => {
          setActiveEngine(selection.engine);
          toast.show({ kind: "success", message: `${displayName} est maintenant votre moteur IA actif.` });
          refresh();
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Impossible de changer le moteur.";
          toast.show({ kind: "error", message });
        });
    },
    [refresh, toast]
  );

  if (error) {
    return (
      <Card elevation={1} className="settings-engine-error" role="alert">
        <strong>Moteurs IA indisponibles</strong>
        <p>{error}</p>
        <Button variant="secondary" onClick={refresh}>
          Réessayer
        </Button>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="settings-engine-grid">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  return (
    <div className="settings-engine">
      <p className="settings-engine-intro">
        GhostwrAIter utilise un <strong>moteur IA</strong>
        <InfoHint term="moteur-ia" /> local (Claude, GPT ou Gemini) pour générer vos contenus.
        Chaque moteur fonctionne via son outil officiel : installez-le, connectez votre compte
        <InfoHint term="oauth" />, puis sélectionnez-le ci-dessous.
      </p>

      <motion.div
        className="settings-engine-grid"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {engines.map((engine) => {
          const isActive = engine.name === activeEngine;
          const canSelect = engine.installState === "authenticated";
          const isAuthenticated = engine.installState === "authenticated";

          return (
            <motion.div key={engine.name} variants={item}>
              <Card
                elevation={isActive ? 3 : 2}
                accent={isActive}
                className={`settings-engine-card${isActive ? " settings-engine-card--active" : ""}`}
                data-disabled={engine.installState === "not-installed" ? "true" : undefined}
              >
                <div className="settings-engine-card-head">
                  <strong>{engine.displayName}</strong>
                  {statusBadge(engine.installState)}
                </div>

                <span className="settings-engine-sub">{engine.subscriptionLabel}</span>

                {!isAuthenticated ? (
                  <div className="settings-engine-commands">
                    <div className="settings-engine-command-row">
                      <code className="engine-command">{engine.installCommand}</code>
                      <CopyButton text={engine.installCommand} />
                    </div>
                    <div className="settings-engine-command-row">
                      <code className="engine-command">{engine.loginCommand}</code>
                      <CopyButton text={engine.loginCommand} />
                    </div>
                  </div>
                ) : null}

                <div className="settings-engine-card-action">
                  <Button
                    variant={isActive ? "secondary" : "primary"}
                    size="sm"
                    disabled={!canSelect || isActive}
                    onClick={() => handleSelect(engine.name, engine.displayName)}
                  >
                    {isActive ? "Actif" : "Sélectionner"}
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

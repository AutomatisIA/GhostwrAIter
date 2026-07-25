import { useEffect, useState, useCallback } from "react";
import type { CliEngineStatus, CliEngineName } from "@shared/types/settings";
import {
  Button,
  Skeleton,
  useToast,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from "../../../design-system/primitives";

/**
 * Pastille d etat.
 *
 * Trois etats, trois encres, et la partition est celle de la direction : vert de
 * validation quand le moteur repond, ambre d attention quand il est installe
 * mais qu il reste une action a faire, encre discrete quand il est absent. Un
 * moteur absent n est pas une erreur : c est un choix que l utilisateur n a pas
 * fait, il ne merite pas de rouge.
 */
function statusBadge(installState: CliEngineStatus["installState"]) {
  switch (installState) {
    case "authenticated":
      return (
        <span className="engine-badge engine-badge--ok">
          <CheckCircleIcon size={13} /> Connecté
        </span>
      );
    case "installed":
      return (
        <span className="engine-badge engine-badge--warn">
          <AlertTriangleIcon size={13} /> À connecter
        </span>
      );
    case "not-installed":
      return (
        <span className="engine-badge engine-badge--off">
          <XCircleIcon size={13} /> Non installé
        </span>
      );
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} aria-label={label}>
      {copied ? "Copié" : "Copier"}
    </Button>
  );
}

/**
 * Ligne de commande a executer dans un terminal, avec son bouton de copie. Rendu
 * conditionnel a la presence de la commande : `getActiveEngine` renvoie des
 * chaines vides sur son chemin degrade, et une etiquette monospace vide se lit
 * comme un defaut d affichage.
 */
function CommandRow({ label, command }: { label: string; command: string }) {
  if (!command) {
    return null;
  }

  return (
    <div className="settings-engine__command">
      <span className="settings-engine__command-label">{label}</span>
      <code className="engine-command">{command}</code>
      <CopyButton text={command} label={`Copier la commande : ${command}`} />
    </div>
  );
}

export function EnginePanel() {
  const toast = useToast();
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
      <div className="settings-engine-error" role="alert">
        <strong>Moteurs IA indisponibles</strong>
        <p>{error}</p>
        <Button variant="secondary" size="sm" onClick={refresh}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="settings-engines" aria-busy="true" aria-label="Détection des moteurs">
        {[0, 1, 2].map((index) => (
          <div className="settings-engine" key={index}>
            <Skeleton variant="text" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="settings-engines">
      {engines.map((engine) => {
        const isActive = engine.name === activeEngine;
        const isAuthenticated = engine.installState === "authenticated";
        const isInstalled = engine.installState !== "not-installed";

        return (
          <div className="settings-engine" key={engine.name}>
            <div className="settings-engine__head">
              <span className="settings-engine__name">{engine.displayName}</span>
              {statusBadge(engine.installState)}
              <span className="settings-engine__sub">{engine.subscriptionLabel}</span>
              <div className="settings-engine__action">
                {isActive ? (
                  <span className="settings-engine__active">Moteur actif</span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!isAuthenticated}
                    onClick={() => handleSelect(engine.name, engine.displayName)}
                  >
                    Sélectionner
                  </Button>
                )}
              </div>
            </div>

            {/* Diagnostic : on n affiche que la commande qui reste a passer. Proposer
                l installation a quelqu un qui a deja l outil installe donne une
                consigne inexacte, et noie celle qui compte. */}
            {!isAuthenticated ? (
              <div className="settings-engine__commands">
                {!isInstalled ? (
                  <CommandRow label="Installer" command={engine.installCommand} />
                ) : null}
                <CommandRow label="Se connecter" command={engine.loginCommand} />
                {/* Certains moteurs n ont ni commande d installation ni
                    commande de connexion : le binaire vient d une suite et
                    l authentification se fait dans son interface. Sans cette
                    phrase, le panneau resterait muet exactement au moment ou
                    l utilisateur a besoin qu il parle. */}
                {!engine.installCommand && !engine.loginCommand && engine.setupHint ? (
                  <p className="settings-engine__hint">{engine.setupHint}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

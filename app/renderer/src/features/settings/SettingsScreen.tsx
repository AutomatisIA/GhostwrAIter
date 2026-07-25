import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { ThemeSelector } from "./components/ThemeSelector";
import { EnginePanel } from "./components/EnginePanel";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { Button, ConfirmDialog, PageFrame, useToast } from "../../design-system/primitives";
import { InfoHint, useTour } from "../../help";
import { fadeInUp, useMotionVariants } from "../../design-system/motion/variants";

import "./settings.css";
export function SettingsScreen() {
  const toast = useToast();
  const tour = useTour();
  const [searchParams] = useSearchParams();
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const autoExpandDiagnostics = searchParams.get("section") === "diagnostics";

  const reveal = useMotionVariants(fadeInUp);

  async function handleExport() {
    setExporting(true);
    try {
      const result = await window.linkedinPoster.settings.exportWorkspace();
      setExportPath(result.exportPath);
      toast.show({ kind: "success", message: "Export terminé. Votre sauvegarde est prête." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "L'export n'a pas pu être réalisé.";
      toast.show({ kind: "error", message });
    } finally {
      setExporting(false);
    }
  }

  async function handleAskConfirm() {
    try {
      const result = await window.linkedinPoster.settings.countExecutionLogs();
      setPendingCount(result.count);
      setConfirmOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de compter les journaux.";
      toast.show({ kind: "error", message });
    }
  }

  async function handleConfirmPurge() {
    setConfirmOpen(false);
    try {
      const result = await window.linkedinPoster.settings.purgeExecutionLogs();
      toast.show({
        kind: "success",
        message:
          result.deletedCount > 0
            ? `${result.deletedCount} ${
                result.deletedCount > 1 ? "journaux techniques supprimés" : "journal technique supprimé"
              } de votre ordinateur.`
            : "Aucun journal à supprimer."
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "La purge n'a pas pu être réalisée.";
      toast.show({ kind: "error", message });
    }
  }

  // Export : action de portee ecran, donc dans la barre de page.
  const pageActions = (
    <Button variant="secondary" size="sm" loading={exporting} onClick={handleExport}>
      Exporter l'espace de travail
    </Button>
  );

  return (
    <PageFrame eyebrow="Paramètres" actions={pageActions}>
      <motion.div
        className="settings-sections"
        variants={reveal}
        initial="hidden"
        animate="visible"
      >
        {/* Application : deux reglages a une ligne chacun. Ils tenaient dans deux
            cartes distinctes, ce qui donnait deux en-tetes pour deux controles. */}
        <section className="settings-section">
          <header className="settings-section-head">
            <h2 className="settings-section-title">Application</h2>
            <p className="settings-section-desc">
              Le thème suit le réglage de votre ordinateur si vous choisissez « Système ».
            </p>
          </header>

          <div className="settings-form">
            <div className="settings-row settings-row--top">
              <span className="settings-row__label">Thème</span>
              <div className="settings-row__control">
                <ThemeSelector />
              </div>
            </div>

            <div className="settings-row settings-row--top">
              <span className="settings-row__label">Visite guidée</span>
              <div className="settings-row__control">
                <Button variant="secondary" size="sm" onClick={() => tour.open()}>
                  Revoir la visite guidée
                </Button>
                <p className="settings-row__hint">
                  Présente les écrans et l'ordre du parcours conseillé : stratégie, puis création,
                  puis bibliothèque.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Moteur d'exécution */}
        <section className="settings-section">
          <header className="settings-section-head">
            <h2 className="settings-section-title">Moteur d'exécution</h2>
            <p className="settings-section-desc">
              Le moteur IA
              <InfoHint term="moteur-ia" /> qui rédige vos contenus. Chaque moteur passe par son
              outil officiel : installez-le, connectez votre compte
              <InfoHint term="oauth" />, puis sélectionnez-le. Le moteur retenu est rappelé en
              permanence au pied de la navigation.
            </p>
          </header>
          <EnginePanel />
        </section>

        {/* Diagnostics */}
        <section className="settings-section">
          <header className="settings-section-head">
            <h2 className="settings-section-title">Diagnostics</h2>
            <p className="settings-section-desc">
              L'historique des générations passées, utile pour comprendre une erreur.
            </p>
          </header>
          <DiagnosticsPanel defaultExpanded={autoExpandDiagnostics} />
        </section>

        {/* Données */}
        <section className="settings-section">
          <header className="settings-section-head">
            <h2 className="settings-section-title">Données</h2>
            <p className="settings-section-desc">
              Vos données restent sur votre ordinateur. L'export, en haut de cet écran, crée une
              sauvegarde de votre espace de travail (stratégie, inventaire des fichiers et journaux
              de génération) dans un fichier JSON.
            </p>
          </header>

          <div className="settings-form">
            <div className="settings-row settings-row--top">
              <span className="settings-row__label">Journaux techniques</span>
              <div className="settings-row__control">
                <Button variant="danger" size="sm" onClick={handleAskConfirm}>
                  Purger les journaux
                </Button>
                <p className="settings-row__hint">
                  Les journaux ne servent qu'au diagnostic. Vos contenus et votre stratégie ne sont
                  pas concernés.
                </p>
              </div>
            </div>

            {exportPath ? (
              <div className="settings-row settings-row--top">
                <span className="settings-row__label">Dernière sauvegarde</span>
                <div className="settings-row__control">
                  <code className="settings-path">{exportPath}</code>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </motion.div>

      <ConfirmDialog
        open={confirmOpen}
        destructive
        title="Purger les journaux techniques ?"
        message={
          <>
            Vous êtes sur le point de supprimer définitivement{" "}
            <strong>
              {pendingCount} {pendingCount > 1 ? "journaux techniques" : "journal technique"}
            </strong>{" "}
            de votre ordinateur. Ces journaux servent uniquement au diagnostic ; vos contenus et votre
            stratégie ne sont pas affectés. Cette action est irréversible.
          </>
        }
        confirmLabel="Purger définitivement"
        cancelLabel="Annuler"
        onConfirm={handleConfirmPurge}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageFrame>
  );
}

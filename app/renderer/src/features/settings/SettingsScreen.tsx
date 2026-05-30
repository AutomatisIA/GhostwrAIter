import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { ThemeSelector } from "./components/ThemeSelector";
import { EnginePanel } from "./components/EnginePanel";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { Button, Card, ConfirmDialog, useToast } from "../../design-system/primitives";
import { useTour } from "../../help";
import { fadeInUp, staggerContainer, useMotionVariants } from "../../design-system/motion/variants";

export function SettingsScreen() {
  const toast = useToast();
  const tour = useTour();
  const [searchParams] = useSearchParams();
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const autoExpandDiagnostics = searchParams.get("section") === "diagnostics";

  const container = useMotionVariants(staggerContainer);
  const item = useMotionVariants(fadeInUp);

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

  return (
    <section className="panel page-panel">
      <h1>Paramètres</h1>

      <motion.div
        className="settings-sections"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {/* Apparence */}
        <motion.div variants={item}>
          <Card elevation={1} className="settings-section">
            <header className="settings-section-head">
              <h2 className="settings-section-title">Apparence</h2>
              <p className="settings-section-desc">
                Choisissez le thème de l'application. Le mode système suit le réglage de votre ordinateur.
              </p>
            </header>
            <ThemeSelector />
          </Card>
        </motion.div>

        {/* Prise en main */}
        <motion.div variants={item}>
          <Card elevation={1} className="settings-section">
            <header className="settings-section-head">
              <h2 className="settings-section-title">Prise en main</h2>
              <p className="settings-section-desc">
                Revoyez la visite guidée du premier lancement, qui présente les écrans et l'ordre du
                parcours conseillé : stratégie, puis création, puis bibliothèque.
              </p>
            </header>
            <Button variant="secondary" onClick={() => tour.open()}>
              Revoir la visite guidée
            </Button>
          </Card>
        </motion.div>

        {/* Moteur d'exécution */}
        <motion.div variants={item}>
          <Card elevation={1} className="settings-section">
            <header className="settings-section-head">
              <h2 className="settings-section-title">Moteur d'exécution</h2>
              <p className="settings-section-desc">
                L'assistant IA qui rédige vos contenus. Installez-le, connectez-vous, puis activez-le.
              </p>
            </header>
            <EnginePanel />
          </Card>
        </motion.div>

        {/* Diagnostics */}
        <motion.div variants={item}>
          <Card elevation={1} className="settings-section">
            <header className="settings-section-head">
              <h2 className="settings-section-title">Diagnostics</h2>
              <p className="settings-section-desc">
                L'historique des générations passées, utile pour comprendre une erreur.
              </p>
            </header>
            <DiagnosticsPanel defaultExpanded={autoExpandDiagnostics} />
          </Card>
        </motion.div>

        {/* Données */}
        <motion.div variants={item}>
          <Card elevation={1} className="settings-section">
            <header className="settings-section-head">
              <h2 className="settings-section-title">Données</h2>
              <p className="settings-section-desc">
                Vos données restent sur votre ordinateur. L'export crée une sauvegarde de votre espace de
                travail (stratégie, inventaire des fichiers et journaux de génération) dans un fichier JSON.
              </p>
            </header>

            <div className="settings-data-actions">
              <Button variant="primary" loading={exporting} onClick={handleExport}>
                Exporter l'espace de travail
              </Button>
              <Button variant="danger" onClick={handleAskConfirm}>
                Purger les journaux
              </Button>
            </div>

            {exportPath ? (
              <p className="settings-export-path">
                Sauvegarde créée : <code>{exportPath}</code>
              </p>
            ) : null}
          </Card>
        </motion.div>
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
    </section>
  );
}

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useAiProgress } from "../../feedback/useAiProgress";
import { AiProgress, Button } from "../../design-system/primitives";
import { fadeInUp, useMotionVariants } from "../../design-system/motion/variants";
import { useWorkshopFlow } from "../workshop/hooks/useWorkshopFlow";
import { WorkshopGuide } from "../workshop/components/WorkshopGuide";
import { CadragePanel } from "../workshop/components/CadragePanel";
import { StructurePanel } from "../workshop/components/StructurePanel";
import { HookPanel } from "../workshop/components/HookPanel";
import { DraftPanel } from "../workshop/components/DraftPanel";
import { WorkshopErrorBanner } from "../workshop/components/WorkshopErrorBanner";
import { IdeaSelector } from "./components/IdeaSelector";

type ScreenMode = "selecting" | "workshop";

export function CreateScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ideaIdFromUrl = searchParams.get("ideaId");

  const [mode, setMode] = useState<ScreenMode>(ideaIdFromUrl ? "workshop" : "selecting");
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(ideaIdFromUrl);

  useEffect(() => {
    if (ideaIdFromUrl && mode === "selecting") {
      // Synchronisation depuis la navigation (URL ?ideaId) : ouvrir l'atelier
      // quand on arrive avec une idee. Sync legitime depuis une source externe.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIdeaId(ideaIdFromUrl);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("workshop");
    }
  }, [ideaIdFromUrl, mode]);

  const {
    step,
    setStep,
    status,
    error,
    clearError,
    isLoadingStructures,
    isLoadingHooks,
    isLoadingDraft,
    isLoadingCorrection,
    typology,
    setTypology,
    objective,
    setObjective,
    structures,
    selectedStructureKey,
    setSelectedStructureKey,
    selectedStructure,
    hooks,
    selectedHookId,
    setSelectedHookId,
    selectedHook,
    session,
    nextToStep2,
    nextToStep3,
    nextToStep4,
    reopenStructureSelection,
    reopenHookSelection,
    correct,
    saveDraftText,
    isSavingDraftText
  } = useWorkshopFlow(selectedIdeaId);

  // Feedback IA continu (feature 010, T031). Le ressenti de continuite est
  // porte par les flags de chargement locaux (bascule synchrone) ; le canal
  // `execution:progress` fournit le libelle de phase et la confirmation
  // terminale. Cablage chirurgical, en cohabitation avec l'UI existante.
  const aiActive =
    isLoadingStructures || isLoadingHooks || isLoadingDraft || isLoadingCorrection;
  // La phase active est derivee des flags locaux (bascule synchrone), pas du
  // canal : `spawnSync` bloque le main, donc l'evenement de phase arrive groupe
  // au retour de l'appel (research D3). C'est cette phase locale qui porte le
  // libelle/position EN CONTINU pendant l'etape.
  const aiActivePhase = isLoadingStructures
    ? "structure"
    : isLoadingHooks
      ? "hook"
      : isLoadingDraft
        ? "redaction"
        : isLoadingCorrection
          ? "correction"
          : null;
  const aiProgress = useAiProgress({ active: aiActive, activePhase: aiActivePhase });
  // Affiche le feedback continu tant qu'une etape IA est en cours. L'erreur
  // terminale reste portee par WorkshopErrorBanner (pas de double annonce) ;
  // aucune erreur n'est avalee (FR-008).
  const showAiProgress = aiActive;

  // Transition d'etape du pipeline (FR-016) : chaque etape entre en fondu/
  // glissement. Neutralise sous prefers-reduced-motion via le hook.
  const stepVariants = useMotionVariants(fadeInUp);

  function handleSelectIdea(ideaId: string) {
    setSelectedIdeaId(ideaId);
    setMode("workshop");
    setSearchParams({ ideaId });
  }

  function handleChangeIdea() {
    setSelectedIdeaId(null);
    setMode("selecting");
    setSearchParams({});
  }

  return (
    <section className="panel page-panel">
      <h1>Créer</h1>

      {mode === "selecting" ? (
        <IdeaSelector onSelect={handleSelectIdea} />
      ) : (
        <>
          <div className="form-actions">
            <Button variant="ghost" onClick={handleChangeIdea}>
              Changer d'idée
            </Button>
          </div>

          {error ? <WorkshopErrorBanner error={error} onDismiss={clearError} /> : null}

          <div className="workshop-frame">
            <WorkshopGuide
              step={step}
              status={status}
              typology={typology}
              objective={objective}
              selectedStructure={selectedStructure}
              selectedHook={selectedHook}
            />

            {showAiProgress ? (
              <AiProgress
                phase={aiProgress.phase}
                intentLabel={aiProgress.intentLabel || "Génération en cours…"}
                elapsedMs={aiProgress.elapsedMs}
                currentIndex={aiProgress.currentIndex}
                totalSteps={aiProgress.totalSteps}
                state={aiProgress.state === "idle" ? "running" : aiProgress.state}
              />
            ) : null}

            <div className="workshop-stage">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                >
                  {step === 1 && (
                    <CadragePanel
                      typology={typology}
                      onTypologyChange={setTypology}
                      objective={objective}
                      onObjectiveChange={setObjective}
                      onNext={nextToStep2}
                      isLoading={isLoadingStructures}
                    />
                  )}

                  {step === 2 && (
                    <StructurePanel
                      structures={structures}
                      selectedStructureKey={selectedStructureKey}
                      onSelect={setSelectedStructureKey}
                      onBack={() => setStep(1)}
                      onNext={nextToStep3}
                      isLoading={isLoadingStructures}
                      isLoadingNext={isLoadingHooks}
                    />
                  )}

                  {step === 3 && (
                    <HookPanel
                      hooks={hooks}
                      selectedHookId={selectedHookId}
                      onSelect={setSelectedHookId}
                      onBack={() => setStep(2)}
                      onNext={nextToStep4}
                      isLoading={isLoadingHooks}
                      isLoadingNext={isLoadingDraft}
                    />
                  )}

                  {step === 4 && session && (
                    <DraftPanel
                      session={session}
                      typology={typology}
                      objective={objective}
                      selectedStructureKey={selectedStructureKey}
                      selectedStructure={selectedStructure}
                      selectedHook={selectedHook}
                      onReopenCadrage={() => setStep(1)}
                      onReopenStructureSelection={reopenStructureSelection}
                      onReopenHookSelection={reopenHookSelection}
                      onCorrect={correct}
                      isLoadingCorrection={isLoadingCorrection}
                      onSaveDraftText={saveDraftText}
                      isSavingDraftText={isSavingDraftText}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

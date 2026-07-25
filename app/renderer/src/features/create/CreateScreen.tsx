import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useAiProgress } from "../../feedback/useAiProgress";
import { Button, PageFrame } from "../../design-system/primitives";
import { fadeInUp, useMotionVariants } from "../../design-system/motion/variants";
import { useWorkshopFlow } from "../workshop/hooks/useWorkshopFlow";
import { WorkshopContextBar } from "../workshop/components/WorkshopContextBar";
import { CadragePanel } from "../workshop/components/CadragePanel";
import { StructurePanel } from "../workshop/components/StructurePanel";
import { HookPanel } from "../workshop/components/HookPanel";
import { DraftPanel } from "../workshop/components/DraftPanel";
import { GenerationWaitPanel } from "../workshop/components/GenerationWaitPanel";
import type { WorkshopPhaseKey } from "../workshop/components/generation-phases";
import { WorkshopErrorBanner } from "../workshop/components/WorkshopErrorBanner";
import { IdeaSelector } from "./components/IdeaSelector";
import { useEngineSignal, usePhaseDurations } from "./useGenerationTelemetry";

import "./create.css";
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
  // canal : l'evenement de phase confirme, il ne precede pas.
  const aiActivePhase: WorkshopPhaseKey | null = isLoadingStructures
    ? "structure"
    : isLoadingHooks
      ? "hook"
      : isLoadingDraft
        ? "redaction"
        : isLoadingCorrection
          ? "correction"
          : null;
  const aiProgress = useAiProgress({ active: aiActive, activePhase: aiActivePhase });
  const phaseDurations = usePhaseDurations(aiActivePhase);
  const engineSignal = useEngineSignal(aiActive);

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

  if (mode === "selecting") {
    return (
      <PageFrame eyebrow="Créer">
        <IdeaSelector onSelect={handleSelectIdea} />
      </PageFrame>
    );
  }

  const eyebrow = aiActive
    ? "Atelier · génération en cours"
    : step === 4 && session
      ? "Atelier · brouillon"
      : "Atelier";

  return (
    <PageFrame
      eyebrow={eyebrow}
      actions={
        <Button variant="ghost" size="sm" onClick={handleChangeIdea}>
          Changer d&apos;idée
        </Button>
      }
    >
      <div className="workshop-screen">
        <WorkshopContextBar
          step={step}
          status={status}
          typology={typology}
          objective={objective}
          selectedStructure={selectedStructure}
          selectedHook={selectedHook}
          fallbackHookText={session?.draft.selectedHookText}
          pillarLabel={session?.contextUsed.pillarLabel}
          onReopenCadrage={aiActive ? undefined : () => setStep(1)}
        />

        {error ? (
          <div className="workshop-error">
            <WorkshopErrorBanner error={error} onDismiss={clearError} />
          </div>
        ) : null}

        {aiActive ? (
          <GenerationWaitPanel
            activePhase={aiActivePhase}
            elapsedMs={aiProgress.elapsedMs}
            durations={phaseDurations}
            signal={engineSignal}
            typology={typology}
            objective={objective}
            selectedStructure={selectedStructure}
            selectedHook={selectedHook}
            fallbackHookText={session?.draft.selectedHookText}
            pillarLabel={session?.contextUsed.pillarLabel}
          />
        ) : step === 4 && session ? (
          <DraftPanel
            session={session}
            onReopenStructureSelection={reopenStructureSelection}
            onReopenHookSelection={reopenHookSelection}
            onCorrect={correct}
            isLoadingCorrection={isLoadingCorrection}
            onSaveDraftText={saveDraftText}
            isSavingDraftText={isSavingDraftText}
          />
        ) : (
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

                {step === 4 && !session && (
                  <p className="workshop-empty">
                    Le brouillon n&apos;est pas encore disponible. Reprenez au cadrage pour
                    le relancer.
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </PageFrame>
  );
}

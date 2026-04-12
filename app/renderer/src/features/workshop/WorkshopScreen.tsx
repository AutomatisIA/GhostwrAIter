import { useSearchParams } from "react-router-dom";
import { useWorkshopFlow } from "./hooks/useWorkshopFlow";
import { WorkshopGuide } from "./components/WorkshopGuide";
import { CadragePanel } from "./components/CadragePanel";
import { StructurePanel } from "./components/StructurePanel";
import { HookPanel } from "./components/HookPanel";
import { DraftPanel } from "./components/DraftPanel";
import { WorkshopErrorBanner } from "./components/WorkshopErrorBanner";

export function WorkshopScreen() {
  const [searchParams] = useSearchParams();
  const ideaId = searchParams.get("ideaId");

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
  } = useWorkshopFlow(ideaId);

  if (!ideaId) {
    return (
      <section className="panel page-panel">
        <div className="eyebrow">Production</div>
        <h1>Atelier editorial</h1>
        <p className="empty-state">Selectionne une idee depuis le backlog pour commencer.</p>
      </section>
    );
  }

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Production</div>
      <h1>Atelier editorial</h1>
      <p>
        L'atelier transforme une idee en post en passant par une structure,
        une accroche puis un draft. Le but est de garder une generation visible
        et pilotable, et pas un simple bloc de texte opaque.
      </p>

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

        <div className="workshop-stage">
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
        </div>
      </div>
    </section>
  );
}

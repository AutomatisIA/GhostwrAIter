import { useEffect, useState } from "react";
import type {
  WorkshopSession,
  PostTypology,
  PostObjective,
  StructureOption,
  HookOption
} from "@shared/types/workshop";

function toStoredHookOptions(session: WorkshopSession): HookOption[] {
  return session.hooks.map((hook, index) => ({
    id: hook.id,
    family: index === 0 ? "hook retenu" : "alternative deja generee",
    text: hook.text,
    score: Math.max(0.55, 0.9 - index * 0.08)
  }));
}

export function useWorkshopFlow(ideaId: string | null) {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState(
    ideaId ? "Configure ton post." : "Selectionne une idee depuis le backlog."
  );

  const [typology, setTypology] = useState<PostTypology>("expertise");
  const [objective, setObjective] = useState<PostObjective>("awareness");

  const [structures, setStructures] = useState<StructureOption[]>([]);
  const [selectedStructureKey, setSelectedStructureKey] = useState("");

  const [hooks, setHooks] = useState<HookOption[]>([]);
  const [selectedHookId, setSelectedHookId] = useState("");

  const [session, setSession] = useState<WorkshopSession | null>(null);

  const selectedStructure = structures.find((structure) => structure.key === selectedStructureKey);
  const selectedHook = hooks.find((hook) => hook.id === selectedHookId);

  useEffect(() => {
    if (!ideaId) return;

    window.linkedinPoster.workshop.getSessionByIdeaId(ideaId).then((result) => {
      if (!result) return;
      const restoredTypology = result.draft.typology ?? "expertise";
      const restoredObjective = result.draft.objective ?? "awareness";
      const restoredStructureKey = result.draft.structureKey ?? "";
      const restoredStructureLabel = result.draft.structureLabel ?? restoredStructureKey;
      const restoredHooks = toStoredHookOptions(result);
      const restoredHookId =
        restoredHooks.find((hook) => hook.text === result.draft.selectedHookText)?.id ??
        restoredHooks[0]?.id ??
        "";

      setTypology(restoredTypology);
      setObjective(restoredObjective);
      setStructures(
        restoredStructureKey
          ? [
              {
                key: restoredStructureKey,
                label: restoredStructureLabel,
                rationale: "Structure deja utilisee dans le draft courant."
              }
            ]
          : []
      );
      setSelectedStructureKey(restoredStructureKey);
      setHooks(restoredHooks);
      setSelectedHookId(restoredHookId);
      setSession(result);
      setStep(4);
      setStatus("Draft pret.");
    });
  }, [ideaId]);

  async function reopenStructureSelection() {
    if (!ideaId) return;
    setStatus("Rechargement des structures...");
    try {
      const results = await window.linkedinPoster.workshop.getSuggestedStructures(
        ideaId,
        typology,
        objective
      );
      setStructures(results);
      setSelectedStructureKey((current) =>
        current && results.some((structure) => structure.key === current)
          ? current
          : (results[0]?.key ?? "")
      );
      setStep(2);
      setStatus("Choisis une structure.");
    } catch {
      setStatus("Erreur lors du rechargement des structures.");
    }
  }

  async function reopenHookSelection() {
    if (!ideaId) return;
    let structureKey = selectedStructureKey;

    if (!structureKey) {
      setStatus("Chargement de la structure actuelle...");
      try {
        const structureResults = await window.linkedinPoster.workshop.getSuggestedStructures(
          ideaId,
          typology,
          objective
        );
        setStructures(structureResults);
        structureKey = structureResults[0]?.key ?? "";
        setSelectedStructureKey(structureKey);
      } catch {
        setStatus("Erreur lors du chargement de la structure.");
        return;
      }
    }

    if (!structureKey) {
      setStatus("Aucune structure disponible pour generer des hooks.");
      return;
    }

    setStatus("Rechargement des hooks...");
    try {
      const hookResults = await window.linkedinPoster.workshop.generateHooks(
        ideaId,
        typology,
        structureKey
      );
      setHooks(hookResults);
      setSelectedHookId((current) =>
        current && hookResults.some((hook) => hook.id === current)
          ? current
          : (hookResults[0]?.id ?? "")
      );
      setStep(3);
      setStatus("Choisis ton accroche.");
    } catch {
      setStatus("Erreur lors du rechargement des hooks.");
    }
  }

  async function nextToStep2() {
    if (!ideaId) return;
    setStatus("Selection de la structure...");
    try {
      const results = await window.linkedinPoster.workshop.getSuggestedStructures(
        ideaId,
        typology,
        objective
      );
      setStructures(results);
      setSelectedStructureKey(results[0]?.key || "");
      setStep(2);
      setStatus("Choisis une structure.");
    } catch {
      setStatus("Erreur lors de la selection de structure.");
    }
  }

  async function nextToStep3() {
    if (!ideaId) return;
    setStatus("Generation des hooks...");
    try {
      const results = await window.linkedinPoster.workshop.generateHooks(
        ideaId,
        typology,
        selectedStructureKey
      );
      setHooks(results);
      setSelectedHookId(results[0]?.id || "");
      setStep(3);
      setStatus("Choisis ton accroche.");
    } catch {
      setStatus("Erreur lors de la generation des hooks.");
    }
  }

  async function nextToStep4() {
    if (!ideaId) return;
    setStatus("Generation du draft final...");
    try {
      const result = await window.linkedinPoster.workshop.generateFinalDraft(
        ideaId,
        typology,
        objective,
        selectedStructureKey,
        selectedStructure?.label ?? "",
        selectedHookId,
        selectedHook?.text ?? "",
        hooks
      );
      setSession(result);
      setStep(4);
      setStatus("Draft genere !");
    } catch {
      setStatus("Erreur lors de la generation du draft.");
    }
  }

  async function correct() {
    if (!session) return;
    setStatus("Passe de correction...");
    try {
      const result = await window.linkedinPoster.workshop.correctDraft(session.draft.id);
      setSession(result);
      setStatus("Draft corrige.");
    } catch {
      setStatus("Erreur lors de la correction.");
    }
  }

  return {
    step,
    setStep,
    status,
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
    correct
  };
}

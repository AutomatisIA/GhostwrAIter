import { useEffect, useState } from "react";
import type {
  WorkshopSession,
  PostTypology,
  PostObjective,
  StructureOption,
  HookOption
} from "@shared/types/workshop";

export type WorkshopError = {
  code: string;
  message: string;
};

const KNOWN_ERROR_MESSAGES: Record<string, string> = {
  CODEX_CLI_FAILED:
    "Codex CLI n'a pas pu démarrer. Vérifie qu'il est installé et authentifié (`codex login`).",
  CODEX_CLI_TIMEOUT:
    "Codex CLI a dépassé son délai. La génération a été interrompue.",
  CODEX_CLI_INVALID_JSON:
    "Codex CLI a renvoyé une réponse invalide. Réessaie ou consulte le log.",
  SKILL_PROMPT_NOT_FOUND:
    "Le prompt d'une compétence est manquant. Vérifie le fichier `skills/<name>/SKILL.md`.",
  IPC_HANDLER_ERROR: "Une erreur interne s'est produite côté application."
};

function extractError(err: unknown): WorkshopError {
  if (err instanceof Error) {
    const code = err.name && err.name !== "Error" ? err.name : "UNKNOWN_ERROR";
    const mapped = KNOWN_ERROR_MESSAGES[code];
    return {
      code,
      message: mapped ?? err.message ?? "Erreur inconnue"
    };
  }
  return { code: "UNKNOWN_ERROR", message: String(err) };
}

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
  const [error, setError] = useState<WorkshopError | null>(null);

  const [isLoadingStructures, setIsLoadingStructures] = useState(false);
  const [isLoadingHooks, setIsLoadingHooks] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isLoadingCorrection, setIsLoadingCorrection] = useState(false);

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

  function clearError() {
    setError(null);
  }

  async function reopenStructureSelection() {
    if (!ideaId) return;
    clearError();
    setIsLoadingStructures(true);
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
    } catch (err) {
      setError(extractError(err));
      setStatus("Echec du rechargement des structures.");
    } finally {
      setIsLoadingStructures(false);
    }
  }

  async function reopenHookSelection() {
    if (!ideaId) return;
    clearError();
    let structureKey = selectedStructureKey;

    if (!structureKey) {
      setIsLoadingStructures(true);
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
      } catch (err) {
        setError(extractError(err));
        setStatus("Echec du chargement de la structure.");
        setIsLoadingStructures(false);
        return;
      } finally {
        setIsLoadingStructures(false);
      }
    }

    if (!structureKey) {
      setStatus("Aucune structure disponible pour generer des hooks.");
      return;
    }

    setIsLoadingHooks(true);
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
    } catch (err) {
      setError(extractError(err));
      setStatus("Echec du rechargement des hooks.");
    } finally {
      setIsLoadingHooks(false);
    }
  }

  async function nextToStep2() {
    if (!ideaId) return;
    clearError();
    setIsLoadingStructures(true);
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
    } catch (err) {
      setError(extractError(err));
      setStatus("Echec de la selection de structure.");
    } finally {
      setIsLoadingStructures(false);
    }
  }

  async function nextToStep3() {
    if (!ideaId) return;
    clearError();
    setIsLoadingHooks(true);
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
    } catch (err) {
      setError(extractError(err));
      setStatus("Echec de la generation des hooks.");
    } finally {
      setIsLoadingHooks(false);
    }
  }

  async function nextToStep4() {
    if (!ideaId) return;
    clearError();
    setIsLoadingDraft(true);
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
    } catch (err) {
      setError(extractError(err));
      setStatus("Echec de la generation du draft.");
    } finally {
      setIsLoadingDraft(false);
    }
  }

  async function correct() {
    if (!session) return;
    clearError();
    setIsLoadingCorrection(true);
    setStatus("Passe de correction...");
    try {
      const result = await window.linkedinPoster.workshop.correctDraft(session.draft.id);
      setSession(result);
      setStatus("Draft corrige.");
    } catch (err) {
      setError(extractError(err));
      setStatus("Echec de la correction.");
    } finally {
      setIsLoadingCorrection(false);
    }
  }

  return {
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
    correct
  };
}

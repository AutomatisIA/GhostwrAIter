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
  // ENGINE_NOT_AUTHENTICATED, ENGINE_NOT_REGISTERED et ENGINE_RESOLUTION_FAILED
  // ne sont volontairement PAS mappés ici : le message du backend nomme déjà le
  // moteur concerné et la commande de connexion à lancer. Le laisser passer est
  // plus actionnable que n'importe quel texte générique écrit ici.
  ENGINE_UNAVAILABLE:
    "Aucun moteur IA n'est disponible. Ouvre les Paramètres pour en installer et en connecter un.",
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
    family: index === 0 ? "hook retenu" : "alternative déjà générée",
    text: hook.text,
    score: Math.max(0.55, 0.9 - index * 0.08)
  }));
}

export function useWorkshopFlow(ideaId: string | null) {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState(
    ideaId ? "Configure ton post." : "Sélectionne une idée depuis le backlog."
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

    window.linkedinPoster.workshop
      .getSessionByIdeaId(ideaId)
      .then((result) => {
        // `null` n est pas une panne : c est une idee du backlog jamais passee a
        // l atelier. Elle ouvre le cadrage, ce qui est le parcours nominal.
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
                  rationale: "Structure déjà utilisée dans le draft courant."
                }
              ]
            : []
        );
        setSelectedStructureKey(restoredStructureKey);
        setHooks(restoredHooks);
        setSelectedHookId(restoredHookId);
        setSession(result);
        setStep(4);
        setStatus("Brouillon prêt");
      })
      // Sans cette branche, une lecture en echec laissait l atelier a l etape 1
      // avec un cadrage vierge, c est-a-dire l ecran EXACT d une idee neuve.
      // L utilisateur refaisait son parcours et ecrasait, a la generation
      // suivante, le brouillon qu il croyait perdu. Une session illisible doit
      // se dire ; c est la seule information qui empeche la perte de travail.
      .catch((err: unknown) => {
        setError(extractError(err));
        setStatus("Impossible de relire ce brouillon.");
      });
  }, [ideaId]);

  function clearError() {
    setError(null);
  }

  async function reopenStructureSelection() {
    if (!ideaId) return;
    clearError();
    setIsLoadingStructures(true);
    setStatus("Rechargement des structures…");
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
      setStatus("Échec du rechargement des structures.");
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
      setStatus("Chargement de la structure actuelle…");
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
        setStatus("Échec du chargement de la structure.");
        setIsLoadingStructures(false);
        return;
      } finally {
        setIsLoadingStructures(false);
      }
    }

    if (!structureKey) {
      setStatus("Aucune structure disponible pour générer des hooks.");
      return;
    }

    setIsLoadingHooks(true);
    setStatus("Rechargement des hooks…");
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
      setStatus("Échec du rechargement des hooks.");
    } finally {
      setIsLoadingHooks(false);
    }
  }

  async function nextToStep2() {
    if (!ideaId) return;
    clearError();
    setIsLoadingStructures(true);
    setStatus("Sélection de la structure…");
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
      setStatus("Échec de la sélection de structure.");
    } finally {
      setIsLoadingStructures(false);
    }
  }

  async function nextToStep3() {
    if (!ideaId) return;
    clearError();
    setIsLoadingHooks(true);
    setStatus("Génération des hooks…");
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
      setStatus("Échec de la génération des hooks.");
    } finally {
      setIsLoadingHooks(false);
    }
  }

  async function nextToStep4() {
    if (!ideaId) return;
    clearError();
    setIsLoadingDraft(true);
    setStatus("Génération du draft final…");
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
      setStatus("Draft généré !");
    } catch (err) {
      setError(extractError(err));
      setStatus("Échec de la génération du draft.");
    } finally {
      setIsLoadingDraft(false);
    }
  }

  async function correct() {
    if (!session) return;
    clearError();
    setIsLoadingCorrection(true);
    setStatus("Passe de correction…");
    try {
      const result = await window.linkedinPoster.workshop.correctDraft(session.draft.id);
      setSession(result);
      // Le drapeau est lu dans RESULT, jamais dans `session` : cette derniere est
      // la valeur capturee par la closure au rendu, donc la session d AVANT
      // l appel. Le verdict etait ainsi decale d un tour, et il decrivait la
      // correction precedente. Le cas n a rien de rare : le drapeau vaut `false`
      // sur 37 % des corrections reellement mesurees en base.
      setStatus(
        result.correctionApplied === false
          ? "La correction n'a pas amélioré le brouillon. Texte d'origine conservé."
          : "Draft corrigé."
      );
    } catch (err) {
      setError(extractError(err));
      setStatus("Échec de la correction.");
    } finally {
      setIsLoadingCorrection(false);
    }
  }

  const [isSavingDraftText, setIsSavingDraftText] = useState(false);

  async function saveDraftText(headline: string, bodyMarkdown: string) {
    if (!session) return;
    clearError();
    setIsSavingDraftText(true);
    try {
      const result = await window.linkedinPoster.workshop.updateDraftText(
        session.draft.id,
        headline,
        bodyMarkdown
      );
      setSession(result);
      setStatus("Texte enregistré.");
    } catch (err) {
      setError(extractError(err));
      setStatus("Échec de l'enregistrement.");
    } finally {
      setIsSavingDraftText(false);
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
    correct,
    saveDraftText,
    isSavingDraftText
  };
}

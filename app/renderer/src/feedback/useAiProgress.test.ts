// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ExecutionProgressEvent } from "@shared/types/execution-progress";
import {
  PHASE_INTENT_LABELS,
  WORKSHOP_PIPELINE,
  phaseToIntentLabel,
  useAiProgress
} from "./useAiProgress";

type ProgressListener = (event: ExecutionProgressEvent) => void;

/**
 * Faux canal `execution:progress` : on capture le dernier listener abonne et on
 * compte les desabonnements pour verifier l'absence de fuite.
 */
function installFakeChannel() {
  let listener: ProgressListener | null = null;
  let unsubscribeCount = 0;
  const onExecutionProgress = vi.fn((cb: ProgressListener) => {
    listener = cb;
    return () => {
      unsubscribeCount += 1;
      listener = null;
    };
  });

  (window as unknown as { linkedinPoster: { onExecutionProgress: typeof onExecutionProgress } }).linkedinPoster =
    {
      onExecutionProgress
    };

  return {
    emit(event: ExecutionProgressEvent) {
      listener?.(event);
    },
    get subscribeCount() {
      return onExecutionProgress.mock.calls.length;
    },
    get unsubscribeCount() {
      return unsubscribeCount;
    }
  };
}

function makeEvent(partial: Partial<ExecutionProgressEvent>): ExecutionProgressEvent {
  return {
    runId: "run_1",
    phase: "redaction",
    status: "started",
    engine: "codex",
    at: new Date().toISOString(),
    ...partial
  };
}

describe("phaseToIntentLabel", () => {
  it("mappe chaque phase vers un libelle en langage clair francais", () => {
    expect(phaseToIntentLabel("redaction")).toBe("Rédaction du post en cours…");
    expect(phaseToIntentLabel("structure")).toBe("Choix de la structure en cours…");
    expect(phaseToIntentLabel("hook")).toBe("Génération des accroches en cours…");
    expect(phaseToIntentLabel("correction")).toBe("Passe de correction en cours…");
    expect(phaseToIntentLabel("foundation")).toBe("Construction du socle éditorial en cours…");
    expect(phaseToIntentLabel("idees")).toBe("Génération des idées en cours…");
    // Toutes les phases connues ont un libelle non vide.
    for (const label of Object.values(PHASE_INTENT_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("useAiProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("s'abonne au canal au montage et se desabonne au demontage (pas de fuite)", () => {
    const channel = installFakeChannel();
    const { unmount } = renderHook(() => useAiProgress({ active: false }));
    expect(channel.subscribeCount).toBe(1);
    unmount();
    expect(channel.unsubscribeCount).toBe(1);
  });

  it("passe a l'etat running quand `active` est vrai, avec l'intention de la phase", () => {
    const channel = installFakeChannel();
    const { result } = renderHook(() =>
      useAiProgress({ active: true, totalSteps: WORKSHOP_PIPELINE.length })
    );

    act(() => {
      channel.emit(makeEvent({ phase: "structure", status: "started" }));
    });

    expect(result.current.state).toBe("running");
    expect(result.current.intentLabel).toBe("Choix de la structure en cours…");
    expect(result.current.phase).toBe("structure");
    expect(result.current.totalSteps).toBe(WORKSHOP_PIPELINE.length);
    expect(result.current.currentIndex).toBe(WORKSHOP_PIPELINE.indexOf("structure"));
  });

  it("derive intentLabel/currentIndex de `activePhase` local SANS evenement de canal (cas spawnSync)", () => {
    installFakeChannel();
    // Aucun evenement emis : c'est exactement le cas de production ou `started`
    // arrive groupe au retour de l'appel. La phase locale doit porter le libelle.
    const { result, rerender } = renderHook(
      ({ activePhase }: { activePhase: typeof WORKSHOP_PIPELINE[number] | null }) =>
        useAiProgress({ active: true, activePhase }),
      { initialProps: { activePhase: "structure" as const } }
    );

    expect(result.current.intentLabel).toBe("Choix de la structure en cours…");
    expect(result.current.currentIndex).toBe(WORKSHOP_PIPELINE.indexOf("structure"));

    rerender({ activePhase: "hook" });
    expect(result.current.intentLabel).toBe("Génération des accroches en cours…");
    expect(result.current.currentIndex).toBe(WORKSHOP_PIPELINE.indexOf("hook"));

    rerender({ activePhase: "redaction" });
    expect(result.current.intentLabel).toBe("Rédaction du post en cours…");
    expect(result.current.currentIndex).toBe(WORKSHOP_PIPELINE.indexOf("redaction"));
  });

  it("retombe sur currentIndex 0 pour une phase hors du pipeline (indexOf -1)", () => {
    installFakeChannel();
    // `foundation` n'appartient pas au pipeline atelier : `indexOf` renvoie -1.
    // Le repli explicite doit donner 0, jamais un index negatif.
    expect(WORKSHOP_PIPELINE.includes("foundation" as never)).toBe(false);
    const { result } = renderHook(() =>
      useAiProgress({ active: true, activePhase: "foundation" })
    );
    expect(result.current.currentIndex).toBe(0);
  });

  it("incremente elapsedMs independamment pendant que l'operation est active", () => {
    installFakeChannel();
    const { result } = renderHook(() => useAiProgress({ active: true }));

    expect(result.current.elapsedMs).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(900);
  });

  it("transition running -> success sur un evenement completed", () => {
    const channel = installFakeChannel();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useAiProgress({ active }),
      { initialProps: { active: true } }
    );

    act(() => {
      channel.emit(makeEvent({ phase: "redaction", status: "started" }));
    });
    expect(result.current.state).toBe("running");

    act(() => {
      channel.emit(makeEvent({ phase: "redaction", status: "completed" }));
    });
    rerender({ active: false });

    expect(result.current.state).toBe("success");
  });

  it("transition running -> error sur un evenement failed, en exposant le code", () => {
    const channel = installFakeChannel();
    const { result } = renderHook(() => useAiProgress({ active: true }));

    act(() => {
      channel.emit(makeEvent({ phase: "redaction", status: "started" }));
    });
    act(() => {
      channel.emit(
        makeEvent({ phase: "redaction", status: "failed", errorCode: "CODEX_CLI_FAILED" })
      );
    });

    expect(result.current.state).toBe("error");
    expect(result.current.errorCode).toBe("CODEX_CLI_FAILED");
  });

  it("le timer s'arrete une fois l'operation terminee", () => {
    const channel = installFakeChannel();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useAiProgress({ active }),
      { initialProps: { active: true } }
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });
    const beforeStop = result.current.elapsedMs;

    act(() => {
      channel.emit(makeEvent({ phase: "redaction", status: "completed" }));
    });
    rerender({ active: false });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.elapsedMs).toBe(beforeStop);
  });
});

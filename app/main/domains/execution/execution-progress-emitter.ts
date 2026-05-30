import type { WebContents } from "electron";
import log from "electron-log/main.js";
import {
  EXECUTION_PROGRESS_CHANNEL,
  type ExecutionEngine,
  type ExecutionPhase,
  type ExecutionProgressEvent,
  type ExecutionProgressStatus
} from "../../../shared/types/execution-progress";

/**
 * Emetteur du canal additif `execution:progress` (feature 010, T027).
 *
 * One-way `main -> renderer`. L'emission est best-effort : elle n'echoue
 * JAMAIS l'operation metier sous-jacente. Si `sender` est absent (handler
 * appele hors IPC, build drift) ou detruit, l'emission est un no-op silencieux.
 * Contrat : `specs/010-visual-experience-overhaul/contracts/execution-progress-channel.md`.
 */

function emitProgress(
  sender: WebContents | undefined,
  event: ExecutionProgressEvent
): void {
  if (!sender) {
    return;
  }
  try {
    if (sender.isDestroyed()) {
      return;
    }
    sender.send(EXECUTION_PROGRESS_CHANNEL, event);
  } catch (err) {
    // Best-effort : ne jamais propager une erreur d'emission au flux metier.
    log.warn(
      `[execution:progress] emission ignoree (${event.phase}/${event.status}): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Emet la borne `started` avant l'appel moteur d'une etape.
 */
export function emitPhaseStarted(
  sender: WebContents | undefined,
  args: { runId: string; phase: ExecutionPhase; engine: ExecutionEngine }
): void {
  emitProgress(sender, {
    runId: args.runId,
    phase: args.phase,
    status: "started",
    engine: args.engine,
    at: new Date().toISOString()
  });
}

/**
 * Emet la borne terminale d'une etape : `completed` apres succes,
 * `failed` apres echec (avec `errorCode` de la taxonomie existante). Le `failed`
 * est journalise.
 */
export function emitPhaseSettled(
  sender: WebContents | undefined,
  args: {
    runId: string;
    phase: ExecutionPhase;
    engine: ExecutionEngine;
    status: Extract<ExecutionProgressStatus, "completed" | "failed">;
    errorCode?: string;
  }
): void {
  if (args.status === "failed") {
    log.warn(
      `[execution:progress] phase ${args.phase} failed (${args.errorCode ?? "UNKNOWN"})`
    );
  }
  emitProgress(sender, {
    runId: args.runId,
    phase: args.phase,
    status: args.status,
    engine: args.engine,
    at: new Date().toISOString(),
    ...(args.errorCode ? { errorCode: args.errorCode } : {})
  });
}

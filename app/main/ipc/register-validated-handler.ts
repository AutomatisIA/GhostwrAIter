import log from "electron-log/main.js";
import { ZodError, type ZodTypeAny, type ZodTuple } from "zod";

/**
 * Discriminated-union envelope produced by every validated IPC handler.
 * See specs/003-ipc-validation/contracts/result-envelope.md for the full
 * contract, including serialization and consumption rules.
 */
export type IpcResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: IpcError };

export type IpcError = {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
};

/**
 * Shape of the Electron `ipcMain` registrar exposed by the main process.
 * Compatible with the `IpcRegistrar` declared in every existing handler file.
 */
export type IpcRegistrar = {
  handle: (
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
};

/**
 * Handler signature for single-input validated channels. The handler receives
 * the post-validation value, may be sync or async, and MUST NOT construct its
 * own envelope — the wrapper is the only code that produces envelopes.
 */
export type ValidatedIpcHandler<TInput, TOutput> = (
  input: TInput
) => TOutput | Promise<TOutput>;

/**
 * Handler signature for positional tuple-input channels. The handler receives
 * the spread of the validated tuple as positional arguments.
 */
export type ValidatedIpcTupleHandler<
  TArgs extends readonly unknown[],
  TOutput
> = (...args: TArgs) => TOutput | Promise<TOutput>;

/**
 * Mapping from the class name (or `error.name`) of a thrown typed error to
 * the envelope error code that the renderer should see. Used by the wrapper
 * to preserve the vocabulary of typed errors defined by previous features
 * (for example, WorkspaceConfigurationError from feature 002).
 *
 * See specs/003-ipc-validation/contracts/error-code-taxonomy.md for the
 * current taxonomy and the rules for adding new passthrough entries.
 */
export const KNOWN_ERROR_CODE_MAP: ReadonlyMap<string, string> = new Map([
  ["WorkspaceConfigurationError", "WORKSPACE_CONFIGURATION_INVALID"],
  ["WorkspacePathEscapeError", "WORKSPACE_PATH_ESCAPE"]
]);

const LOG_MESSAGE_MAX_LENGTH = 80;

function truncate(value: string): string {
  return value.length <= LOG_MESSAGE_MAX_LENGTH
    ? value
    : `${value.slice(0, LOG_MESSAGE_MAX_LENGTH)}\u2026`;
}

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "";
  }
  return path
    .map((segment) => (typeof segment === "number" ? `[${segment}]` : segment))
    .join(".")
    .replace(/^\./, "");
}

function envelopeFromZodError(zodError: ZodError): IpcResult<never> {
  const first = zodError.issues[0];
  const field = first ? formatZodPath(first.path as Array<string | number>) : "";
  const message = first
    ? `${field || "input"}: ${first.message}`
    : "invalid input";
  return {
    ok: false,
    error: {
      code: "IPC_INPUT_INVALID",
      message,
      ...(field ? { field } : {})
    }
  };
}

function classifyThrown(err: unknown): IpcResult<never> {
  if (err instanceof Error) {
    const mapped = KNOWN_ERROR_CODE_MAP.get(err.name);
    if (mapped !== undefined) {
      return {
        ok: false,
        error: {
          code: mapped,
          message: err.message
        }
      };
    }
    return {
      ok: false,
      error: {
        code: "IPC_HANDLER_ERROR",
        message: `Unexpected handler error: ${err.message}`
      }
    };
  }
  return {
    ok: false,
    error: {
      code: "IPC_HANDLER_ERROR",
      message: `Unexpected handler error: ${String(err)}`
    }
  };
}

function logFailure(channel: string, envelope: IpcResult<unknown>): void {
  if (envelope.ok) {
    return;
  }
  const { code, message, field } = envelope.error;
  const truncated = truncate(message);
  if (code === "IPC_INPUT_INVALID") {
    log.warn(`[ipc] ${channel}: input validation failed (${field ?? "?"}) ${truncated}`);
    return;
  }
  if (code === "IPC_HANDLER_ERROR") {
    log.error(`[ipc] ${channel}: handler threw (${truncated})`);
    return;
  }
  log.warn(`[ipc] ${channel}: ${code} (${truncated})`);
}

/**
 * Register an IPC handler whose single input is validated by the given schema.
 * Returns either the success envelope carrying the handler's return value, or
 * a failure envelope carrying a typed error code.
 *
 * Never throws out of the handler: every failure path produces an envelope.
 */
export function registerValidatedHandler<TInput, TOutput>(
  ipcRegistrar: IpcRegistrar,
  channel: string,
  schema: ZodTypeAny,
  handler: ValidatedIpcHandler<TInput, TOutput>
): void {
  ipcRegistrar.handle(channel, async (_event, ...args) => {
    const rawInput = args.length === 0 ? undefined : args[0];
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      const envelope = envelopeFromZodError(parsed.error);
      logFailure(channel, envelope);
      return envelope;
    }
    try {
      const output = await handler(parsed.data as TInput);
      return { ok: true, data: output } satisfies IpcResult<TOutput>;
    } catch (err) {
      const envelope = classifyThrown(err);
      logFailure(channel, envelope);
      return envelope;
    }
  });
}

/**
 * Register an IPC handler whose input is a positional tuple, validated by the
 * given tuple schema and spread into the handler as positional arguments.
 *
 * Same envelope guarantees as `registerValidatedHandler`.
 */
export function registerValidatedTupleHandler<
  TArgs extends readonly unknown[],
  TOutput
>(
  ipcRegistrar: IpcRegistrar,
  channel: string,
  tupleSchema: ZodTuple<never, never>,
  handler: ValidatedIpcTupleHandler<TArgs, TOutput>
): void {
  ipcRegistrar.handle(channel, async (_event, ...args) => {
    const parsed = tupleSchema.safeParse(args);
    if (!parsed.success) {
      const envelope = envelopeFromZodError(parsed.error);
      logFailure(channel, envelope);
      return envelope;
    }
    try {
      const parsedArgs = parsed.data as unknown as TArgs;
      const output = await handler(...parsedArgs);
      return { ok: true, data: output } satisfies IpcResult<TOutput>;
    } catch (err) {
      const envelope = classifyThrown(err);
      logFailure(channel, envelope);
      return envelope;
    }
  });
}

/**
 * Preload-side helper that unwraps an IpcResult envelope. Returns the
 * data on success, throws a typed Error on failure. The thrown Error has
 * its `name` set to the envelope's error code and its `message` carrying
 * the original message (suffixed with the field name when present).
 *
 * This is the ONLY code that consumes envelopes. Renderer screens MUST NOT
 * inspect envelope shapes directly — they see either a returned value or
 * a thrown Error, exactly as they did before feature 003.
 */
export async function unwrapIpcResult<T>(
  promise: Promise<IpcResult<T>>
): Promise<T> {
  const result = await promise;
  if (result.ok) {
    return result.data;
  }
  const error = new Error(
    result.error.field
      ? `${result.error.message} (field: ${result.error.field})`
      : result.error.message
  );
  error.name = result.error.code;
  throw error;
}

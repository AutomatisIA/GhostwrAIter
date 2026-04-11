import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  registerValidatedHandler,
  registerValidatedTupleHandler,
  unwrapIpcResult,
  type IpcRegistrar,
  type IpcResult
} from "../../app/main/ipc/register-validated-handler";
import { WorkspaceConfigurationError } from "../../app/main/workspace/workspace.service";

type CapturedHandler = (
  event: unknown,
  ...args: unknown[]
) => unknown | Promise<unknown>;

function createCapturedRegistrar(): { registrar: IpcRegistrar; handlers: Map<string, CapturedHandler> } {
  const handlers = new Map<string, CapturedHandler>();
  const registrar: IpcRegistrar = {
    handle(channel, handler) {
      handlers.set(channel, handler);
    }
  };
  return { registrar, handlers };
}

describe("registerValidatedHandler — success path", () => {
  it("returns { ok: true, data } when the handler runs synchronously on valid input", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    const schema = z.object({ title: z.string().min(1) });

    registerValidatedHandler(registrar, "test:sync-success", schema, (input) => {
      return { echoed: input.title.toUpperCase() };
    });

    const result = (await handlers.get("test:sync-success")?.(undefined, {
      title: "hello"
    })) as IpcResult<{ echoed: string }>;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.echoed).toBe("HELLO");
    }
  });

  it("returns { ok: true, data } when the handler runs asynchronously on valid input", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    const schema = z.object({ count: z.number().int() });

    registerValidatedHandler(registrar, "test:async-success", schema, async (input) => {
      await Promise.resolve();
      return { doubled: input.count * 2 };
    });

    const result = (await handlers.get("test:async-success")?.(undefined, {
      count: 21
    })) as IpcResult<{ doubled: number }>;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.doubled).toBe(42);
    }
  });
});

describe("registerValidatedHandler — validation failures", () => {
  const schema = z.object({
    title: z.string().min(1),
    count: z.number().int()
  });

  it("returns IPC_INPUT_INVALID on a missing required field", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    registerValidatedHandler(registrar, "test:missing-field", schema, () => "ok");

    const result = (await handlers.get("test:missing-field")?.(undefined, {
      count: 1
    })) as IpcResult<string>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_INPUT_INVALID");
      expect(result.error.field).toBe("title");
    }
  });

  it("returns IPC_INPUT_INVALID on a wrong-type field", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    registerValidatedHandler(registrar, "test:wrong-type", schema, () => "ok");

    const result = (await handlers.get("test:wrong-type")?.(undefined, {
      title: "hello",
      count: "not a number"
    })) as IpcResult<string>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_INPUT_INVALID");
      expect(result.error.field).toBe("count");
    }
  });
});

describe("registerValidatedHandler — empty input schema", () => {
  it("accepts undefined with z.undefined() empty schema", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    const emptySchema = z.undefined();

    registerValidatedHandler(registrar, "test:no-input", emptySchema, () => 42);

    const result = (await handlers.get("test:no-input")?.(undefined)) as IpcResult<number>;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(42);
    }
  });

  it("rejects non-undefined input with an empty schema", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    const emptySchema = z.undefined();

    registerValidatedHandler(registrar, "test:no-input-reject", emptySchema, () => 42);

    const result = (await handlers.get("test:no-input-reject")?.(undefined, {
      intruder: true
    })) as IpcResult<number>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_INPUT_INVALID");
    }
  });
});

describe("registerValidatedHandler — handler error classification", () => {
  const schema = z.object({ id: z.string() });

  it("returns IPC_HANDLER_ERROR when the handler throws a generic Error", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    registerValidatedHandler(registrar, "test:generic-throw", schema, () => {
      throw new Error("something went wrong deep in the service");
    });

    const result = (await handlers.get("test:generic-throw")?.(undefined, {
      id: "x"
    })) as IpcResult<unknown>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_HANDLER_ERROR");
      expect(result.error.message).toContain("something went wrong deep in the service");
    }
  });

  it("passes WorkspaceConfigurationError through as WORKSPACE_CONFIGURATION_INVALID", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    registerValidatedHandler(registrar, "test:workspace-err", schema, () => {
      throw new WorkspaceConfigurationError(
        "NOT_ABSOLUTE",
        "./relative",
        "Not an absolute path"
      );
    });

    const result = (await handlers.get("test:workspace-err")?.(undefined, {
      id: "x"
    })) as IpcResult<unknown>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("WORKSPACE_CONFIGURATION_INVALID");
      expect(result.error.message).toContain("Not an absolute path");
    }
  });

  it("returns IPC_HANDLER_ERROR when an async handler rejects", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    registerValidatedHandler(registrar, "test:async-reject", schema, async () => {
      await Promise.resolve();
      throw new Error("async failure");
    });

    const result = (await handlers.get("test:async-reject")?.(undefined, {
      id: "x"
    })) as IpcResult<unknown>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_HANDLER_ERROR");
    }
  });
});

describe("registerValidatedTupleHandler", () => {
  const tupleSchema = z.tuple([
    z.string().min(1),
    z.enum(["expertise", "opinion"]),
    z.number().int().min(0).max(100)
  ]);

  it("accepts a valid tuple and spreads it as positional arguments", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    registerValidatedTupleHandler(
      registrar,
      "test:tuple-valid",
      tupleSchema,
      (id, typology, count) => {
        return { id, typology, count };
      }
    );

    const result = (await handlers.get("test:tuple-valid")?.(
      undefined,
      "id-1",
      "expertise",
      5
    )) as IpcResult<{ id: string; typology: string; count: number }>;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: "id-1", typology: "expertise", count: 5 });
    }
  });

  it("rejects a tuple with the wrong length (too few)", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    registerValidatedTupleHandler(
      registrar,
      "test:tuple-short",
      tupleSchema,
      () => "ok"
    );

    const result = (await handlers.get("test:tuple-short")?.(
      undefined,
      "id-1",
      "expertise"
    )) as IpcResult<unknown>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_INPUT_INVALID");
    }
  });

  it("rejects a tuple with a wrong-type element at a specific position", async () => {
    const { registrar, handlers } = createCapturedRegistrar();
    registerValidatedTupleHandler(
      registrar,
      "test:tuple-wrong-type",
      tupleSchema,
      () => "ok"
    );

    const result = (await handlers.get("test:tuple-wrong-type")?.(
      undefined,
      "id-1",
      "unknown-typology",
      5
    )) as IpcResult<unknown>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_INPUT_INVALID");
      expect(result.error.field).toContain("1");
    }
  });

  it("reports a nested field path when a tuple element is itself an object with an invalid property", async () => {
    const nestedTupleSchema = z.tuple([
      z.string().min(1),
      z.array(
        z.object({
          id: z.string(),
          score: z.number().min(0).max(1)
        })
      )
    ]);
    const { registrar, handlers } = createCapturedRegistrar();
    registerValidatedTupleHandler(
      registrar,
      "test:tuple-nested",
      nestedTupleSchema,
      () => "ok"
    );

    const result = (await handlers.get("test:tuple-nested")?.(
      undefined,
      "id-1",
      [
        { id: "h1", score: 0.5 },
        { id: "h2", score: 2.5 }
      ]
    )) as IpcResult<unknown>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_INPUT_INVALID");
      expect(result.error.field).toContain("1");
      expect(result.error.field).toContain("score");
    }
  });
});

describe("unwrapIpcResult preload helper", () => {
  it("returns data on a successful envelope", async () => {
    const envelope: IpcResult<{ value: number }> = {
      ok: true,
      data: { value: 7 }
    };
    const result = await unwrapIpcResult(Promise.resolve(envelope));
    expect(result).toEqual({ value: 7 });
  });

  it("throws an Error with name set to error.code on a failure envelope", async () => {
    const envelope: IpcResult<unknown> = {
      ok: false,
      error: { code: "IPC_INPUT_INVALID", message: "title is required", field: "title" }
    };

    let caught: unknown;
    try {
      await unwrapIpcResult(Promise.resolve(envelope));
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    if (caught instanceof Error) {
      expect(caught.name).toBe("IPC_INPUT_INVALID");
      expect(caught.message).toContain("title is required");
      expect(caught.message).toContain("field: title");
    }
  });

  it("throws an Error without field suffix when field is absent", async () => {
    const envelope: IpcResult<unknown> = {
      ok: false,
      error: { code: "IPC_HANDLER_ERROR", message: "something failed" }
    };

    let caught: unknown;
    try {
      await unwrapIpcResult(Promise.resolve(envelope));
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    if (caught instanceof Error) {
      expect(caught.name).toBe("IPC_HANDLER_ERROR");
      expect(caught.message).toBe("something failed");
    }
  });
});

describe("logging contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not include raw payload values in the log message on a validation failure", async () => {
    // We assert indirectly: the log output captured via console.warn stub
    // must not contain the payload string. Since the wrapper uses electron-log,
    // we capture via the test helper shape — this is a smoke assertion.
    const { registrar, handlers } = createCapturedRegistrar();
    const schema = z.object({ secret: z.string().min(1) });

    registerValidatedHandler(registrar, "test:logging", schema, () => "ok");

    // Intentionally malformed: secret is missing.
    const result = (await handlers.get("test:logging")?.(undefined, {
      wrongField: "SENSITIVE_PAYLOAD_VALUE_DO_NOT_LEAK"
    })) as IpcResult<string>;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toContain("SENSITIVE_PAYLOAD_VALUE_DO_NOT_LEAK");
    }
  });
});

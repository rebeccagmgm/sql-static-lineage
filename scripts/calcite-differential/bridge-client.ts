import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptions,
} from "node:child_process";
import { Buffer } from "node:buffer";
import type { Readable, Writable } from "node:stream";
import {
  DIFFERENTIAL_HARD_LIMITS,
  parseDifferentialJson,
  serializeDifferentialRequest,
  stableSerialize,
  validateDifferentialResponse,
  type DifferentialRequest,
  type DifferentialResponse,
  type DifferentialIssue,
} from "./protocol.ts";

export const DEFAULT_CALCITE_JAVA_EXECUTABLE = "java";
export const DEFAULT_CALCITE_MAIN_CLASS =
  "com.gf.sqlstaticlineage.calciterelbridge.CalciteRelBridge";
export const DEFAULT_CALCITE_TIMEOUT_MS = 30_000;
export const DEFAULT_CALCITE_STDERR_BYTES = 64 * 1024;
export const DEFAULT_CALCITE_RESPONSE_LINE_BYTES =
  DIFFERENTIAL_HARD_LIMITS.maxOutputBytes;

export interface BridgeProcess {
  readonly stdin: Writable;
  readonly stdout: Readable;
  readonly stderr: Readable;
  once(event: "error", listener: (error: Error) => void): this;
  once(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  kill(signal?: NodeJS.Signals): boolean;
}

export type BridgeSpawn = (
  executable: string,
  args: string[],
  options: SpawnOptions,
) => BridgeProcess;

export interface CalciteBridgeClientOptions {
  /** Fixed default is `java`; tests and hermetic callers may inject it. */
  readonly javaExecutable?: string;
  /** A platform-delimited Java classpath passed as one `-cp` argument. */
  readonly classpath: string;
  /** Fixed default is the independent RelNode bridge main class. */
  readonly mainClass?: string;
  readonly extraArgs?: readonly string[];
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly maxStderrBytes?: number;
  readonly maxResponseLineBytes?: number;
  /** Injectable only for tests; production uses Node's spawn directly. */
  readonly spawnProcess?: BridgeSpawn;
}

export interface ResolvedCalciteBridgeClientOptions {
  readonly javaExecutable: string;
  readonly classpath: string;
  readonly mainClass: string;
  readonly extraArgs: readonly string[];
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly maxStderrBytes: number;
  readonly maxResponseLineBytes: number;
  readonly spawnProcess: BridgeSpawn;
}

export interface CalciteBridgeRunResult {
  readonly requestCount: number;
  readonly responseCount: number;
  readonly responses: readonly DifferentialResponse[];
  readonly stderrBytes: number;
  readonly command: {
    readonly executable: string;
    readonly args: readonly string[];
  };
}

export class CalciteBridgeError extends Error {
  readonly code: string;
  readonly issues: readonly DifferentialIssue[];
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: string,
    message: string,
    options: {
      readonly issues?: readonly DifferentialIssue[];
      readonly details?: Readonly<Record<string, unknown>>;
      readonly cause?: unknown;
    } = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "CalciteBridgeError";
    this.code = code;
    this.issues = options.issues ?? [];
    this.details = options.details;
  }
}

export interface Utf8LineOptions {
  readonly maxBytes: number;
  readonly tooLargeCode: string;
  readonly invalidUtf8Code: string;
}

/**
 * Read physical UTF-8 lines without allowing Node's replacement decoder to
 * turn invalid bytes into apparently valid protocol text. The line limit is
 * measured before CRLF normalization and excludes the LF delimiter.
 */
export async function* iterateUtf8Lines(
  stream: AsyncIterable<Uint8Array>,
  options: Utf8LineOptions,
): AsyncGenerator<string> {
  let pending = Buffer.alloc(0);
  const decoder = new TextDecoder("utf-8", { fatal: true });

  const decode = (encoded: Uint8Array): string => {
    if (encoded.byteLength > options.maxBytes)
      throw new CalciteBridgeError(
        options.tooLargeCode,
        `JSONL line exceeds ${options.maxBytes} bytes.`,
        {
          details: {
            byteLength: encoded.byteLength,
            maxBytes: options.maxBytes,
          },
        },
      );
    const withoutCr =
      encoded.byteLength > 0 && encoded[encoded.byteLength - 1] === 0x0d
        ? encoded.subarray(0, encoded.byteLength - 1)
        : encoded;
    try {
      return decoder.decode(withoutCr);
    } catch (error) {
      throw new CalciteBridgeError(
        options.invalidUtf8Code,
        "JSONL line is not valid UTF-8.",
        { cause: error },
      );
    }
  };

  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    pending = pending.length === 0 ? bytes : Buffer.concat([pending, bytes]);
    let newline = pending.indexOf(0x0a);
    while (newline >= 0) {
      const encoded = pending.subarray(0, newline);
      pending = pending.subarray(newline + 1);
      yield decode(encoded);
      newline = pending.indexOf(0x0a);
    }
    if (pending.byteLength > options.maxBytes)
      throw new CalciteBridgeError(
        options.tooLargeCode,
        `JSONL line exceeds ${options.maxBytes} bytes.`,
        {
          details: {
            byteLength: pending.byteLength,
            maxBytes: options.maxBytes,
          },
        },
      );
  }

  if (pending.byteLength > 0) yield decode(pending);
}

export function resolveCalciteBridgeOptions(
  options: CalciteBridgeClientOptions,
): ResolvedCalciteBridgeClientOptions {
  if (typeof options.classpath !== "string" || options.classpath.trim() === "")
    throw new CalciteBridgeError(
      "BRIDGE_CONFIGURATION_INVALID",
      "a non-empty Calcite classpath is required.",
    );
  const javaExecutable =
    options.javaExecutable ?? DEFAULT_CALCITE_JAVA_EXECUTABLE;
  const mainClass = options.mainClass ?? DEFAULT_CALCITE_MAIN_CLASS;
  if (
    typeof javaExecutable !== "string" ||
    typeof mainClass !== "string" ||
    javaExecutable.trim() === "" ||
    mainClass.trim() === ""
  )
    throw new CalciteBridgeError(
      "BRIDGE_CONFIGURATION_INVALID",
      "javaExecutable and mainClass must be non-empty.",
    );
  const extraArgs = options.extraArgs ?? [];
  if (
    !Array.isArray(extraArgs) ||
    extraArgs.some((argument) => typeof argument !== "string")
  )
    throw new CalciteBridgeError(
      "BRIDGE_CONFIGURATION_INVALID",
      "extraArgs must contain only strings.",
    );
  const timeoutMs = options.timeoutMs ?? DEFAULT_CALCITE_TIMEOUT_MS;
  const maxStderrBytes = options.maxStderrBytes ?? DEFAULT_CALCITE_STDERR_BYTES;
  const maxResponseLineBytes =
    options.maxResponseLineBytes ?? DEFAULT_CALCITE_RESPONSE_LINE_BYTES;
  for (const [name, value] of [
    ["timeoutMs", timeoutMs],
    ["maxStderrBytes", maxStderrBytes],
    ["maxResponseLineBytes", maxResponseLineBytes],
  ] as const) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new CalciteBridgeError(
        "BRIDGE_CONFIGURATION_INVALID",
        `${name} must be a positive safe integer.`,
      );
  }
  return {
    javaExecutable,
    classpath: options.classpath,
    mainClass,
    extraArgs,
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    timeoutMs,
    maxStderrBytes,
    maxResponseLineBytes,
    spawnProcess:
      options.spawnProcess ??
      ((executable, args, spawnOptions) =>
        spawn(
          executable,
          args,
          spawnOptions,
        ) as ChildProcessWithoutNullStreams),
  };
}

function commandFor(options: ResolvedCalciteBridgeClientOptions): string[] {
  return ["-cp", options.classpath, options.mainClass, ...options.extraArgs];
}

async function writeLine(stream: Writable, line: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    stream.once("error", onError);
    stream.write(line, "utf8", (error?: Error | null) => {
      stream.removeListener("error", onError);
      if (error) reject(error);
      else resolve();
    });
  }).catch((error) => {
    throw new CalciteBridgeError(
      "BRIDGE_STDIN_ERROR",
      "failed to write a JSONL request.",
      {
        cause: error,
      },
    );
  });
}

async function closeInput(stream: Writable): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    stream.once("error", onError);
    stream.end(() => {
      stream.removeListener("error", onError);
      resolve();
    });
  }).catch((error) => {
    if (error instanceof CalciteBridgeError) throw error;
    throw new CalciteBridgeError(
      "BRIDGE_STDIN_ERROR",
      "failed to close the JSONL request stream.",
      {
        cause: error,
      },
    );
  });
}

function parseResponse(
  line: string,
  request: DifferentialRequest,
): DifferentialResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch (error) {
    throw new CalciteBridgeError(
      "BRIDGE_RESPONSE_MALFORMED_JSON",
      "Calcite bridge emitted a malformed JSON response.",
      { cause: error },
    );
  }
  const validation = validateDifferentialResponse(parsed, request.limits);
  if (!validation.valid)
    throw new CalciteBridgeError(
      "BRIDGE_RESPONSE_PROTOCOL_INVALID",
      "Calcite bridge emitted a response outside the differential protocol.",
      { issues: validation.issues },
    );
  const response = parsed as DifferentialResponse;
  if (response.requestKind !== request.requestKind)
    throw new CalciteBridgeError(
      "BRIDGE_RESPONSE_PROTOCOL_INVALID",
      "Calcite bridge response requestKind does not match the request.",
      {
        details: {
          expected: request.requestKind,
          actual: response.requestKind,
        },
      },
    );
  if (response.requestId !== request.requestId)
    throw new CalciteBridgeError(
      "BRIDGE_RESPONSE_PROTOCOL_INVALID",
      "Calcite bridge response requestId does not match the request.",
      { details: { expected: request.requestId, actual: response.requestId } },
    );
  if (response.fingerprint.inputFingerprint !== request.fingerprint)
    throw new CalciteBridgeError(
      "BRIDGE_RESPONSE_PROTOCOL_INVALID",
      "Calcite bridge response fingerprint does not match the request.",
      {
        details: {
          expected: request.fingerprint,
          actual: response.fingerprint.inputFingerprint,
        },
      },
    );
  if (response.status === "SUCCESS") {
    const expectedMappings =
      request.requestKind === "PLAN_FACTS_REL_V1" ? request.mappings : [];
    if (stableSerialize(response.mappingRefs) !== stableSerialize(expectedMappings))
      throw new CalciteBridgeError(
        "BRIDGE_RESPONSE_PROTOCOL_INVALID",
        "Calcite bridge response mappingRefs do not exactly round-trip the request mappings.",
      );
  }
  return response;
}

function errorFromProcessClose(
  code: number | null,
  signal: NodeJS.Signals | null,
): CalciteBridgeError | undefined {
  if (code === null || code !== 0)
    return new CalciteBridgeError(
      "BRIDGE_PROCESS_EXIT",
      `Calcite bridge exited before completing the JSONL exchange (code=${String(code)}, signal=${String(signal)}).`,
      { details: { code, signal } },
    );
  return undefined;
}

function terminate(child: BridgeProcess): void {
  try {
    child.kill();
  } catch {
    // The original transport error is more useful than a best-effort kill error.
  }
}

const HARMLESS_SLF4J_NO_BINDING_LINES = [
  /^SLF4J(?:\(W\))?: (?:No SLF4J providers were found|Failed to load class "org\.slf4j\.impl\.StaticLoggerBinder")\.?$/,
  /^SLF4J(?:\(W\))?: Defaulting to no-operation \(NOP\) logger implementation\.?$/,
  /^SLF4J(?:\(W\))?: See https?:\/\/www\.slf4j\.org\/codes\.html#(?:StaticLoggerBinder|noProviders) for further details\.?$/,
] as const;

function isHarmlessSlf4jNoBindingDiagnostics(stderr: string): boolean {
  return stderr.split(/\r?\n/).every((line) => {
    const trimmed = line.trim();
    return (
      trimmed === "" ||
      HARMLESS_SLF4J_NO_BINDING_LINES.some((pattern) => pattern.test(trimmed))
    );
  });
}

/**
 * Run one bounded JSONL exchange over exactly one bridge process. The source
 * may be an async stream; requests and responses are paired in source order.
 */
export async function runCalciteBridge(
  requests: Iterable<DifferentialRequest> | AsyncIterable<DifferentialRequest>,
  options: CalciteBridgeClientOptions,
): Promise<CalciteBridgeRunResult> {
  const resolved = resolveCalciteBridgeOptions(options);
  const args = commandFor(resolved);
  async function* requestStream(): AsyncGenerator<DifferentialRequest> {
    for await (const request of requests) yield request;
  }
  const requestIterator = requestStream()[Symbol.asyncIterator]();
  let first: IteratorResult<DifferentialRequest>;
  try {
    first = await requestIterator.next();
  } catch (error) {
    throw new CalciteBridgeError(
      "BRIDGE_REQUEST_SOURCE_ERROR",
      "the differential request source failed before the bridge was started.",
      { cause: error },
    );
  }
  if (first.done)
    return {
      requestCount: 0,
      responseCount: 0,
      responses: [],
      stderrBytes: 0,
      command: { executable: resolved.javaExecutable, args },
    };
  let firstSerialized: string;
  try {
    firstSerialized = serializeDifferentialRequest(first.value);
  } catch (error) {
    throw new CalciteBridgeError(
      "BRIDGE_REQUEST_INVALID",
      "a request failed differential protocol validation before spawn exchange.",
      { cause: error },
    );
  }
  let child: BridgeProcess;
  try {
    child = resolved.spawnProcess(resolved.javaExecutable, args, {
      cwd: resolved.cwd,
      env:
        resolved.env === undefined
          ? undefined
          : { ...process.env, ...resolved.env },
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    throw new CalciteBridgeError(
      "BRIDGE_SPAWN_FAILED",
      "failed to start the Calcite bridge process.",
      { cause: error },
    );
  }

  let closeResult:
    | { readonly code: number | null; readonly signal: NodeJS.Signals | null }
    | undefined;
  let processError: Error | undefined;
  const closePromise = new Promise<void>((resolve) => {
    child.once("error", (error) => {
      processError = error;
    });
    child.once("close", (code, signal) => {
      closeResult = { code, signal };
      resolve();
    });
  });

  let stderrBytes = 0;
  let stderrOverflow = false;
  const stderrParts: Buffer[] = [];
  child.stderr.on("data", (chunk: Buffer | string) => {
    const bytes = Buffer.from(chunk);
    stderrBytes += bytes.byteLength;
    if (stderrBytes > resolved.maxStderrBytes) {
      stderrOverflow = true;
      return;
    }
    stderrParts.push(bytes);
  });

  let timedOut = false;
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      terminate(child);
      reject(
        new CalciteBridgeError(
          "BRIDGE_TIMEOUT",
          `Calcite bridge did not complete within ${resolved.timeoutMs} ms.`,
          { details: { timeoutMs: resolved.timeoutMs } },
        ),
      );
    }, resolved.timeoutMs);
  });
  const guarded = async <T>(promise: Promise<T>): Promise<T> =>
    Promise.race([promise, timeoutPromise]);
  const stdoutLines = iterateUtf8Lines(child.stdout, {
    maxBytes: resolved.maxResponseLineBytes,
    tooLargeCode: "BRIDGE_RESPONSE_LINE_TOO_LARGE",
    invalidUtf8Code: "BRIDGE_RESPONSE_INVALID_UTF8",
  });
  const stdoutIterator = stdoutLines[Symbol.asyncIterator]();
  const responses: DifferentialResponse[] = [];
  let requestCount = 0;

  try {
    let current: IteratorResult<DifferentialRequest> = first;
    let serialized = firstSerialized;
    while (!current.done) {
      const request = current.value;
      await guarded(writeLine(child.stdin, serialized));
      requestCount += 1;
      const next = await guarded(stdoutIterator.next());
      if (next.done) {
        await guarded(closePromise);
        if (processError)
          throw new CalciteBridgeError(
            "BRIDGE_PROCESS_ERROR",
            "Calcite bridge emitted a process error.",
            { cause: processError },
          );
        const processFailure = errorFromProcessClose(
          closeResult?.code ?? null,
          closeResult?.signal ?? null,
        );
        if (processFailure) throw processFailure;
        throw new CalciteBridgeError(
          "BRIDGE_RESPONSE_COUNT_MISMATCH",
          "Calcite bridge closed before returning one response per request.",
          { details: { requestCount, responseCount: responses.length } },
        );
      }
      responses.push(parseResponse(next.value, request));

      try {
        current = await guarded(requestIterator.next());
      } catch (error) {
        if (error instanceof CalciteBridgeError) throw error;
        throw new CalciteBridgeError(
          "BRIDGE_REQUEST_SOURCE_ERROR",
          "the differential request source failed during the bridge exchange.",
          { cause: error },
        );
      }
      if (!current.done) {
        try {
          serialized = serializeDifferentialRequest(current.value);
        } catch (error) {
          throw new CalciteBridgeError(
            "BRIDGE_REQUEST_INVALID",
            "a request failed differential protocol validation during the bridge exchange.",
            { cause: error },
          );
        }
      }
    }

    await guarded(closeInput(child.stdin));
    const extra = await guarded(stdoutIterator.next());
    if (!extra.done)
      throw new CalciteBridgeError(
        "BRIDGE_RESPONSE_COUNT_MISMATCH",
        "Calcite bridge emitted more responses than requests.",
        { details: { requestCount, responseCount: responses.length + 1 } },
      );
    await guarded(closePromise);
    if (processError)
      throw new CalciteBridgeError(
        "BRIDGE_PROCESS_ERROR",
        "Calcite bridge emitted a process error.",
        {
          cause: processError,
        },
      );
    const processFailure = errorFromProcessClose(
      closeResult?.code ?? null,
      closeResult?.signal ?? null,
    );
    if (processFailure) throw processFailure;
    if (stderrOverflow)
      throw new CalciteBridgeError(
        "BRIDGE_STDERR_LIMIT_EXCEEDED",
        `Calcite bridge stderr exceeded ${resolved.maxStderrBytes} bytes.`,
        { details: { stderrBytes, maxStderrBytes: resolved.maxStderrBytes } },
      );
    const stderr = Buffer.concat(stderrParts).toString("utf8");
    if (stderrBytes > 0 && !isHarmlessSlf4jNoBindingDiagnostics(stderr))
      throw new CalciteBridgeError(
        "BRIDGE_STDERR",
        "Calcite bridge wrote diagnostics to stderr; the exchange is not trusted.",
        {
          details: {
            stderrBytes,
            stderr,
          },
        },
      );
    if (responses.length !== requestCount)
      throw new CalciteBridgeError(
        "BRIDGE_RESPONSE_COUNT_MISMATCH",
        "Calcite bridge response count does not match request count.",
        { details: { requestCount, responseCount: responses.length } },
      );
    return {
      requestCount,
      responseCount: responses.length,
      responses,
      stderrBytes,
      command: { executable: resolved.javaExecutable, args },
    };
  } catch (error) {
    if (!timedOut) terminate(child);
    if (error instanceof CalciteBridgeError) throw error;
    throw new CalciteBridgeError(
      "BRIDGE_EXCHANGE_FAILED",
      "Calcite bridge JSONL exchange failed.",
      {
        cause: error,
      },
    );
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

/** Parse a request stream for the explicit runner without silently skipping lines. */
export async function* parseDifferentialRequestLines(
  stream: AsyncIterable<Uint8Array>,
): AsyncGenerator<DifferentialRequest> {
  let lineNumber = 0;
  for await (const line of iterateUtf8Lines(stream, {
    maxBytes: DIFFERENTIAL_HARD_LIMITS.maxInputBytes,
    tooLargeCode: "BRIDGE_REQUEST_LINE_TOO_LARGE",
    invalidUtf8Code: "BRIDGE_REQUEST_INVALID_UTF8",
  })) {
    lineNumber += 1;
    if (line.trim() === "")
      throw new CalciteBridgeError(
        "BRIDGE_REQUEST_EMPTY_LINE",
        `request JSONL line ${lineNumber} is empty.`,
        { details: { lineNumber } },
      );
    const parsed = parseDifferentialJson(line);
    if (!parsed.ok)
      throw new CalciteBridgeError(
        "BRIDGE_REQUEST_INVALID",
        `request JSONL line ${lineNumber} failed differential protocol validation.`,
        { issues: parsed.issues, details: { lineNumber } },
      );
    yield parsed.request;
  }
}

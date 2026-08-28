import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
  makeDifferentialFingerprint,
  requestFingerprint,
  stableJsonLine,
  type DifferentialRequest,
  type DifferentialResponse,
  type RawSqlDifferentialRequest,
} from "../../scripts/calcite-differential/protocol.ts";
import {
  runCalciteBridge,
  type BridgeSpawn,
} from "../../scripts/calcite-differential/bridge-client.ts";
import {
  resolveIndependentReportPath,
  runAndWriteDifferentialReport,
  summarizeDifferentialResponses,
  type DifferentialRunnerOptions,
} from "../../scripts/calcite-differential/run-differential.ts";

type FakeResponseMode =
  | "success"
  | "malformed"
  | "invalidUtf8"
  | "protocolMismatch"
  | "mappingMismatch"
  | "stderr"
  | "harmlessSlf4jStderr"
  | "mixedSlf4jStderr"
  | "exit"
  | "timeout"
  | "extra";

class FakeChild extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;
  private readonly mode: FakeResponseMode;
  private requestBuffer = "";

  constructor(mode: FakeResponseMode) {
    super();
    this.mode = mode;
    this.stdin.on("data", (chunk: Buffer) => {
      this.requestBuffer += chunk.toString("utf8");
      let newline = this.requestBuffer.indexOf("\n");
      while (newline >= 0) {
        const line = this.requestBuffer.slice(0, newline).replace(/\r$/, "");
        this.requestBuffer = this.requestBuffer.slice(newline + 1);
        this.respond(line);
        newline = this.requestBuffer.indexOf("\n");
      }
    });
    this.stdin.on("finish", () => {
      if (this.mode !== "timeout") {
        this.stdout.end();
        queueMicrotask(() => this.emit("close", 0, null));
      }
    });
  }

  kill(): boolean {
    this.killed = true;
    this.stdout.end();
    this.stderr.end();
    queueMicrotask(() => this.emit("close", 1, "SIGTERM"));
    return true;
  }

  private respond(line: string): void {
    if (this.mode === "timeout") return;
    const request = JSON.parse(line) as RawSqlDifferentialRequest;
    if (this.mode === "stderr") this.stderr.write("bridge warning\n", "utf8");
    if (
      this.mode === "harmlessSlf4jStderr" ||
      this.mode === "mixedSlf4jStderr"
    ) {
      this.stderr.write(
        [
          'SLF4J: Failed to load class "org.slf4j.impl.StaticLoggerBinder".',
          "SLF4J: Defaulting to no-operation (NOP) logger implementation",
          "SLF4J: See http://www.slf4j.org/codes.html#StaticLoggerBinder for further details.",
          ...(this.mode === "mixedSlf4jStderr" ? ["bridge warning"] : []),
          "",
        ].join("\n"),
        "utf8",
      );
    }
    if (this.mode === "exit") {
      this.stdout.end();
      queueMicrotask(() => this.emit("close", 7, null));
      return;
    }
    if (this.mode === "malformed") {
      this.stdout.write("{not-json\n", "utf8");
      return;
    }
    if (this.mode === "invalidUtf8") {
      this.stdout.write(Buffer.from([0xff, 0x0a]));
      return;
    }
    const response = responseFor(request);
    const responseWithProtocolMismatch = {
      ...response,
      fingerprint: {
        ...response.fingerprint,
        inputFingerprint: "wrong",
      },
    };
    const responseWithMappingMismatch = {
      ...response,
      mappingRefs: [
        {
          mappingId: "unexpected",
          nativeRelationId: "native",
          nativeRelationOccurrenceId: "occurrence",
          evidenceRefs: [],
        },
      ],
    };
    const output =
      this.mode === "protocolMismatch"
        ? responseWithProtocolMismatch
        : this.mode === "mappingMismatch"
          ? responseWithMappingMismatch
          : response;
    const encoded = stableJsonLine(output);
    this.stdout.write(encoded, "utf8");
    if (this.mode === "extra") this.stdout.write(encoded, "utf8");
  }
}

function request(requestId?: string): RawSqlDifferentialRequest {
  const body: Omit<RawSqlDifferentialRequest, "fingerprint"> = {
    protocolVersion: CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
    requestKind: "RAW_SQL_V1",
    ...(requestId ? { requestId } : {}),
    sql: "SELECT 1",
    schema: {
      tables: [
        {
          name: "dual",
          columns: [{ name: "value", type: "INTEGER", nullable: false }],
        },
      ],
    },
  };
  return { ...body, fingerprint: requestFingerprint(body) };
}

function responseFor(input: DifferentialRequest): DifferentialResponse {
  return {
    protocolVersion: CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
    requestKind: input.requestKind,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    status: "SUCCESS",
    fingerprint: makeDifferentialFingerprint(input.fingerprint),
    issues: [],
    mappingRefs: [],
    observations: [],
  };
}

function fakeSpawn(mode: FakeResponseMode, children: FakeChild[]): BridgeSpawn {
  return vi.fn(() => {
    const child = new FakeChild(mode);
    children.push(child);
    return child as never;
  }) as unknown as BridgeSpawn;
}

const baseBridgeOptions = {
  javaExecutable: "java-test",
  classpath: "fixture-classpath",
  mainClass: "fixture.Main",
  timeoutMs: 100,
};

describe("Calcite differential bridge client", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });

  it("streams multiple requests through one configured Java process", async () => {
    const children: FakeChild[] = [];
    const spawn = fakeSpawn("success", children);
    const result = await runCalciteBridge([request("one"), request("two")], {
      ...baseBridgeOptions,
      spawnProcess: spawn,
    });

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith(
      "java-test",
      ["-cp", "fixture-classpath", "fixture.Main"],
      expect.objectContaining({ shell: false, windowsHide: true }),
    );
    expect(result.requestCount).toBe(2);
    expect(result.responseCount).toBe(2);
    expect(result.responses.map((item) => item.requestId)).toEqual([
      "one",
      "two",
    ]);
  });

  it.each([
    ["malformed", "BRIDGE_RESPONSE_MALFORMED_JSON"],
    ["invalidUtf8", "BRIDGE_RESPONSE_INVALID_UTF8"],
    ["protocolMismatch", "BRIDGE_RESPONSE_PROTOCOL_INVALID"],
    ["mappingMismatch", "BRIDGE_RESPONSE_PROTOCOL_INVALID"],
    ["stderr", "BRIDGE_STDERR"],
    ["mixedSlf4jStderr", "BRIDGE_STDERR"],
    ["exit", "BRIDGE_PROCESS_EXIT"],
    ["extra", "BRIDGE_RESPONSE_COUNT_MISMATCH"],
  ] as const)("fails closed for %s", async (mode, code) => {
    const children: FakeChild[] = [];
    await expect(
      runCalciteBridge([request("one")], {
        ...baseBridgeOptions,
        spawnProcess: fakeSpawn(mode, children),
      }),
    ).rejects.toMatchObject({ code });
  });

  it("allows only the known harmless SLF4J no-binding diagnostics", async () => {
    const result = await runCalciteBridge([request("slf4j")], {
      ...baseBridgeOptions,
      spawnProcess: fakeSpawn("harmlessSlf4jStderr", []),
    });

    expect(result.responseCount).toBe(1);
    expect(result.stderrBytes).toBeGreaterThan(0);
  });

  it("kills the child and fails closed on timeout", async () => {
    const children: FakeChild[] = [];
    await expect(
      runCalciteBridge([request("slow")], {
        ...baseBridgeOptions,
        timeoutMs: 10,
        spawnProcess: fakeSpawn("timeout", children),
      }),
    ).rejects.toMatchObject({ code: "BRIDGE_TIMEOUT" });
    expect(children[0]?.killed).toBe(true);
  });

  it("rejects an invalid request before starting the process", async () => {
    const spawn = fakeSpawn("success", []);
    const invalid = { ...request(), fingerprint: "wrong" };
    await expect(
      runCalciteBridge([invalid], {
        ...baseBridgeOptions,
        spawnProcess: spawn,
      }),
    ).rejects.toMatchObject({ code: "BRIDGE_REQUEST_INVALID" });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("writes only an independent report atomically and never emits causal decisions", async () => {
    const directory = mkdtempSync(
      join(tmpdir(), "calcite-differential-runner-"),
    );
    temporaryDirectories.push(directory);
    const inputPath = join(directory, "requests.jsonl");
    const outputPath = join(directory, "report.json");
    writeFileSync(inputPath, stableJsonLine(request("report-1")), "utf8");

    const options: DifferentialRunnerOptions = {
      inputPath,
      outputPath,
      independentOutputDir: directory,
      ...baseBridgeOptions,
      spawnProcess: fakeSpawn("success", []),
    };
    const report = await runAndWriteDifferentialReport(options);
    const stored = JSON.parse(readFileSync(outputPath, "utf8")) as Record<
      string,
      unknown
    >;

    expect(report.requestCount).toBe(1);
    expect(report.responseCount).toBe(1);
    expect(report.status).toBe("SUCCESS");
    expect(report.summary).toMatchObject({
      responseStatusCounts: { SUCCESS: 1 },
      mapping: {
        evaluatedObservationCount: 0,
        exactlyMappedObservationCount: 0,
        unmappableObservationCount: 0,
        exactMappingRate: null,
      },
      projectionCoverage: {
        RAW_SQL_V1: {
          requestCount: 1,
          successCount: 1,
          unsupportedCount: 0,
          failedCount: 0,
        },
      },
    });
    expect(stored).toMatchObject({
      reportVersion: 1,
      requestCount: 1,
      responseCount: 1,
      summary: { responseStatusCounts: { SUCCESS: 1 } },
    });
    expect(JSON.stringify(stored)).not.toContain("PROVEN_UNRELATED");
    expect(stored).not.toHaveProperty("fieldLineage");
    expect(stored).not.toHaveProperty("causalSlice");
  });

  it("counts repeated observations and exposes conflicting observation identities", () => {
    const input = request("summary");
    const first = responseFor(input);
    const observation = {
      observationId: "observation:duplicate",
      kind: "predicates" as const,
      status: "EVALUATED" as const,
      mappingRefs: ["mapping:one"],
      evidenceRefs: ["evidence:one"],
      values: [{ predicate: "a = 1" }],
    };
    const second: DifferentialResponse = {
      ...first,
      observations: [{ ...observation }],
    };
    const conflicting: DifferentialResponse = {
      ...first,
      observations: [{ ...observation, values: [{ predicate: "a = 2" }] }],
    };

    expect(summarizeDifferentialResponses([
      { ...first, observations: [observation] },
      second,
      conflicting,
    ])).toMatchObject({
      observationOccurrenceCount: 3,
      uniqueObservationCount: 1,
      duplicateObservationCount: 2,
      observationIdContentConflictCount: 1,
      issueCodeCounts: { OBSERVATION_ID_CONTENT_CONFLICT: 1 },
    });
  });

  it("rejects canonical task artifact paths even when an independent directory is supplied", () => {
    expect(() =>
      resolveIndependentReportPath(
        "E:/workspace/artifacts/tasks/209119/report.json",
        "E:/workspace",
      ),
    ).toThrowError(/OUTPUT_PATH_FORBIDDEN|canonical artifacts\/tasks/i);
    expect(() =>
      resolveIndependentReportPath(
        "E:/workspace/staging/calcite-differential/field-lineage.json",
      ),
    ).toThrowError(/OUTPUT_FILENAME_FORBIDDEN|canonical/i);
  });
});

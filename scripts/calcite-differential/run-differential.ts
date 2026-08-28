import { randomUUID } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CalciteBridgeError,
  DEFAULT_CALCITE_JAVA_EXECUTABLE,
  DEFAULT_CALCITE_MAIN_CLASS,
  DEFAULT_CALCITE_TIMEOUT_MS,
  parseDifferentialRequestLines,
  runCalciteBridge,
  type CalciteBridgeClientOptions,
} from "./bridge-client.ts";
import type {
  DifferentialMetadataKind,
  DifferentialObservationStatus,
  DifferentialResponse,
  DifferentialResponseStatus,
} from "./protocol.ts";
import { stableSerialize } from "./protocol.ts";

const DEFAULT_STAGING_DIR = resolve("staging", "calcite-differential");
const DEFAULT_REPORT_NAME = "differential-report.json";
const CANONICAL_FILENAMES = new Set([
  "field-lineage.json",
  "field-lineage.html",
  "target-field-causal-slice.json",
  "target-field-causal-slice.html",
]);

export interface DifferentialRunnerOptions extends CalciteBridgeClientOptions {
  /** A UTF-8 JSONL file; omit it to read stdin. `-` is also stdin. */
  readonly inputPath?: string;
  /** Injectable byte stream for tests or a caller that already owns stdin. */
  readonly input?: AsyncIterable<Uint8Array>;
  /** Must be a report JSON path under the approved independent root. */
  readonly outputPath?: string;
  /** Explicitly opts a caller into a separate, non-canonical report directory. */
  readonly independentOutputDir?: string;
}

export interface DifferentialRunSummary {
  readonly responseStatusCounts: Readonly<Record<DifferentialResponseStatus, number>>;
  readonly observationKindCounts: Readonly<Record<DifferentialMetadataKind, number>>;
  readonly observationStatusCounts: Readonly<Record<DifferentialObservationStatus, number>>;
  readonly issueCodeCounts: Readonly<Record<string, number>>;
  readonly projectionCoverage: Readonly<Record<"RAW_SQL_V1" | "PLAN_FACTS_REL_V1", {
    readonly requestCount: number;
    readonly successCount: number;
    readonly unsupportedCount: number;
    readonly failedCount: number;
  }>>;
  readonly mapping: {
    readonly evaluatedObservationCount: number;
    readonly exactlyMappedObservationCount: number;
    readonly unmappableObservationCount: number;
    readonly exactMappingRate: number | null;
  };
  /** Observations can be repeated when one Plan Facts request contains a shared descendant. */
  readonly observationOccurrenceCount: number;
  readonly uniqueObservationCount: number;
  readonly duplicateObservationCount: number;
  /** Same observationId with different content is unsafe to reconcile. */
  readonly observationIdContentConflictCount: number;
  readonly fingerprints: {
    readonly protocolVersions: readonly number[];
    readonly calciteVersions: readonly string[];
    readonly buildFingerprints: readonly string[];
  };
}

export interface DifferentialRunReport {
  readonly reportVersion: 1;
  readonly generatedAt: string;
  readonly status: "SUCCESS" | "FAILED";
  readonly requestCount: number;
  readonly responseCount: number;
  readonly unsupportedCount: number;
  readonly failedResponseCount: number;
  readonly summary: DifferentialRunSummary;
  readonly responses: readonly DifferentialResponse[];
  readonly issues: readonly {
    readonly code: string;
    readonly message: string;
  }[];
  readonly runner: {
    readonly javaExecutable: string;
    readonly classpath: string;
    readonly mainClass: string;
    readonly timeoutMs: number;
  };
  readonly safety: {
    readonly reportKind: "INDEPENDENT_DIFFERENTIAL_REPORT";
    readonly canonicalArtifactsWritten: false;
    readonly causalDecisionsWritten: false;
  };
}

export function resolveIndependentReportPath(
  outputPath?: string,
  independentOutputDir?: string,
): string {
  const independentRoot = resolve(independentOutputDir ?? DEFAULT_STAGING_DIR);
  const resolvedOutput =
    outputPath === undefined
      ? join(independentRoot, DEFAULT_REPORT_NAME)
      : resolve(
          independentOutputDir && !isAbsolute(outputPath)
            ? independentRoot
            : process.cwd(),
          outputPath,
        );
  assertSafePathText(resolvedOutput);
  const outputName = basename(resolvedOutput).toLowerCase();
  if (!outputName.endsWith(".json"))
    throw new CalciteBridgeError(
      "OUTPUT_FILENAME_INVALID",
      "an independent differential report must be a .json file.",
    );
  if (CANONICAL_FILENAMES.has(outputName))
    throw new CalciteBridgeError(
      "OUTPUT_FILENAME_FORBIDDEN",
      "canonical field-lineage and causal-slice filenames are forbidden.",
    );
  if (!isWithin(independentRoot, resolvedOutput))
    throw new CalciteBridgeError(
      "OUTPUT_PATH_NOT_ALLOWED",
      "the report path must be inside staging/calcite-differential or the explicitly supplied independent directory.",
      { details: { independentRoot, resolvedOutput } },
    );
  const existingParent = nearestExistingDirectory(dirname(resolvedOutput));
  if (existingParent !== undefined) {
    const realParent = realpathSync(existingParent);
    assertSafePathText(realParent);
  }
  return resolvedOutput;
}

function assertSafePathText(path: string): void {
  const normalized = path.replace(/[\\/]+/g, "/").toLowerCase();
  if (/(^|\/)artifacts\/tasks(?:\/|$)/.test(normalized))
    throw new CalciteBridgeError(
      "OUTPUT_PATH_FORBIDDEN",
      "canonical artifacts/tasks output is forbidden for the differential runner.",
    );
}

function nearestExistingDirectory(path: string): string | undefined {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
  return current;
}

function isWithin(root: string, candidate: string): boolean {
  const comparisonRoot =
    root.endsWith("\\") || root.endsWith("/")
      ? root
      : `${root}${process.platform === "win32" ? "\\" : "/"}`;
  const normalizedRoot =
    process.platform === "win32"
      ? comparisonRoot.toLowerCase()
      : comparisonRoot;
  const normalizedCandidate =
    process.platform === "win32" ? candidate.toLowerCase() : candidate;
  return (
    normalizedCandidate.startsWith(normalizedRoot) &&
    normalizedCandidate !== root
  );
}

function runnerConfig(
  options: DifferentialRunnerOptions,
): DifferentialRunReport["runner"] {
  return {
    javaExecutable: options.javaExecutable ?? DEFAULT_CALCITE_JAVA_EXECUTABLE,
    classpath: options.classpath,
    mainClass: options.mainClass ?? DEFAULT_CALCITE_MAIN_CLASS,
    timeoutMs: options.timeoutMs ?? DEFAULT_CALCITE_TIMEOUT_MS,
  };
}

function increment(
  counts: Map<string, number>,
  key: string,
): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortedCounts<T extends string>(
  counts: Map<T, number>,
): Readonly<Record<T, number>> {
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  ) as Readonly<Record<T, number>>;
}

function observationIdContentConflicts(
  responses: readonly DifferentialResponse[],
): readonly { readonly observationId: string; readonly occurrences: number }[] {
  const contents = new Map<string, Set<string>>();
  const occurrences = new Map<string, number>();
  for (const response of responses) {
    for (const observation of response.observations) {
      occurrences.set(
        observation.observationId,
        (occurrences.get(observation.observationId) ?? 0) + 1,
      );
      const values = contents.get(observation.observationId) ?? new Set<string>();
      values.add(stableSerialize(observation));
      contents.set(observation.observationId, values);
    }
  }
  return [...contents.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([observationId]) => ({
      observationId,
      occurrences: occurrences.get(observationId) ?? 0,
    }))
    .sort((left, right) => left.observationId.localeCompare(right.observationId));
}

export function summarizeDifferentialResponses(
  responses: readonly DifferentialResponse[],
): DifferentialRunSummary {
  const responseStatusCounts = new Map<DifferentialResponseStatus, number>();
  const observationKindCounts = new Map<DifferentialMetadataKind, number>();
  const observationStatusCounts = new Map<DifferentialObservationStatus, number>();
  const issueCodeCounts = new Map<string, number>();
  const projectionCoverage = {
    RAW_SQL_V1: { requestCount: 0, successCount: 0, unsupportedCount: 0, failedCount: 0 },
    PLAN_FACTS_REL_V1: { requestCount: 0, successCount: 0, unsupportedCount: 0, failedCount: 0 },
  };
  let evaluatedObservationCount = 0;
  let exactlyMappedObservationCount = 0;
  let observationOccurrenceCount = 0;
  const observationIds = new Set<string>();
  for (const response of responses) {
    increment(responseStatusCounts, response.status);
    const coverage = projectionCoverage[response.requestKind];
    coverage.requestCount += 1;
    if (response.status === "SUCCESS") coverage.successCount += 1;
    if (response.status === "UNSUPPORTED") coverage.unsupportedCount += 1;
    if (response.status === "FAILED") coverage.failedCount += 1;
    for (const issue of response.issues) increment(issueCodeCounts, issue.code);
    for (const observation of response.observations) {
      observationOccurrenceCount += 1;
      observationIds.add(observation.observationId);
      increment(observationKindCounts, observation.kind);
      increment(observationStatusCounts, observation.status);
      if (observation.status !== "EVALUATED") continue;
      evaluatedObservationCount += 1;
      if (observation.mappingRefs.length === 1 && observation.evidenceRefs.length > 0)
        exactlyMappedObservationCount += 1;
    }
  }
  const conflicts = observationIdContentConflicts(responses);
  if (conflicts.length > 0)
    increment(issueCodeCounts, "OBSERVATION_ID_CONTENT_CONFLICT");
  return {
    responseStatusCounts: sortedCounts(responseStatusCounts),
    observationKindCounts: sortedCounts(observationKindCounts),
    observationStatusCounts: sortedCounts(observationStatusCounts),
    issueCodeCounts: sortedCounts(issueCodeCounts),
    projectionCoverage,
    mapping: {
      evaluatedObservationCount,
      exactlyMappedObservationCount,
      unmappableObservationCount: evaluatedObservationCount - exactlyMappedObservationCount,
      exactMappingRate: evaluatedObservationCount === 0
        ? null
        : exactlyMappedObservationCount / evaluatedObservationCount,
    },
    observationOccurrenceCount,
    uniqueObservationCount: observationIds.size,
    duplicateObservationCount: observationOccurrenceCount - observationIds.size,
    observationIdContentConflictCount: conflicts.length,
    fingerprints: {
      protocolVersions: [...new Set(responses.map((response) => response.fingerprint.protocolVersion))].sort((left, right) => left - right),
      calciteVersions: [...new Set(responses.map((response) => response.fingerprint.calciteVersion))].sort(),
      buildFingerprints: [...new Set(responses.map((response) => response.fingerprint.buildFingerprint))].sort(),
    },
  };
}

function makeReport(
  result: Awaited<ReturnType<typeof runCalciteBridge>>,
  options: DifferentialRunnerOptions,
): DifferentialRunReport {
  const unsupportedCount = result.responses.filter(
    (response) => response.status === "UNSUPPORTED",
  ).length;
  const failedResponseCount = result.responses.filter(
    (response) => response.status === "FAILED",
  ).length;
  const issues = result.responses.flatMap((response) =>
    response.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
    })),
  );
  const observationConflicts = observationIdContentConflicts(result.responses);
  issues.push(
    ...observationConflicts.map((conflict) => ({
      code: "OBSERVATION_ID_CONTENT_CONFLICT",
      message: `Observation ${conflict.observationId} was emitted ${conflict.occurrences} times with conflicting content; no duplicate was selected.`,
    })),
  );
  return {
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    status: failedResponseCount > 0 ? "FAILED" : "SUCCESS",
    requestCount: result.requestCount,
    responseCount: result.responseCount,
    unsupportedCount,
    failedResponseCount,
    summary: summarizeDifferentialResponses(result.responses),
    responses: result.responses,
    issues,
    runner: runnerConfig(options),
    safety: {
      reportKind: "INDEPENDENT_DIFFERENTIAL_REPORT",
      canonicalArtifactsWritten: false,
      causalDecisionsWritten: false,
    },
  };
}

function failureReport(
  error: unknown,
  options: DifferentialRunnerOptions,
): DifferentialRunReport {
  const code =
    error instanceof CalciteBridgeError
      ? error.code
      : "DIFFERENTIAL_RUN_FAILED";
  const message = error instanceof Error ? error.message : String(error);
  return {
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    status: "FAILED",
    requestCount: 0,
    responseCount: 0,
    unsupportedCount: 0,
    failedResponseCount: 0,
    summary: summarizeDifferentialResponses([]),
    responses: [],
    issues: [{ code, message }],
    runner: runnerConfig(options),
    safety: {
      reportKind: "INDEPENDENT_DIFFERENTIAL_REPORT",
      canonicalArtifactsWritten: false,
      causalDecisionsWritten: false,
    },
  };
}

/** Execute the explicit runner without writing any artifact. */
export async function runDifferential(
  options: DifferentialRunnerOptions,
): Promise<DifferentialRunReport> {
  if (options.input !== undefined && options.inputPath !== undefined)
    throw new CalciteBridgeError(
      "RUNNER_INPUT_AMBIGUOUS",
      "provide either input or inputPath, not both.",
    );
  const input =
    options.input ??
    (options.inputPath === undefined || options.inputPath === "-"
      ? process.stdin
      : createReadStream(resolve(options.inputPath)));
  const result = await runCalciteBridge(
    parseDifferentialRequestLines(input),
    options,
  );
  return makeReport(result, options);
}

/** Atomically write one report under an already-approved independent root. */
export function writeIndependentReport(
  report: DifferentialRunReport,
  outputPath?: string,
  independentOutputDir?: string,
): string {
  const destination = resolveIndependentReportPath(
    outputPath,
    independentOutputDir,
  );
  const directory = dirname(destination);
  mkdirSync(directory, { recursive: true });
  const temporary = join(
    directory,
    `.${basename(destination)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    renameSync(temporary, destination);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch {
      // The temporary file may not have been created or may already be renamed.
    }
    throw new CalciteBridgeError(
      "REPORT_WRITE_FAILED",
      "failed to atomically write the independent differential report.",
      { cause: error, details: { destination } },
    );
  }
  return destination;
}

/** Execute the explicit runner and always leave a fail-closed report on error. */
export async function runAndWriteDifferentialReport(
  options: DifferentialRunnerOptions,
): Promise<DifferentialRunReport> {
  const destination = resolveIndependentReportPath(
    options.outputPath,
    options.independentOutputDir,
  );
  try {
    const report = await runDifferential(options);
    writeIndependentReport(report, destination, options.independentOutputDir);
    return report;
  } catch (error) {
    const report = failureReport(error, options);
    writeIndependentReport(report, destination, options.independentOutputDir);
    throw error;
  }
}

interface CliOptions {
  readonly inputPath?: string;
  readonly outputPath?: string;
  readonly independentOutputDir?: string;
  readonly javaExecutable: string;
  readonly classpath: string;
  readonly mainClass: string;
  readonly timeoutMs: number;
}

function requiredCliValue(
  args: readonly string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`${flag} requires a value`);
  return value;
}

export function parseDifferentialCliArgs(args: readonly string[]): CliOptions {
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let independentOutputDir: string | undefined;
  let javaExecutable =
    process.env.CALCITE_DIFFERENTIAL_JAVA ?? DEFAULT_CALCITE_JAVA_EXECUTABLE;
  let classpath =
    process.env.CALCITE_DIFFERENTIAL_CLASSPATH ??
    resolve("tools", "calcite-rel-bridge", "target", "classes");
  let mainClass = DEFAULT_CALCITE_MAIN_CLASS;
  let timeoutMs = DEFAULT_CALCITE_TIMEOUT_MS;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    switch (flag) {
      case "--input":
        inputPath = requiredCliValue(args, index++, flag);
        break;
      case "--output":
        outputPath = requiredCliValue(args, index++, flag);
        break;
      case "--independent-output-dir":
        independentOutputDir = requiredCliValue(args, index++, flag);
        break;
      case "--java":
        javaExecutable = requiredCliValue(args, index++, flag);
        break;
      case "--classpath":
        classpath = requiredCliValue(args, index++, flag);
        break;
      case "--main-class":
        mainClass = requiredCliValue(args, index++, flag);
        break;
      case "--timeout-ms": {
        const raw = requiredCliValue(args, index++, flag);
        timeoutMs = Number(raw);
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
          throw new Error("--timeout-ms must be a positive safe integer");
        break;
      }
      case "--help":
        throw new Error(
          "usage: run-differential.ts [--input FILE|-] [--output REPORT.json] [--independent-output-dir DIR] --classpath CLASSPATH [--java JAVA] [--main-class CLASS] [--timeout-ms N]",
        );
      default:
        throw new Error(`unknown option: ${flag}`);
    }
  }
  return {
    inputPath,
    outputPath,
    independentOutputDir,
    javaExecutable,
    classpath,
    mainClass,
    timeoutMs,
  };
}

async function main(): Promise<void> {
  const options = parseDifferentialCliArgs(process.argv.slice(2));
  const report = await runAndWriteDifferentialReport(options);
  process.stdout.write(
    `${JSON.stringify({
      status: report.status,
      requestCount: report.requestCount,
      responseCount: report.responseCount,
      outputPath: resolveIndependentReportPath(
        options.outputPath,
        options.independentOutputDir,
      ),
    })}\n`,
  );
  if (report.status === "FAILED") process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}

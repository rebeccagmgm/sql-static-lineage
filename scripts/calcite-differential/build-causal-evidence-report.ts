import {
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  parseDifferentialJson,
  stableSerialize,
  type DifferentialResponse,
  type PlanFactsRelRequest,
} from "./protocol.ts";
import type { DifferentialRunReport } from "./run-differential.ts";
import {
  buildCalciteCausalEvidence,
  type CalciteCausalEvidenceGap,
  type CalciteOperatorCausalEvidence,
} from "../reconcile/consumer/target-field-causal-slice/calcite-causal-evidence.ts";
import { resolveIndependentReportPath } from "./run-differential.ts";

export interface CalciteCausalEvidenceBundle {
  readonly reportVersion: 1;
  readonly reportKind: "INDEPENDENT_CALCITE_CAUSAL_EVIDENCE";
  readonly generatedAt: string;
  readonly taskIds: readonly string[];
  readonly statementIds: readonly string[];
  readonly source: {
    readonly requestsPath: string;
    readonly differentialReportPath: string;
    readonly differentialStatus: DifferentialRunReport["status"];
  };
  readonly summary: {
    readonly requestCount: number;
    readonly responseCount: number;
    readonly mappedObservationCount: number;
    readonly notEvaluatedObservationCount: number;
    readonly unmappableObservationCount: number;
    readonly uniqueEvidenceCount: number;
    readonly duplicateEvidenceCount: number;
    readonly evidenceIdContentConflictCount: number;
    readonly observationKindCounts: Readonly<Record<string, number>>;
    readonly mappedObservationKindCounts: Readonly<Record<string, number>>;
    readonly operatorCounts: Readonly<Record<string, number>>;
    readonly effectCounts: Readonly<Record<string, number>>;
    readonly gapReasonCounts: Readonly<Record<string, number>>;
  };
  readonly observations: readonly CalciteOperatorCausalEvidence[];
  readonly gaps: readonly CalciteCausalEvidenceGap[];
  readonly safety: {
    readonly canonicalArtifactsWritten: false;
    readonly causalDecisionsWritten: false;
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function sortedCounts(values: readonly string[]): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function parseRequests(path: string): readonly PlanFactsRelRequest[] {
  const requests: PlanFactsRelRequest[] = [];
  for (const [index, line] of readFileSync(resolve(path), "utf8")
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .entries()) {
    const parsed = parseDifferentialJson(line);
    if (!parsed.ok)
      throw new Error(`CAUSAL_EVIDENCE_REQUEST_INVALID:${index}:${parsed.issues.map((issue) => issue.code).join(",")}`);
    if (parsed.request.requestKind !== "PLAN_FACTS_REL_V1")
      throw new Error(`CAUSAL_EVIDENCE_REQUEST_KIND_UNSUPPORTED:${index}`);
    requests.push(parsed.request);
  }
  return requests;
}

function parseReport(path: string): DifferentialRunReport {
  const value: unknown = JSON.parse(readFileSync(resolve(path), "utf8"));
  const report = record(value);
  if (report.reportKind !== undefined && report.reportKind !== "INDEPENDENT_DIFFERENTIAL_REPORT")
    throw new Error("CAUSAL_EVIDENCE_DIFFERENTIAL_REPORT_KIND_INVALID");
  if (!Array.isArray(report.responses))
    throw new Error("CAUSAL_EVIDENCE_DIFFERENTIAL_RESPONSES_MISSING");
  return value as DifferentialRunReport;
}

function exactResponseFor(
  request: PlanFactsRelRequest,
  response: DifferentialResponse,
  index: number,
): DifferentialResponse {
  if (response.requestKind !== request.requestKind)
    throw new Error(`CAUSAL_EVIDENCE_REQUEST_KIND_MISMATCH:${index}`);
  if (response.fingerprint.inputFingerprint !== request.fingerprint)
    throw new Error(`CAUSAL_EVIDENCE_INPUT_FINGERPRINT_MISMATCH:${index}`);
  return response;
}

function mergeObservations(
  values: readonly CalciteOperatorCausalEvidence[],
): {
  readonly observations: readonly CalciteOperatorCausalEvidence[];
  readonly duplicateCount: number;
  readonly conflictCount: number;
  readonly conflictGaps: readonly CalciteCausalEvidenceGap[];
} {
  const byId = new Map<string, CalciteOperatorCausalEvidence>();
  const duplicateIds = new Set<string>();
  const conflicts = new Set<string>();
  for (const value of values) {
    const previous = byId.get(value.evidenceId);
    if (!previous) {
      byId.set(value.evidenceId, value);
      continue;
    }
    if (stableSerialize(previous) === stableSerialize(value)) {
      duplicateIds.add(value.evidenceId);
      continue;
    }
    conflicts.add(value.evidenceId);
  }
  const conflictGaps = [...conflicts].sort().map((evidenceId) => ({
    gapId: `calcite-causal-evidence-conflict:${evidenceId}`,
    reasonCode: "CALCITE_EVIDENCE_ID_CONTENT_CONFLICT",
    message: `Calcite causal evidence ${evidenceId} was emitted with conflicting content; no version was selected.`,
    proofRefs: [],
    blocksNegativeProof: true as const,
  }));
  return {
    observations: [...byId.values()].sort((left, right) =>
      left.evidenceId.localeCompare(right.evidenceId),
    ),
    duplicateCount: duplicateIds.size,
    conflictCount: conflicts.size,
    conflictGaps,
  };
}

export function buildCalciteCausalEvidenceBundle(input: {
  readonly requestsPath: string;
  readonly differentialReportPath: string;
  readonly now?: () => string;
}): CalciteCausalEvidenceBundle {
  const requests = parseRequests(input.requestsPath);
  const differential = parseReport(input.differentialReportPath);
  if (requests.length !== differential.responses.length)
    throw new Error(`CAUSAL_EVIDENCE_REQUEST_RESPONSE_COUNT_MISMATCH:${requests.length}:${differential.responses.length}`);
  const evidence: CalciteOperatorCausalEvidence[] = [];
  const gaps: CalciteCausalEvidenceGap[] = [];
  const taskIds = new Set<string>();
  const statementIds = new Set<string>();
  for (const [index, request] of requests.entries()) {
    taskIds.add(request.taskId);
    statementIds.add(request.statementId);
    const response = exactResponseFor(request, differential.responses[index]!, index);
    const report = buildCalciteCausalEvidence({ request, response });
    evidence.push(...report.observations);
    gaps.push(...report.gaps);
  }
  const merged = mergeObservations(evidence);
  const allGaps = [...gaps, ...merged.conflictGaps].sort((left, right) =>
    left.gapId.localeCompare(right.gapId),
  );
  return {
    reportVersion: 1,
    reportKind: "INDEPENDENT_CALCITE_CAUSAL_EVIDENCE",
    generatedAt: (input.now ?? (() => new Date().toISOString()))(),
    taskIds: [...taskIds].sort(),
    statementIds: [...statementIds].sort(),
    source: {
      requestsPath: resolve(input.requestsPath),
      differentialReportPath: resolve(input.differentialReportPath),
      differentialStatus: differential.status,
    },
    summary: {
      requestCount: requests.length,
      responseCount: differential.responses.length,
      mappedObservationCount: merged.observations.filter((item) => item.status === "MAPPED").length,
      notEvaluatedObservationCount: merged.observations.filter((item) => item.status === "NOT_EVALUATED").length,
      unmappableObservationCount: merged.observations.filter((item) => item.status === "UNMAPPABLE").length,
      uniqueEvidenceCount: merged.observations.length,
      duplicateEvidenceCount: merged.duplicateCount,
      evidenceIdContentConflictCount: merged.conflictCount,
      observationKindCounts: sortedCounts(
        merged.observations.map((item) => item.observationKind),
      ),
      mappedObservationKindCounts: sortedCounts(
        merged.observations
          .filter((item) => item.status === "MAPPED")
          .map((item) => item.observationKind),
      ),
      operatorCounts: sortedCounts(
        merged.observations
          .map((item) => item.operatorKind)
          .filter((value): value is string => value !== undefined),
      ),
      effectCounts: sortedCounts(
        merged.observations
          .map((item) => item.effectKind)
          .filter((value): value is string => value !== undefined),
      ),
      gapReasonCounts: sortedCounts(allGaps.map((item) => item.reasonCode)),
    },
    observations: merged.observations,
    gaps: allGaps,
    safety: {
      canonicalArtifactsWritten: false,
      causalDecisionsWritten: false,
    },
  };
}

function writeBundle(
  bundle: CalciteCausalEvidenceBundle,
  outputPath: string,
): void {
  const destination = resolve(outputPath);
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = resolve(
    dirname(destination),
    `.${basename(destination)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(temporary, `${JSON.stringify(bundle, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    renameSync(temporary, destination);
  } catch (error) {
    try { unlinkSync(temporary); } catch { /* best effort cleanup */ }
    throw error;
  }
}

function cliValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let requestsPath: string | undefined;
  let differentialReportPath: string | undefined;
  let outputPath: string | undefined;
  let independentOutputDir: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    switch (args[index]) {
      case "--requests": requestsPath = cliValue(args, index++, "--requests"); break;
      case "--differential-report": differentialReportPath = cliValue(args, index++, "--differential-report"); break;
      case "--output": outputPath = cliValue(args, index++, "--output"); break;
      case "--independent-output-dir": independentOutputDir = cliValue(args, index++, "--independent-output-dir"); break;
      case "--help": throw new Error("usage: build-causal-evidence-report.ts --requests FILE --differential-report FILE [--output FILE] [--independent-output-dir DIR]");
      default: throw new Error(`unknown option: ${args[index]}`);
    }
  }
  if (!requestsPath || !differentialReportPath)
    throw new Error("--requests and --differential-report are required");
  const destination = resolveIndependentReportPath(
    outputPath ?? "calcite-causal-evidence.json",
    independentOutputDir,
  );
  const bundle = buildCalciteCausalEvidenceBundle({ requestsPath, differentialReportPath });
  writeBundle(bundle, destination);
  process.stdout.write(`${JSON.stringify({
    status: "SUCCESS",
    outputPath: destination,
    summary: bundle.summary,
  })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)))
  void main();

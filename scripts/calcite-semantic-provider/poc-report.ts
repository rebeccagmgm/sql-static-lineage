import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../machine-facts/machine-facts-contract.ts";
import { resolvePocOutputPath } from "./output-guard.ts";
import { parseProviderResponse } from "./protocol.ts";

export type PocDecision =
  | "DIRECT_PROVIDER"
  | "THIN_ADAPTER_REQUIRED"
  | "VALIDATION_ONLY"
  | "NO_GO";

interface CorpusReport {
  readonly requestCount: number;
  readonly responseCount: number;
  readonly unsupportedCount: number;
  readonly errorCount: number;
  readonly samplesWithMissingExpectedKinds: number;
  readonly semanticEdgeVerifiedCount: number;
  readonly semanticEdgePartialCount: number;
  readonly elapsedMs: number;
  readonly peakWorkingSetBytes: number;
}

interface RuntimeMetrics {
  readonly elapsedMs: number;
  readonly peakWorkingSetBytes: number;
  readonly requestBytes: number;
  readonly responseBytes: number;
}

interface EvidenceAssemblyMetrics {
  readonly leafEvidence: {
    readonly tableScanCount: number;
    readonly sourceAnchoredTableScanCount: number;
    readonly exactNativeReadCount: number;
    readonly fullSpanExactReadCount: number;
    readonly identifierAnchorExactReadCount: number;
    readonly ambiguousNativeReadCount: number;
    readonly unmappableNativeReadCount: number;
  };
  readonly dependencyEndpointMapping: Readonly<Record<string, number>>;
  readonly dependencyMappingSingleSourceSpanCount: number;
  readonly dependencyMappingMultiSourceEvidenceCount: number;
  readonly operatorSourceSpanExactCount: number;
  readonly operatorCount: number;
  readonly fullEvidenceClosureCount: number;
  readonly fullEvidenceClosureStatus: string;
}

export interface CalciteSemanticProviderPocReport {
  readonly reportVersion: 1;
  readonly decision: PocDecision;
  readonly safety: {
    readonly canonicalArtifactsWritten: false;
    readonly nativeSemanticFallback: false;
    readonly productionIntegrationPerformed: false;
  };
  readonly corpus: CorpusReport;
  readonly realStatement: {
    readonly status: string;
    readonly statementStatus?: string;
    readonly relationCount: number;
    readonly dependencyCount: number;
    readonly evaluatedDependencyCount: number;
    readonly exactMappingCount: number;
    readonly notAttemptedCount: number;
    readonly notAssembledCount: number;
    readonly ambiguousCount: number;
    readonly unmappableCount: number;
    readonly issueCodes: readonly string[];
    readonly elapsedMs: number;
    readonly peakWorkingSetBytes: number;
    readonly requestBytes: number;
    readonly responseBytes: number;
    readonly boundedDialectTransformCount: number;
    readonly leafTableScanCount: number;
    readonly exactLeafOccurrenceCount: number;
    readonly fullSpanExactLeafCount: number;
    readonly identifierAnchorExactLeafCount: number;
    readonly operatorSourceSpanExactCount: number;
    readonly dependencyMappingSingleSourceSpanCount: number;
    readonly dependencyMappingMultiSourceEvidenceCount: number;
    readonly fullEvidenceClosureCount: number;
    readonly fullEvidenceClosureStatus: string;
  };
  readonly gates: {
    readonly gateA: {
      readonly name: "DIRECT_EXTRACTION";
      readonly status: "PASS" | "FAIL";
    };
    readonly gateB: {
      readonly name: "SEMANTIC_EDGE_CORRECTNESS";
      readonly status: "PASS" | "PARTIAL" | "FAIL";
      readonly verifiedSamples: number;
      readonly totalSamples: number;
    };
    readonly gateC: {
      readonly name: "NATIVE_EVIDENCE_ASSEMBLY";
      readonly status: "PASS" | "PARTIAL" | "NOT_ASSEMBLED" | "FAIL";
    };
    readonly gateD: {
      readonly name: "PRODUCTION_CAUSAL_INTEGRATION";
      readonly status: "NOT_STARTED";
    };
    readonly boundedRuntime: boolean;
  };
  readonly conclusion: string;
  readonly evidence: readonly { readonly path: string; readonly sha256: string }[];
}

export function decideProvider(input: {
  readonly corpusPassed: boolean;
  readonly realStatus: string;
  readonly dependencyCount: number;
  readonly evaluatedDependencyCount: number;
  readonly exactMappingCount: number;
  readonly boundedDialectTransformCount: number;
  readonly fullEvidenceClosureStatus: string;
}): PocDecision {
  if (input.corpusPassed && input.realStatus === "SUCCESS" && input.dependencyCount > 0) {
    if (input.evaluatedDependencyCount > 0 &&
        input.exactMappingCount === input.evaluatedDependencyCount &&
        input.fullEvidenceClosureStatus === "EXACT") {
      return input.boundedDialectTransformCount > 0
        ? "THIN_ADAPTER_REQUIRED"
        : "DIRECT_PROVIDER";
    }
    return "VALIDATION_ONLY";
  }
  if (input.corpusPassed && input.realStatus === "UNSUPPORTED") return "VALIDATION_ONLY";
  return "NO_GO";
}

export function buildPocReport(paths: {
  readonly corpusReportPath: string;
  readonly realResponsePath: string;
  readonly realMetricsPath: string;
  readonly realInputManifestPath: string;
  readonly assembledResponsePath: string;
  readonly assemblyMetricsPath: string;
}): CalciteSemanticProviderPocReport {
  const corpus = JSON.parse(readFileSync(paths.corpusReportPath, "utf8")) as CorpusReport;
  const response = parseProviderResponse(JSON.parse(readFileSync(paths.realResponsePath, "utf8")));
  const assembledResponse = parseProviderResponse(
    JSON.parse(readFileSync(paths.assembledResponsePath, "utf8")),
  );
  const metrics = JSON.parse(readFileSync(paths.realMetricsPath, "utf8")) as RuntimeMetrics;
  const assemblyMetrics = JSON.parse(
    readFileSync(paths.assemblyMetricsPath, "utf8"),
  ) as EvidenceAssemblyMetrics;
  const inputManifest = JSON.parse(readFileSync(paths.realInputManifestPath, "utf8")) as {
    readonly dialectTransform: { readonly transforms: readonly unknown[] };
  };
  const boundedDialectTransformCount = inputManifest.dialectTransform.transforms.length;
  const facts = assembledResponse.facts;
  const evaluated = facts?.dependencies.filter((item) => item.evaluationStatus === "EVALUATED") ?? [];
  const exactMappings = new Set(facts?.evidenceMappings
    .filter((item) => item.mappingStatus === "EXACT")
    .map((item) => item.mappingId) ?? []);
  const exactDependencyCount = evaluated.filter((item) =>
    item.evidenceMappingRefs.length > 0 &&
    item.evidenceMappingRefs.every((mappingId) => exactMappings.has(mappingId))).length;
  const corpusPassed = corpus.requestCount === corpus.responseCount &&
    corpus.errorCount === 0 && corpus.unsupportedCount === 0 &&
    corpus.samplesWithMissingExpectedKinds === 0 &&
    corpus.semanticEdgeVerifiedCount === corpus.requestCount &&
    corpus.semanticEdgePartialCount === 0;
  const mappingCounts = {
    notAttempted: facts?.evidenceMappings.filter((item) => item.mappingStatus === "NOT_ATTEMPTED").length ?? 0,
    notAssembled: facts?.evidenceMappings.filter((item) => item.mappingStatus === "NOT_ASSEMBLED").length ?? 0,
    ambiguous: facts?.evidenceMappings.filter((item) => item.mappingStatus === "AMBIGUOUS").length ?? 0,
    unmappable: facts?.evidenceMappings.filter((item) => item.mappingStatus === "UNMAPPABLE").length ?? 0,
  };
  const evidenceMappingStatus = evaluated.length > 0 &&
      exactDependencyCount === evaluated.length &&
      assemblyMetrics.fullEvidenceClosureStatus === "EXACT"
    ? "PASS" as const
    : evaluated.length > 0 && exactDependencyCount === evaluated.length
      ? "PARTIAL" as const
    : mappingCounts.notAssembled + mappingCounts.notAttempted === (facts?.evidenceMappings.length ?? 0)
      ? "NOT_ASSEMBLED" as const
      : exactDependencyCount > 0
        ? "PARTIAL" as const
        : "FAIL" as const;
  const decision = decideProvider({
    corpusPassed,
    realStatus: response.status,
    dependencyCount: facts?.dependencies.length ?? 0,
    evaluatedDependencyCount: evaluated.length,
    exactMappingCount: exactDependencyCount,
    boundedDialectTransformCount,
    fullEvidenceClosureStatus: assemblyMetrics.fullEvidenceClosureStatus,
  });
  const evidencePaths = [paths.corpusReportPath, paths.realInputManifestPath,
    paths.realResponsePath, paths.assembledResponsePath, paths.realMetricsPath,
    paths.assemblyMetricsPath];
  return {
    reportVersion: 1,
    decision,
    safety: {
      canonicalArtifactsWritten: false,
      nativeSemanticFallback: false,
      productionIntegrationPerformed: false,
    },
    corpus,
    realStatement: {
      status: response.status,
      ...(facts ? { statementStatus: facts.statementStatus } : {}),
      relationCount: facts?.relations.length ?? 0,
      dependencyCount: facts?.dependencies.length ?? 0,
      evaluatedDependencyCount: evaluated.length,
      exactMappingCount: exactDependencyCount,
      notAttemptedCount: mappingCounts.notAttempted,
      notAssembledCount: mappingCounts.notAssembled,
      ambiguousCount: mappingCounts.ambiguous,
      unmappableCount: mappingCounts.unmappable,
      issueCodes: [...new Set(facts?.issues.map((item) => item.code) ?? [])].sort(),
      elapsedMs: metrics.elapsedMs,
      peakWorkingSetBytes: metrics.peakWorkingSetBytes,
      requestBytes: metrics.requestBytes,
      responseBytes: metrics.responseBytes,
      boundedDialectTransformCount,
      leafTableScanCount: assemblyMetrics.leafEvidence.tableScanCount,
      exactLeafOccurrenceCount: assemblyMetrics.leafEvidence.exactNativeReadCount,
      fullSpanExactLeafCount: assemblyMetrics.leafEvidence.fullSpanExactReadCount,
      identifierAnchorExactLeafCount: assemblyMetrics.leafEvidence.identifierAnchorExactReadCount,
      operatorSourceSpanExactCount: assemblyMetrics.operatorSourceSpanExactCount,
      dependencyMappingSingleSourceSpanCount:
        assemblyMetrics.dependencyMappingSingleSourceSpanCount,
      dependencyMappingMultiSourceEvidenceCount:
        assemblyMetrics.dependencyMappingMultiSourceEvidenceCount,
      fullEvidenceClosureCount: assemblyMetrics.fullEvidenceClosureCount,
      fullEvidenceClosureStatus: assemblyMetrics.fullEvidenceClosureStatus,
    },
    gates: {
      gateA: {
        name: "DIRECT_EXTRACTION",
        status: response.status === "SUCCESS" && (facts?.dependencies.length ?? 0) > 0
          ? "PASS"
          : "FAIL",
      },
      gateB: {
        name: "SEMANTIC_EDGE_CORRECTNESS",
        status: corpusPassed
          ? "PASS"
          : corpus.semanticEdgeVerifiedCount > 0
            ? "PARTIAL"
            : "FAIL",
        verifiedSamples: corpus.semanticEdgeVerifiedCount,
        totalSamples: corpus.requestCount,
      },
      gateC: {
        name: "NATIVE_EVIDENCE_ASSEMBLY",
        status: evidenceMappingStatus,
      },
      gateD: {
        name: "PRODUCTION_CAUSAL_INTEGRATION",
        status: "NOT_STARTED",
      },
      boundedRuntime: corpus.elapsedMs <= 30_000 && metrics.elapsedMs <= 5_000 &&
        corpus.peakWorkingSetBytes <= 1_073_741_824 && metrics.peakWorkingSetBytes <= 1_073_741_824,
    },
    conclusion: decision === "VALIDATION_ONLY" && response.status === "SUCCESS"
      ? `Calcite passed direct extraction and full semantic-edge verification for ${corpus.semanticEdgeVerifiedCount}/${corpus.requestCount} representative samples. The real SQL mapped ${assemblyMetrics.leafEvidence.exactNativeReadCount}/${assemblyMetrics.leafEvidence.tableScanCount} physical read occurrences and ${exactDependencyCount}/${evaluated.length} dependency endpoints exactly, but operator source spans and full evidence closure remain ${assemblyMetrics.fullEvidenceClosureStatus}; the POC therefore remains validation-only.`
      : `POC decision: ${decision}.`,
    evidence: evidencePaths.map((path) => ({ path, sha256: sha256(readFileSync(path)) })),
  };
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing ${name}`);
  return resolve(value);
}

function main(): void {
  const report = buildPocReport({
    corpusReportPath: argument("--corpus"),
    realResponsePath: argument("--real-response"),
    realMetricsPath: argument("--real-metrics"),
    realInputManifestPath: argument("--real-input-manifest"),
    assembledResponsePath: argument("--assembled-response"),
    assemblyMetricsPath: argument("--assembly-metrics"),
  });
  const destination = resolvePocOutputPath(argument("--output"));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, canonicalJson(report), "utf8");
  process.stdout.write(canonicalJson(report));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}

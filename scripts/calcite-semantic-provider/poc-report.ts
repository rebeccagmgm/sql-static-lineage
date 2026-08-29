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
  readonly elapsedMs: number;
  readonly peakWorkingSetBytes: number;
}

interface RuntimeMetrics {
  readonly elapsedMs: number;
  readonly peakWorkingSetBytes: number;
  readonly requestBytes: number;
  readonly responseBytes: number;
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
    readonly unmappableCount: number;
    readonly issueCodes: readonly string[];
    readonly elapsedMs: number;
    readonly peakWorkingSetBytes: number;
    readonly requestBytes: number;
    readonly responseBytes: number;
    readonly boundedDialectTransformCount: number;
  };
  readonly gates: {
    readonly directRawSqlSemanticExtraction: boolean;
    readonly representativeCorpus: boolean;
    readonly boundedRuntime: boolean;
    readonly exactNativeEvidenceMapping: boolean;
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
}): PocDecision {
  if (input.corpusPassed && input.realStatus === "SUCCESS" && input.dependencyCount > 0) {
    if (input.evaluatedDependencyCount > 0 &&
        input.exactMappingCount === input.evaluatedDependencyCount) {
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
}): CalciteSemanticProviderPocReport {
  const corpus = JSON.parse(readFileSync(paths.corpusReportPath, "utf8")) as CorpusReport;
  const response = parseProviderResponse(JSON.parse(readFileSync(paths.realResponsePath, "utf8")));
  const metrics = JSON.parse(readFileSync(paths.realMetricsPath, "utf8")) as RuntimeMetrics;
  const inputManifest = JSON.parse(readFileSync(paths.realInputManifestPath, "utf8")) as {
    readonly dialectTransform: { readonly transforms: readonly unknown[] };
  };
  const boundedDialectTransformCount = inputManifest.dialectTransform.transforms.length;
  const facts = response.facts;
  const evaluated = facts?.dependencies.filter((item) => item.evaluationStatus === "EVALUATED") ?? [];
  const exactMappings = new Set(facts?.evidenceMappings
    .filter((item) => item.mappingStatus === "EXACT")
    .map((item) => item.mappingId) ?? []);
  const exactDependencyCount = evaluated.filter((item) =>
    item.evidenceMappingRefs.length > 0 &&
    item.evidenceMappingRefs.every((mappingId) => exactMappings.has(mappingId))).length;
  const corpusPassed = corpus.requestCount === corpus.responseCount &&
    corpus.errorCount === 0 && corpus.unsupportedCount === 0 &&
    corpus.samplesWithMissingExpectedKinds === 0;
  const decision = decideProvider({
    corpusPassed,
    realStatus: response.status,
    dependencyCount: facts?.dependencies.length ?? 0,
    evaluatedDependencyCount: evaluated.length,
    exactMappingCount: exactDependencyCount,
    boundedDialectTransformCount,
  });
  const evidencePaths = [paths.corpusReportPath, paths.realInputManifestPath,
    paths.realResponsePath, paths.realMetricsPath];
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
      unmappableCount: facts?.evidenceMappings.filter((item) => item.mappingStatus === "UNMAPPABLE").length ?? 0,
      issueCodes: [...new Set(facts?.issues.map((item) => item.code) ?? [])].sort(),
      elapsedMs: metrics.elapsedMs,
      peakWorkingSetBytes: metrics.peakWorkingSetBytes,
      requestBytes: metrics.requestBytes,
      responseBytes: metrics.responseBytes,
      boundedDialectTransformCount,
    },
    gates: {
      directRawSqlSemanticExtraction: response.status === "SUCCESS" && (facts?.dependencies.length ?? 0) > 0,
      representativeCorpus: corpusPassed,
      boundedRuntime: corpus.elapsedMs <= 30_000 && metrics.elapsedMs <= 5_000 &&
        corpus.peakWorkingSetBytes <= 1_073_741_824 && metrics.peakWorkingSetBytes <= 1_073_741_824,
      exactNativeEvidenceMapping: evaluated.length > 0 && exactDependencyCount === evaluated.length,
    },
    conclusion: decision === "VALIDATION_ONLY" && response.status === "SUCCESS"
      ? "Calcite successfully extracts bounded relational semantics from the real SQL, but evaluated dependencies are not exactly mapped to Native occurrence/span evidence; it is validation-only until a same-front-end source map closes that proof obligation."
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
  });
  const destination = resolvePocOutputPath(argument("--output"));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${canonicalJson(report)}\n`, "utf8");
  process.stdout.write(`${canonicalJson(report)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}

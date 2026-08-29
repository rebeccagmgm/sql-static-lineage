import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../machine-facts/machine-facts-contract.ts";
import { assembleNativeEvidence } from "./evidence-adapter.ts";
import { loadNativeLeafEvidence } from "./native-evidence-loader.ts";
import { resolvePocOutputPath } from "./output-guard.ts";
import { parseProviderResponse } from "./protocol.ts";

export function assembleRealEvidence(input: {
  readonly responsePath: string;
  readonly manifestPath: string;
}): {
  readonly response: ReturnType<typeof parseProviderResponse>;
  readonly metrics: Record<string, unknown>;
} {
  const response = parseProviderResponse(JSON.parse(readFileSync(input.responsePath, "utf8")));
  if (!response.facts) throw new Error("real provider response has no candidate facts");
  const loaded = loadNativeLeafEvidence(response.facts, input.manifestPath);
  const endpointAssembledFacts = assembleNativeEvidence(response.facts, loaded.statement);
  const operatorSpanIssue = {
    issueId: "issue:assembler:operator-source-span-not-assembled",
    code: "NATIVE_OPERATOR_SOURCE_SPAN_NOT_ASSEMBLED",
    message: "Dependency endpoints map to Native leaf evidence, but operator source spans are not assembled.",
    severity: "INFO" as const,
    subjectRefs: [endpointAssembledFacts.input.sqlSourceId],
  };
  const facts = Object.freeze({
    ...endpointAssembledFacts,
    statementStatus: "PARTIAL" as const,
    issues: [...endpointAssembledFacts.issues, operatorSpanIssue]
      .sort((left, right) => left.issueId.localeCompare(right.issueId)),
  });
  const statusCounts = Object.fromEntries(
    ["NOT_ATTEMPTED", "NOT_ASSEMBLED", "EXACT", "AMBIGUOUS", "UNMAPPABLE"]
      .map((status) => [status, facts.evidenceMappings.filter((item) => item.mappingStatus === status).length]),
  );
  return {
    response: parseProviderResponse({ ...response, facts }),
    metrics: {
      reportVersion: 1,
      safety: {
        reportKind: "CALCITE_SEMANTIC_PROVIDER_EVIDENCE_ASSEMBLY_POC",
        canonicalArtifactsWritten: false,
        nativeSemanticFallback: false,
      },
      leafEvidence: loaded.metrics,
      leafIssues: loaded.issues,
      dependencyEndpointMapping: statusCounts,
      dependencyMappingSingleSourceSpanCount: facts.evidenceMappings
        .filter((item) => item.sourceSpan !== undefined).length,
      dependencyMappingMultiSourceEvidenceCount: facts.evidenceMappings
        .filter((item) => item.mappingStatus === "EXACT" && item.sourceSpan === undefined).length,
      operatorSourceSpanExactCount: 0,
      operatorCount: facts.operators.length,
      fullEvidenceClosureCount: 0,
      fullEvidenceClosureStatus: "NOT_ASSEMBLED",
    },
  };
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing ${name}`);
  return resolve(value);
}

function main(): void {
  const output = resolvePocOutputPath(argument("--output"));
  const metricsOutput = resolvePocOutputPath(argument("--metrics-output"));
  const result = assembleRealEvidence({
    responsePath: argument("--response"),
    manifestPath: argument("--manifest"),
  });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, canonicalJson(result.response), "utf8");
  writeFileSync(metricsOutput, canonicalJson(result.metrics), "utf8");
  process.stdout.write(canonicalJson(result.metrics));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(); }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

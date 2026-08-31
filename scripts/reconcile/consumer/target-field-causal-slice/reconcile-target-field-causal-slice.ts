import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import { canonicalJson } from "../../../machine-facts/machine-facts-contract.ts";
import {
  reconcileTargetFieldCausalSlice,
  type TargetFieldCausalSliceOptions,
} from "./reconcile-causal-slice.ts";
import { formatCausalSlice } from "./format-causal-slice.ts";
import { publishTargetFieldCausalSlice } from "./publish-causal-slice.ts";
import { buildCalciteSemanticShadowReport } from "./calcite-shadow-report.ts";
import type { CalciteSemanticMappingReport } from "./calcite-semantic-mapping.ts";

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function integerOption(args: readonly string[], name: string): number | undefined {
  const value = option(args, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new Error(`${name} must be a non-negative integer`);
  return parsed;
}

function isWithin(path: string, parent: string): boolean {
  const child = resolve(path);
  const root = resolve(parent);
  const rel = relative(root, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function parseTargetFieldCausalSliceCli(
  args: readonly string[],
): TargetFieldCausalSliceOptions {
  const dataRoot = option(args, "--data-root");
  const factsRoot = option(args, "--facts-root");
  const producerIndex = option(args, "--producer-index");
  const tableMultiHop = option(args, "--table-multi-hop") ?? option(args, "--multi-hop-artifact");
  const taskId = option(args, "--task-id");
  const targetTable = option(args, "--target-table");
  const output = option(args, "--output");
  const outputDir = option(args, "--output-dir");
  const summaryOutput = option(args, "--summary-output");
  if (!dataRoot || !factsRoot || !producerIndex || !tableMultiHop || !taskId || !targetTable || (!output && !outputDir))
    throw new Error("usage: reconcile-target-field-causal-slice --data-root <path> --facts-root <path> --producer-index <json> --table-multi-hop <json> --task-id <id> --target-table <qualified> --write-observation-id <id[,id...]> [--fields <a,b>] (--output <json> | --output-dir <task-artifact-dir>) [--summary-output <txt>] [--max-depth N] [--max-value-states N] [--max-value-paths N] [--max-control-states N] [--max-control-paths N]");
  const writeObservationIds = (option(args, "--write-observation-ids") ?? option(args, "--write-observation-id"))
    ?.split(",").map((value) => value.trim()).filter(Boolean);
  if (!writeObservationIds || writeObservationIds.length === 0)
    throw new Error("--write-observation-id is required for exact root identity");
  const fields = option(args, "--fields")?.split(",").map((value) => value.trim()).filter(Boolean);
  const semanticOracle = option(args, "--semantic-oracle");
  if (semanticOracle !== undefined && semanticOracle !== "calcite")
    throw new Error("--semantic-oracle must be calcite when provided");
  const calciteMappingReport = option(args, "--calcite-mapping-report");
  const calciteCausalEvidence = option(args, "--calcite-causal-evidence");
  const semanticOracleOutput = option(args, "--semantic-oracle-output");
  if (calciteCausalEvidence !== undefined)
    throw new Error("--calcite-causal-evidence is independent-only; inspect the sidecar report separately");
  if (semanticOracle === "calcite" && (!calciteMappingReport || !semanticOracleOutput))
    throw new Error("--semantic-oracle calcite requires --calcite-mapping-report and --semantic-oracle-output");
  const writeTargets = [
    output && resolve(output),
    summaryOutput && resolve(summaryOutput),
    outputDir && resolve(join(outputDir, "target-field-causal-slice.json")),
    outputDir && resolve(join(outputDir, "target-field-causal-slice.txt")),
    outputDir && resolve(join(outputDir, "target-field-causal-slice.html")),
    semanticOracleOutput && resolve(semanticOracleOutput),
  ].filter((value): value is string => Boolean(value));
  if (new Set(writeTargets).size !== writeTargets.length)
    throw new Error("causal-slice output paths must not collide");
  const immutableInputFiles = [
    producerIndex,
    tableMultiHop,
    option(args, "--legacy-field-lineage"),
    calciteMappingReport,
  ].filter((value): value is string => Boolean(value)).map((value) => resolve(value));
  if (writeTargets.some((target) => immutableInputFiles.includes(target)))
    throw new Error("causal-slice output must not overwrite an input evidence file");
  const protectedInputRoots = [
    factsRoot,
    join(dataRoot, "tasks"),
    join(dataRoot, "tables"),
  ].map((value) => resolve(value));
  if (writeTargets.some((target) => protectedInputRoots.some((root) => isWithin(target, root))))
    throw new Error("causal-slice output must not be written inside immutable input evidence roots");
  return {
    dataRoot,
    factsRoot,
    producerIndex,
    tableMultiHop,
    taskId,
    targetTable,
    output,
    outputDir,
    writeObservationIds,
    fields,
    legacyFieldLineage: option(args, "--legacy-field-lineage"),
    summaryOutput,
    semanticOracle,
    calciteMappingReport,
    semanticOracleOutput,
    maxDepth: integerOption(args, "--max-depth"),
    maxValueStates: integerOption(args, "--max-value-states"),
    maxValuePaths: integerOption(args, "--max-value-paths"),
    maxControlStates: integerOption(args, "--max-control-states"),
    maxControlPaths: integerOption(args, "--max-control-paths"),
  };
}

export function runTargetFieldCausalSliceCli(
  options: TargetFieldCausalSliceOptions,
) {
  const writeTargets = [
    options.output && resolve(options.output),
    options.summaryOutput && resolve(options.summaryOutput),
    options.outputDir && resolve(join(options.outputDir, "target-field-causal-slice.json")),
    options.outputDir && resolve(join(options.outputDir, "target-field-causal-slice.txt")),
    options.outputDir && resolve(join(options.outputDir, "target-field-causal-slice.html")),
    options.semanticOracleOutput && resolve(options.semanticOracleOutput),
  ].filter((value): value is string => Boolean(value));
  const immutableInputs = [
    options.producerIndex,
    options.tableMultiHop,
    options.legacyFieldLineage,
    options.calciteMappingReport,
  ].filter((value): value is string => Boolean(value)).map((value) => resolve(value));
  if (
    new Set(writeTargets).size !== writeTargets.length ||
    writeTargets.some((target) => immutableInputs.includes(target)) ||
    writeTargets.some((target) => [
      resolve(options.factsRoot),
      resolve(join(options.dataRoot, "tasks")),
      resolve(join(options.dataRoot, "tables")),
    ].some((root) => isWithin(target, root)))
  ) throw new Error("CAUSAL_SLICE_OUTPUT_INPUT_COLLISION");
  const artifact = reconcileTargetFieldCausalSlice(options);
  let shadowOutput: { readonly path: string; readonly content: string } | null = null;
  if (
    options.semanticOracle === "calcite" &&
    options.calciteMappingReport &&
    options.semanticOracleOutput
  ) {
    const mappingReport = JSON.parse(
      readFileSync(resolve(options.calciteMappingReport), "utf8"),
    ) as CalciteSemanticMappingReport;
    if (
      !mappingReport.source ||
      mappingReport.source.inputFingerprint !== artifact.inputFingerprints.inputPack[0]!.fingerprint ||
      mappingReport.source.nativeFingerprint !== artifact.contentHash ||
      (mappingReport.source.rootTaskId !== undefined &&
        mappingReport.source.rootTaskId !== artifact.request.rootTaskId)
    ) throw new Error("CALCITE_MAPPING_REPORT_SOURCE_MISMATCH");
    const shadow = buildCalciteSemanticShadowReport({
      mappingReport,
      inputFingerprint: artifact.inputFingerprints.inputPack[0]!.fingerprint,
      nativeFingerprint: artifact.contentHash,
      artifactValidationSummary: {
        status: "VALID",
        artifactType: artifact.artifactType,
      },
      canonicalArtifact: artifact,
    });
    shadowOutput = {
      path: resolve(options.semanticOracleOutput),
      content: `${canonicalJson(shadow)}\n`,
    };
  }
  if (options.outputDir)
    publishTargetFieldCausalSlice({
      outputDir: options.outputDir,
      artifact,
      formatText: formatCausalSlice,
    });
  if (options.output) {
    const output = resolve(options.output);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${canonicalJson(artifact)}\n`, "utf8");
  }
  if (options.summaryOutput) {
    const summary = resolve(options.summaryOutput);
    mkdirSync(dirname(summary), { recursive: true });
    writeFileSync(summary, formatCausalSlice(artifact), "utf8");
  }
  if (shadowOutput) {
    mkdirSync(dirname(shadowOutput.path), { recursive: true });
    writeFileSync(shadowOutput.path, shadowOutput.content, "utf8");
  }
  return artifact;
}

if (process.argv[1] && basename(process.argv[1]).startsWith("reconcile-target-field-causal-slice")) {
  const artifact = runTargetFieldCausalSliceCli(parseTargetFieldCausalSliceCli(process.argv.slice(2)));
  const args = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify({ output: option(args, "--output") ? resolve(option(args, "--output")!) : null, outputDir: option(args, "--output-dir") ? resolve(option(args, "--output-dir")!) : null, artifactType: artifact.artifactType, assessmentCount: artifact.assessments.length }, null, 2)}\n`);
}

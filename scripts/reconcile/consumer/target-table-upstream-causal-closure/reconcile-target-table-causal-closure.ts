import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { loadPhysicalTableCatalog, type PhysicalTableCatalogEntry } from "../../../machine-facts/input-pack-machine-facts.ts";
import { canonicalJson, sha256 } from "../../../machine-facts/machine-facts-contract.ts";
import { canonicalBundleIdentity, createCurrentTaskBundleReader, type CurrentBundleLoad } from "../../../query/current-task-bundle.ts";
import { validateTableProducerIndex } from "../../producer/producer-index.ts";
import { validateMultiHopReconciliation } from "../multi-hop/reconcile-multi-hop.ts";
import { projectTargetTableCandidateUniverse, type CandidateBranch, type CandidateUniverse } from "./candidate-universe.ts";
import { canonicalizeTargetTableArtifact, TARGET_TABLE_CAUSAL_CLOSURE_ARTIFACT_TYPE, TARGET_TABLE_CAUSAL_CLOSURE_SCHEMA_VERSION, type CausalStageMetric, type TargetTableCausalClosureArtifact } from "./artifact-contract.ts";
import { buildCausalClosure } from "./causal-closure.ts";
import { buildImpactGraph } from "./impact-graph.ts";
import { formatTargetTableCausalSummary, renderTargetTableCausalHtml } from "./format-target-table-causal-closure.ts";
import { createFieldValueEvidenceProvider } from "./field-value-provider.ts";
import { validateCausalClosure } from "./proof-validator.ts";
import { relationSummaryKey, summarizeTaskRelations } from "./task-relation-summary.ts";
import { resolveTargetWrite, type AnalysisSnapshotRef } from "./target-write-contract.ts";

interface CliOptions {
  readonly dataRoot: string;
  readonly factsRoot: string;
  readonly producerIndex: string;
  readonly tableMultiHop: string;
  readonly fieldLineage: string | null;
  readonly taskId: string;
  readonly targetTable: string;
  readonly writeObservationIds: readonly string[];
  readonly output: string;
  readonly summaryOutput: string | null;
  readonly htmlOutput: string | null;
  readonly maxTimeMs: number;
  readonly maxMemoryBytes: number;
  readonly maxBranches: number;
  readonly maxDepth: number;
}

function readJson(path: string): unknown { return JSON.parse(readFileSync(path, "utf8")); }
function fileHash(path: string): string { return sha256(readFileSync(path)); }
function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function taskJson(dataRoot: string, taskId: string): Record<string, unknown> {
  const path = resolve(dataRoot, "tasks", "sparkIndex", taskId, "task.json");
  if (!existsSync(path)) return {};
  const value = readJson(path);
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function outputPath(path: string): void { mkdirSync(dirname(resolve(path)), { recursive: true }); }
function tableFromCatalog(entry: PhysicalTableCatalogEntry): { platform: string; dataSource: string; qualifiedName: string; stableTableId: string; identityStatus: string } {
  return { platform: entry.platform, dataSource: entry.dataSource, qualifiedName: entry.qualifiedName, stableTableId: entry.stableTableId, identityStatus: "SCHEMA_BACKED" };
}
function normalized(value: string): string { return value.trim().toLowerCase(); }
function records(value: unknown): readonly Record<string, unknown>[] { return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item)) : []; }
function resolveCatalogTable(catalog: ReturnType<typeof loadPhysicalTableCatalog>, requested: string, task: Record<string, unknown>): PhysicalTableCatalogEntry {
  const key = normalized(requested);
  const exact = catalog.byQualifiedName.get(key) ?? [];
  if (exact.length === 1) return exact[0]!;
  const target = typeof task.target === "object" && task.target !== null ? task.target as Record<string, unknown> : {};
  const platform = text(target.platform)?.toLowerCase();
  const dataSource = text(target.dataSource)?.toLowerCase();
  const qualifiedName = text(target.qualifiedName)?.toLowerCase();
  const constrained = catalog.entries.filter((entry) => normalized(entry.qualifiedName) === key && (!platform || entry.platform.toLowerCase() === platform) && (!dataSource || entry.dataSource.toLowerCase() === dataSource) && (!qualifiedName || normalized(entry.qualifiedName) === qualifiedName));
  if (constrained.length === 1) return constrained[0]!;
  const tail = key.split(".").at(-1) ?? key;
  const tailMatches = catalog.byNameTail.get(tail) ?? [];
  if (tailMatches.length === 1) return tailMatches[0]!;
  throw new Error(`TARGET_TABLE_PHYSICAL_IDENTITY_AMBIGUOUS:${requested}`);
}
function parseArgs(argv: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`ARGUMENT_VALUE_MISSING:${key}`);
    values.set(key.slice(2), value);
    index += 1;
  }
  const required = (key: string): string => { const value = values.get(key); if (!value) throw new Error(`ARGUMENT_MISSING:${key}`); return value; };
  const budget = (key: string, fallback: number): number => {
    const value = values.get(key);
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`ARGUMENT_INVALID:${key}`);
    return parsed;
  };
  return {
    dataRoot: required("data-root"), factsRoot: required("facts-root"), producerIndex: required("producer-index"), tableMultiHop: required("table-multi-hop"),
    fieldLineage: values.get("field-lineage") ?? null, taskId: required("task-id"), targetTable: required("target-table"),
    writeObservationIds: (values.get("write-observation-id") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    output: required("output"), summaryOutput: values.get("summary-output") ?? null, htmlOutput: values.get("html-output") ?? null,
    maxTimeMs: budget("max-time-ms", 300_000), maxMemoryBytes: budget("max-memory-bytes", 1_073_741_824), maxBranches: budget("max-branches", 10_000), maxDepth: budget("max-depth", 25),
  };
}

function enrichProducerWriteBridges(
  universe: CandidateUniverse,
  loadForTask: (taskId: string) => CurrentBundleLoad,
): { readonly universe: CandidateUniverse; readonly stats: { readonly resolved: number; readonly ambiguous: number; readonly missing: number } } {
  let resolved = 0;
  let ambiguous = 0;
  let missing = 0;
  const branches = universe.branches.map((branch): CandidateBranch => {
    if (branch.branchKind !== "PHYSICAL_PRODUCER" || !branch.producerTaskId || !branch.table?.qualifiedName) return branch;
    const load = loadForTask(branch.producerTaskId);
    const target = normalized(branch.table.qualifiedName);
    const writes = [...new Map(records(load.records["dataset-io.jsonl"])
      .filter((record) => normalized(String(record.direction ?? "")) === "write" && normalized(String(record.task_id ?? "")) === normalized(branch.producerTaskId!) && normalized(String(record.physical_dataset ?? "")) === target)
      .map((record) => [String(record.write_observation_id ?? ""), record] as const)
      .filter(([writeObservationId]) => writeObservationId.length > 0)).values()];
    if (writes.length === 1) {
      const writeObservationId = String(writes[0]!.write_observation_id);
      resolved += 1;
      return {
        ...branch,
        writeObservationId,
        evidenceRefs: [...branch.evidenceRefs, {
          evidenceRefId: `producer-write-evidence:${sha256(canonicalJson({ taskId: branch.producerTaskId, writeObservationId, table: branch.table }))}`,
          source: "MACHINE_FACTS_DATASET_IO",
          locator: `machine-facts:${branch.producerTaskId}:dataset-io.jsonl#write-observation:${writeObservationId}`,
        }],
      };
    }
    if (writes.length > 1) {
      ambiguous += 1;
      return { ...branch, gapRefs: [...new Set([...branch.gapRefs, `bridge-gap:${branch.candidateBranchId}:PRODUCER_WRITE_AMBIGUOUS`])] };
    }
    missing += 1;
    return { ...branch, gapRefs: [...new Set([...branch.gapRefs, `bridge-gap:${branch.candidateBranchId}:PRODUCER_WRITE_OBSERVATION_MISSING`])] };
  });
  return { universe: { ...universe, branches }, stats: { resolved, ambiguous, missing } };
}

export function runTargetTableCausalClosure(options: CliOptions): TargetTableCausalClosureArtifact {
  const runStart = performance.now();
  const stages: CausalStageMetric[] = [];
  let peakMemoryBytes = process.memoryUsage().rss;
  const stage = (name: string, start: number, calls: number, cacheHits: number, cacheMisses: number, nodes: number, edges: number): void => {
    peakMemoryBytes = Math.max(peakMemoryBytes, process.memoryUsage().rss);
    stages.push({ stage: name, elapsedMs: Math.round(performance.now() - start), calls, cacheHits, cacheMisses, nodes, edges, peakMemoryBytes });
  };
  const assertBudget = (stageName: string, branches = 0, depth = 0): void => {
    const elapsedMs = performance.now() - runStart;
    const memoryBytes = process.memoryUsage().rss;
    if (elapsedMs > options.maxTimeMs) throw new Error(`CAUSAL_BUDGET_EXCEEDED:${stageName}:TIME_MS=${Math.round(elapsedMs)}:MAX=${options.maxTimeMs}`);
    if (memoryBytes > options.maxMemoryBytes) throw new Error(`CAUSAL_BUDGET_EXCEEDED:${stageName}:MEMORY_BYTES=${memoryBytes}:MAX=${options.maxMemoryBytes}`);
    if (branches > options.maxBranches) throw new Error(`CAUSAL_BUDGET_EXCEEDED:${stageName}:BRANCHES=${branches}:MAX=${options.maxBranches}`);
    if (depth > options.maxDepth) throw new Error(`CAUSAL_BUDGET_EXCEEDED:${stageName}:DEPTH=${depth}:MAX=${options.maxDepth}`);
  };
  const loadStart = performance.now();
  const producerIndex = readJson(options.producerIndex);
  validateTableProducerIndex(producerIndex);
  const tableArtifact = readJson(options.tableMultiHop);
  validateMultiHopReconciliation(tableArtifact);
  const catalog = loadPhysicalTableCatalog(options.dataRoot, { lazyDdl: true });
  const targetEntry = resolveCatalogTable(catalog, options.targetTable, taskJson(options.dataRoot, options.taskId));
  const targetTable = tableFromCatalog(targetEntry);
  const rootReader = createCurrentTaskBundleReader(options.factsRoot, { requestedFiles: ["statements.jsonl", "relation-nodes.jsonl", "relation-edges.jsonl", "output-field-bindings.jsonl", "dataset-io.jsonl"], validateOutputHashes: "requested" });
  const rootLoad = rootReader.load(options.taskId);
  stage("load", loadStart, 1, 0, 1, 0, 0);
  const snapshot: AnalysisSnapshotRef = {
    inputPackFingerprint: text(rootLoad.manifest?.input_fingerprint) ?? text(rootLoad.manifest?.inputFingerprint) ?? canonicalBundleIdentity(rootLoad),
    machineFactsHash: rootLoad.manifestSha256 ?? sha256(canonicalJson(rootLoad.records)),
    producerIndexHash: fileHash(options.producerIndex),
    tableMultiHopHash: fileHash(options.tableMultiHop),
    ...(options.fieldLineage && existsSync(options.fieldLineage) ? { fieldLineageHash: fileHash(options.fieldLineage) } : {}),
    semanticRuleVersion: "target-table-causal-closure-native-v1",
  };
  const targetResolution = resolveTargetWrite({ taskId: options.taskId, targetTable: targetEntry.qualifiedName, writeObservationIds: options.writeObservationIds, load: rootLoad, snapshot });
  if (!targetResolution.ref) throw new Error(`TARGET_WRITE_UNRESOLVED:${targetResolution.gaps.map((gap) => gap.reasonCode).join(",")}`);
  assertBudget("target-write");
  const projectionStart = performance.now();
  let universe = projectTargetTableCandidateUniverse({ targetWrite: targetResolution.ref, tableArtifact, targetTable, resolvePhysicalTable: (table) => {
    if (table.stableTableId) {
      const match = catalog.entries.find((entry) => entry.stableTableId === table.stableTableId);
      if (match) return tableFromCatalog(match);
    }
    const matches = table.qualifiedName ? catalog.byQualifiedName.get(normalized(table.qualifiedName)) ?? [] : [];
    return matches.length === 1 ? tableFromCatalog(matches[0]!) : table;
  } });
  const taskLoads = new Map<string, ReturnType<typeof rootReader.load>>([[options.taskId, rootLoad]]);
  const loadForTask = (taskId: string): ReturnType<typeof rootReader.load> => {
    const cached = taskLoads.get(taskId);
    if (cached) return cached;
    const loaded = rootReader.load(taskId);
    taskLoads.set(taskId, loaded);
    return loaded;
  };
  const enriched = enrichProducerWriteBridges(universe, loadForTask);
  universe = enriched.universe;
  stage("candidate-projection", projectionStart, 1, 0, 1, universe.branches.length, universe.branches.length);
  assertBudget("candidate-projection", universe.branches.length, Math.max(0, ...universe.branches.map((branch) => branch.readOccurrence?.relationPath.length ?? 0)));
  const summaries = new Map<string, ReturnType<typeof summarizeTaskRelations>>();
  const summaryStart = performance.now();
  const scopes = universe.branches
    .filter((branch): branch is CandidateBranch & { readonly consumerTaskId: string; readonly readOccurrence: NonNullable<CandidateBranch["readOccurrence"]> } => branch.consumerTaskId !== null && branch.readOccurrence !== null)
    .map((branch) => ({ taskId: branch.consumerTaskId, statementIndex: branch.readOccurrence.statementIndex }));
  let summaryCacheHits = 0;
  for (const scope of scopes) {
    const key = relationSummaryKey(scope.taskId, scope.statementIndex);
    if (summaries.has(key)) { summaryCacheHits += 1; continue; }
    const load = loadForTask(scope.taskId);
    summaries.set(key, summarizeTaskRelations({ taskId: scope.taskId, statementIndex: scope.statementIndex, relationRecords: load.records["relation-nodes.jsonl"] ?? [], relationEdgeRecords: load.records["relation-edges.jsonl"] ?? [], statementRecords: load.records["statements.jsonl"] ?? [] }));
  }
  stage("semantic-summary", summaryStart, scopes.length, summaryCacheHits, scopes.length - summaryCacheHits, summaries.size, [...summaries.values()].reduce((sum, value) => sum + value.edgeCount, 0));
  assertBudget("semantic-summary", universe.branches.length);
  const providerStart = performance.now();
  const fieldProvider = createFieldValueEvidenceProvider(options.fieldLineage);
  stage("field-value-index", providerStart, 1, 0, 1, 0, fieldProvider.edgeCount);
  assertBudget("field-value-index", universe.branches.length);
  const graphStart = performance.now();
  const graph = buildImpactGraph(universe.branches, summaries);
  stage("impact-graph", graphStart, 1, 0, 1, graph.taskIds.length, graph.localEdges.length + graph.bridgeEdges.length);
  assertBudget("impact-graph", universe.branches.length);
  const propagationStart = performance.now();
  const closure = buildCausalClosure({ targetWriteId: targetResolution.ref!.identity.targetWriteId, rootTaskId: options.taskId, universe, summaries, fieldValueProvider: fieldProvider, baseGraph: graph });
  const assessments = closure.assessments;
  stage("propagation", propagationStart, 1, 0, 1, closure.graph.reachableTaskIds.length, closure.graph.branchEdges.length);
  assertBudget("propagation", universe.branches.length);
  const validationStart = performance.now();
  const validation = validateCausalClosure({ targetWriteId: targetResolution.ref.identity.targetWriteId, universe, assessments });
  if (!validation.valid) throw new Error(`CAUSAL_CLOSURE_INVALID:${validation.errors.join(",")}`);
  stage("validation", validationStart, 1, 0, 1, assessments.length, 0);
  assertBudget("validation", universe.branches.length);
  const confirmed = assessments.filter((assessment) => assessment.relationStatus === "CONFIRMED_RELATED");
  const closureRate = confirmed.length === 0 ? "NOT_APPLICABLE" : confirmed.every((assessment) => assessment.candidateBranchId.startsWith("target-table-root-write:") || assessment.channelAssessments.some((channel) => channel.status === "CONFIRMED" && channel.witnessRefs.length > 0)) ? 1 : 0;
  const gapCandidates = [
    ...targetResolution.gaps.map((gap) => ({ gapId: gap.gapId, reasonCode: gap.reasonCode, message: gap.message, evidenceRefs: gap.evidenceRefs })),
    ...universe.boundaryGapRefs.map((gapId) => ({ gapId, reasonCode: "CANDIDATE_UNIVERSE_BOUNDARY", message: `candidate universe boundary: ${gapId}`, evidenceRefs: [] as string[] })),
    ...[...summaries.values()].flatMap((summary) => summary.gaps.map((gapId) => ({ gapId, reasonCode: "TASK_RELATION_SUMMARY_UNKNOWN", message: `relation summary incomplete: ${gapId}`, evidenceRefs: [] as string[] }))),
    ...closure.gaps,
    ...assessments.flatMap((assessment) => assessment.gapRefs.map((gapId) => ({ gapId, reasonCode: "CAUSAL_EVIDENCE_INCOMPLETE", message: `causal evidence incomplete: ${gapId}`, evidenceRefs: assessment.evidenceRefs }))),
  ];
  const gaps = [...new Map(gapCandidates.map((gap) => [gap.gapId, gap])).values()].sort((a, b) => a.gapId.localeCompare(b.gapId));
  const bridgeStats = {
    resolved: enriched.stats.resolved,
    ambiguous: enriched.stats.ambiguous,
    missing: enriched.stats.missing + universe.branches.filter((branch) => branch.branchKind === "UNBOUND_READ" || branch.branchKind === "BLOCKED_READ" || branch.branchKind === "COVERAGE_BOUNDARY").length,
  };
  peakMemoryBytes = Math.max(peakMemoryBytes, process.memoryUsage().rss);
  const raw: Omit<TargetTableCausalClosureArtifact, "contentHash"> = {
    schemaVersion: TARGET_TABLE_CAUSAL_CLOSURE_SCHEMA_VERSION, artifactType: TARGET_TABLE_CAUSAL_CLOSURE_ARTIFACT_TYPE, generatedAt: new Date().toISOString(), targetWrite: targetResolution.ref,
    candidateUniverse: universe, assessments, taskRollup: closure.taskRollup, minimumCertainTaskIds: closure.minimumCertainTaskIds, conservativeSafetyTaskIds: closure.conservativeSafetyTaskIds,
    runtimeRerunDecision: "NOT_EVALUATED", relationSummaries: [...summaries.values()].map((summary) => ({ taskId: summary.taskId, statementIndex: summary.statementIndex, rootRelationId: summary.rootRelationId, digest: summary.digest, complete: summary.complete, gapCount: summary.gaps.length })),
    metrics: { candidateBranchCount: universe.branches.length, assessmentCount: assessments.length, upstreamTaskCount: closure.taskRollup.length, fieldValueEvidenceScanCount: fieldProvider.scanCount, evidenceClosureRate: closureRate, decisionCoverage: { numerator: assessments.length, denominator: universe.branches.length, rate: universe.branches.length === 0 ? 1 : assessments.length / universe.branches.length }, bridgeStats, peakMemoryBytes },
    stages, gaps,
  };
  return canonicalizeTargetTableArtifact(raw);
}

export function main(argv = process.argv.slice(2)): void {
  const options = parseArgs(argv);
  const artifact = runTargetTableCausalClosure(options);
  outputPath(options.output);
  writeFileSync(options.output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  const summary = formatTargetTableCausalSummary(artifact);
  if (options.summaryOutput) { outputPath(options.summaryOutput); writeFileSync(options.summaryOutput, `${summary}\n`, "utf8"); }
  if (options.htmlOutput) { outputPath(options.htmlOutput); writeFileSync(options.htmlOutput, renderTargetTableCausalHtml(artifact), "utf8"); }
  console.log(summary);
}

if (process.argv[1] && basename(process.argv[1]).startsWith("reconcile-target-table-causal-closure")) main();

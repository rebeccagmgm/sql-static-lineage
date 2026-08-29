import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { projectTargetTableCandidateUniverse } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/candidate-universe.ts";
import { canonicalAssessment } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/artifact-contract.ts";
import { buildCausalClosure, composePath, mergeAlternative } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/causal-closure.ts";
import { createFieldValueEvidenceProvider } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/field-value-provider.ts";
import { buildImpactGraph } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/impact-graph.ts";
import { assessBranch, rollupAssessments } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/static-assessment.ts";
import { validateCausalClosure } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/proof-validator.ts";
import { relationSummaryKey, summarizeTaskRelations, type TaskRelationSummary } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/task-relation-summary.ts";
import { resolveTargetWrite } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/target-write-contract.ts";
import type { CandidateBranch } from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";

const table: NonNullable<CandidateBranch["table"]> = { platform: "hive", dataSource: "gfhive", qualifiedName: "db.source", stableTableId: "db.source__gfhive", identityStatus: "SCHEMA_BACKED" };
const occurrence = { occurrenceId: "task:c:statement:0:relation:read", readRelationId: "task:c:statement:0:relation:read", sqlSourceId: "task:c", statementIndex: 0, relationPath: ["root", "read"] } as const;

function branch(overrides: Partial<CandidateBranch> = {}): CandidateBranch {
  return { candidateBranchId: "branch:p", branchKind: "PHYSICAL_PRODUCER", rootTaskId: "root", consumerTaskId: "c", producerTaskId: "p", table, readOccurrence: occurrence, writeObservationId: null, producerRole: "PRIMARY", evidenceRefs: [], gapRefs: [], boundaryReason: null, ...overrides };
}

function readOccurrence(id: string, sqlSourceId: string, statementIndex = 0): NonNullable<CandidateBranch["readOccurrence"]> {
  return { occurrenceId: id, readRelationId: id, sqlSourceId, statementIndex, relationPath: ["root", id] };
}

function summary(taskId: string, sqlSourceId: string, readImpacts: TaskRelationSummary["readImpacts"], complete = true): TaskRelationSummary {
  return { taskId, sqlSourceId, statementIndex: 0, rootRelationId: null, digest: `${taskId}:${sqlSourceId}`, complete, readImpacts, relationCount: readImpacts.length, readCount: readImpacts.length, edgeCount: 0, gaps: [] };
}

function noFieldEvidenceProvider() {
  return { scanCount: 0, edgeCount: 0, lookup: (value: CandidateBranch) => ({ candidateBranchId: value.candidateBranchId, status: "NOT_APPLICABLE" as const, affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [] }) };
}

function completeUniverse(branches: readonly CandidateBranch[]) {
  return { rootTaskId: "root", status: "COMPLETE_OBSERVED_EVIDENCE" as const, branches, boundaryGapRefs: [], coverage: { sourceArtifactType: "test", sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE", sourceCoverageSemantics: null, sourceLimitsTruncated: false } };
}

describe("target table causal closure baseline", () => {
  it("binds one write observation to one root relation", () => {
    const load = { state: "CURRENT_L1", factsRoot: "facts", taskId: "root", bundleDir: "", indexPath: "", statusPath: "", records: { "output-field-bindings.jsonl": [{ task_id: "root", target_dataset: "db.target", binding_status: "RESOLVED", write_observation_id: "write:root:0", write_statement_id: "task:root:slot:query:statement:0", expression_id: "task:root:statement:0:relation:root.project:expression:project_expression:0", target_ordinal: 0, evidence_refs: [] }], "dataset-io.jsonl": [{ task_id: "root", direction: "WRITE", write_observation_id: "write:root:0", write_statement_id: "task:root:slot:query:statement:0", physical_dataset: "db.target" }] }, evidence: {}, issues: [] } as any;
    const result = resolveTargetWrite({ taskId: "root", targetTable: "db.target", writeObservationIds: ["write:root:0"], load, snapshot: { inputPackFingerprint: "i", machineFactsHash: "m", producerIndexHash: "p", tableMultiHopHash: "t", semanticRuleVersion: "v" } });
    expect(result.gaps).toHaveLength(0);
    expect(result.ref?.identity.rootRelationId).toBe("task:root:statement:0:relation:root.project");
  });

  it("uses dataset write observation order instead of target field ordinal", () => {
    const load = { state: "CURRENT_L1", factsRoot: "facts", taskId: "root", bundleDir: "", indexPath: "", statusPath: "", records: {
      "output-field-bindings.jsonl": [{ task_id: "root", target_dataset: "db.target", binding_status: "RESOLVED", write_observation_id: "write:root:1", write_statement_id: "task:root:slot:query:statement:1", expression_id: "task:root:statement:1:relation:root.project:expression:project_expression:0", target_ordinal: 0, evidence_refs: [] }],
      "dataset-io.jsonl": [
        { task_id: "root", direction: "WRITE", write_observation_id: "write:root:0", write_statement_id: "task:root:slot:query:statement:0", physical_dataset: "db.other" },
        { task_id: "root", direction: "WRITE", write_observation_id: "write:root:1", write_statement_id: "task:root:slot:query:statement:1", physical_dataset: "db.target" },
      ],
    }, evidence: {}, issues: [] } as any;
    const result = resolveTargetWrite({ taskId: "root", targetTable: "db.target", writeObservationIds: ["write:root:1"], load, snapshot: { inputPackFingerprint: "i", machineFactsHash: "m", producerIndexHash: "p", tableMultiHopHash: "t", semanticRuleVersion: "v" } });
    expect(result.gaps).toHaveLength(0);
    expect(result.ref?.identity.taskWriteOrdinal).toBe(1);
  });

  it("propagates filter and join semantics to read occurrences once", () => {
    const read = (id: string) => ({ task_id: "c", relation_id: `task:c:statement:0:relation:${id}`, relation_type: "read", relation: { id: `task:c:statement:0:relation:${id}`, type: "read" } });
    const rows = [read("a"), read("b"), { task_id: "c", relation_id: "task:c:statement:0:relation:join", relation_type: "join", relation: { id: "task:c:statement:0:relation:join", type: "join", join_type: "LEFT", condition_expr: "a.id = b.id" } }, { task_id: "c", relation_id: "task:c:statement:0:relation:filter", relation_type: "filter", relation: { id: "task:c:statement:0:relation:filter", type: "filter", predicate_expr: "b.status = 'A'" } }];
    const summary = summarizeTaskRelations({ taskId: "c", sqlSourceId: "task:c", relationRecords: rows, relationEdgeRecords: [{ from_relation_id: rows[0].relation_id, to_relation_id: "task:c:statement:0:relation:join" }, { from_relation_id: rows[1].relation_id, to_relation_id: "task:c:statement:0:relation:join" }, { from_relation_id: "task:c:statement:0:relation:join", to_relation_id: "task:c:statement:0:relation:filter" }] });
    expect(summary.complete).toBe(true);
    expect(summary.readImpacts).toHaveLength(2);
    expect(summary.readImpacts[0]?.impactChannels).toEqual(expect.arrayContaining(["ROW_MEMBERSHIP", "MULTIPLICITY", "RELATION_EXISTENCE"]));
  });

  it("keeps relation summaries isolated by statement", () => {
    const rows = [
      { task_id: "c", sql_source_id: "task:c:slot:a", statement_index: 0, relation_id: "task:c:slot:a:statement:0:relation:read", relation_type: "read", relation: { id: "task:c:slot:a:statement:0:relation:read", type: "read" } },
      { task_id: "c", sql_source_id: "task:c:slot:a", statement_index: 0, relation_id: "task:c:slot:a:statement:0:relation:filter", relation_type: "filter", relation: { id: "task:c:slot:a:statement:0:relation:filter", type: "filter", predicate_expr: "status = 'A'" } },
      { task_id: "c", sql_source_id: "task:c:slot:b", statement_index: 0, relation_id: "task:c:slot:b:statement:0:relation:read", relation_type: "read", relation: { id: "task:c:slot:b:statement:0:relation:read", type: "read" } },
      { task_id: "c", sql_source_id: "task:c:slot:b", statement_index: 0, relation_id: "task:c:slot:b:statement:0:relation:join", relation_type: "join", relation: { id: "task:c:slot:b:statement:0:relation:join", type: "join", join_type: "INNER" } },
    ];
    const edges = [
      { from_relation_id: rows[0]!.relation_id, to_relation_id: rows[1]!.relation_id },
      { from_relation_id: rows[2]!.relation_id, to_relation_id: rows[3]!.relation_id },
    ];
    const first = summarizeTaskRelations({ taskId: "c", sqlSourceId: "task:c:slot:a", statementIndex: 0, relationRecords: rows, relationEdgeRecords: edges });
    const second = summarizeTaskRelations({ taskId: "c", sqlSourceId: "task:c:slot:b", statementIndex: 0, relationRecords: rows, relationEdgeRecords: edges });
    expect(first.statementIndex).toBe(0);
    expect(second.statementIndex).toBe(0);
    expect(first.relationCount).toBe(2);
    expect(second.relationCount).toBe(2);
    expect(first.readImpacts[0]?.impactChannels).toContain("ROW_MEMBERSHIP");
    expect(second.readImpacts[0]?.impactChannels).toContain("MULTIPLICITY");
    expect(relationSummaryKey("c", "task:c:slot:a", 0)).not.toBe(relationSummaryKey("c", "task:c:slot:b", 0));
    const graph = buildImpactGraph([], new Map([
      [relationSummaryKey("c", "task:c:slot:a", 0), first],
      [relationSummaryKey("c", "task:c:slot:b", 0), second],
    ]));
    expect(graph.localEdges).toHaveLength(2);
    expect(graph.localEdges.map((edge) => edge.sqlSourceId)).toEqual(["task:c:slot:a", "task:c:slot:b"]);
  });

  it("models fieldless relation dependencies for count, exists, cross join and literals", () => {
    const read = (id: string) => ({ task_id: "c", relation_id: `task:c:statement:0:relation:${id}`, relation_type: "read", relation: { id: `task:c:statement:0:relation:${id}`, type: "read", table: `db.${id}` } });
    const rows = [read("a"), read("b"), { task_id: "c", relation_id: "task:c:statement:0:relation:cross", relation_type: "join", relation: { id: "task:c:statement:0:relation:cross", type: "join", join_type: "CROSS" } }, { task_id: "c", relation_id: "task:c:statement:0:relation:literal", relation_type: "project", relation: { id: "task:c:statement:0:relation:literal", type: "project", expression: "1 AS flag" } }, { task_id: "c", relation_id: "task:c:statement:0:relation:count", relation_type: "project", relation: { id: "task:c:statement:0:relation:count", relation_type: "project", type: "project", expression: "COUNT(*) AS cnt" } }, { task_id: "c", relation_id: "task:c:statement:0:relation:exists", relation_type: "project", relation: { id: "task:c:statement:0:relation:exists", type: "project", expression: "EXISTS (SELECT 1 FROM db.b) AS present" } }];
    const edges = [{ from_relation_id: rows[0].relation_id, to_relation_id: "task:c:statement:0:relation:cross" }, { from_relation_id: rows[1].relation_id, to_relation_id: "task:c:statement:0:relation:cross" }, { from_relation_id: "task:c:statement:0:relation:cross", to_relation_id: "task:c:statement:0:relation:literal" }, { from_relation_id: "task:c:statement:0:relation:cross", to_relation_id: "task:c:statement:0:relation:count" }, { from_relation_id: "task:c:statement:0:relation:cross", to_relation_id: "task:c:statement:0:relation:exists" }];
    const summary = summarizeTaskRelations({ taskId: "c", relationRecords: rows, relationEdgeRecords: edges });
    expect(summary.readImpacts.every((impact) => impact.impactChannels.includes("RELATION_EXISTENCE"))).toBe(true);
  });

  it("loads field evidence once and does not create a field matrix", () => {
    const dir = mkdtempSync(join(tmpdir(), "target-table-causal-"));
    const path = join(dir, "field-lineage.json");
    writeFileSync(path, JSON.stringify({ overallStatus: "COMPLETE", gaps: [], nodes: [{ nodeId: "p-node", taskId: "p", bindingId: "b-p", field: tableWithColumn(table, "amount") }, { nodeId: "c-node", taskId: "c", bindingId: "b-c", field: tableWithColumn({ ...table, qualifiedName: "db.target", stableTableId: "db.target__gfhive" }, "amount") }], edges: [{ kind: "VALUE_FLOW", evidenceStatus: "CONFIRMED", fromNodeId: "p-node", toNodeId: "c-node", consumerTaskId: "c", producerTaskId: "p", edgeId: "e1", mapping: "amount -> amount", evidenceRefs: ["field-lineage:consumer-read:c:task:c:statement:0:relation:read", "field-lineage:producer-write:p:write:p:0:binding:b-p"] }] }));
    const provider = createFieldValueEvidenceProvider(path);
    const result = provider.lookup(branch());
    expect(provider.scanCount).toBe(1);
    expect(result.status).toBe("CONFIRMED");
    expect(result.affectedTargetFields).toEqual(["amount"]);
  });

  it("does not mix same-table field evidence across read occurrences", () => {
    const dir = mkdtempSync(join(tmpdir(), "target-table-causal-occurrence-"));
    const path = join(dir, "field-lineage.json");
    writeFileSync(path, JSON.stringify({ overallStatus: "COMPLETE", gaps: [], nodes: [
      { nodeId: "p-a", taskId: "p", bindingId: "b-a", field: tableWithColumn(table, "amount_a") },
      { nodeId: "p-b", taskId: "p", bindingId: "b-b", field: tableWithColumn(table, "amount_b") },
      { nodeId: "c-a", taskId: "c", bindingId: "c-a", field: tableWithColumn({ ...table, qualifiedName: "db.target", stableTableId: "db.target__gfhive" }, "target_a") },
      { nodeId: "c-b", taskId: "c", bindingId: "c-b", field: tableWithColumn({ ...table, qualifiedName: "db.target", stableTableId: "db.target__gfhive" }, "target_b") },
    ], edges: [
      { kind: "VALUE_FLOW", evidenceStatus: "CONFIRMED", fromNodeId: "p-a", toNodeId: "c-a", consumerTaskId: "c", producerTaskId: "p", edgeId: "e-a", evidenceRefs: ["field-lineage:consumer-read:c:task:c:statement:0:relation:read-a:task:c:statement:0:relation:read-a"] },
      { kind: "VALUE_FLOW", evidenceStatus: "CONFIRMED", fromNodeId: "p-b", toNodeId: "c-b", consumerTaskId: "c", producerTaskId: "p", edgeId: "e-b", evidenceRefs: ["field-lineage:consumer-read:c:task:c:statement:0:relation:read-b"] },
    ] }));
    const provider = createFieldValueEvidenceProvider(path);
    const first = provider.lookup(branch({ readOccurrence: { ...occurrence, occurrenceId: "task:c:statement:0:relation:read-a", readRelationId: "task:c:statement:0:relation:read-a" } }));
    const second = provider.lookup(branch({ readOccurrence: { ...occurrence, occurrenceId: "task:c:statement:0:relation:read-b", readRelationId: "task:c:statement:0:relation:read-b" } }));
    const nearMatch = provider.lookup(branch({ readOccurrence: { ...occurrence, occurrenceId: "task:c:statement:0:relation:read-a-extra", readRelationId: "task:c:statement:0:relation:read-a-extra" } }));
    expect(first.affectedTargetFields).toEqual(["target_a"]);
    expect(second.affectedTargetFields).toEqual(["target_b"]);
    expect(nearMatch.status).toBe("UNKNOWN");
  });

  it("keeps relation status unknown for incomplete candidate evidence", () => {
    const candidate = branch({ gapRefs: ["boundary:read"], boundaryReason: "READ_EVIDENCE_BLOCKED" });
    const provider = { scanCount: 1, edgeCount: 0, lookup: (value: CandidateBranch) => ({ candidateBranchId: value.candidateBranchId, status: "PROVEN_ABSENT" as const, affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [] }) };
    const assessment = assessBranch({ targetWriteId: "write", branch: candidate, universeComplete: false, summary: { taskId: "c", sqlSourceId: "task:c", statementIndex: 0, rootRelationId: null, digest: "d", complete: true, readImpacts: [], relationCount: 0, readCount: 0, edgeCount: 0, gaps: [] }, fieldValueProvider: provider });
    expect(assessment.relationStatus).toBe("UNKNOWN");
    expect(validateCausalClosure({ targetWriteId: "write", universe: { rootTaskId: "root", status: "INCOMPLETE", branches: [candidate], boundaryGapRefs: ["boundary:read"], coverage: { sourceArtifactType: "x", sourceCoverageStatus: "PARTIAL", sourceCoverageSemantics: null, sourceLimitsTruncated: false } }, assessments: [assessment] }).valid).toBe(true);
  });

  it("does not promote a branch with a missing producer write to confirmed", () => {
    const candidate = branch({ gapRefs: ["bridge-gap:branch:p:PRODUCER_WRITE_OBSERVATION_MISSING"] });
    const provider = { scanCount: 1, edgeCount: 1, lookup: (value: CandidateBranch) => ({ candidateBranchId: value.candidateBranchId, status: "CONFIRMED" as const, affectedTargetFields: ["amount"], outputFieldBindingIds: [], evidenceRefs: ["field-evidence"], gapRefs: [] }) };
    const assessment = assessBranch({ targetWriteId: "write", branch: candidate, universeComplete: true, summary: { taskId: "c", sqlSourceId: "task:c", statementIndex: 0, rootRelationId: null, digest: "d", complete: true, readImpacts: [], relationCount: 0, readCount: 0, edgeCount: 0, gaps: [] }, fieldValueProvider: provider });
    expect(assessment.relationStatus).toBe("UNKNOWN");
    expect(assessment.gapRefs).toContain("bridge-gap:branch:p:PRODUCER_WRITE_OBSERVATION_MISSING");
  });

  it("uses the target-rooted closure and leaves disconnected branches unknown", () => {
    const reachable = branch({ consumerTaskId: "root", producerTaskId: "p", writeObservationId: "write:p:0", candidateBranchId: "branch:reachable" });
    const disconnected = branch({ consumerTaskId: "other", producerTaskId: "q", candidateBranchId: "branch:disconnected" });
    const root = branch({ branchKind: "ROOT_WRITE", candidateBranchId: "branch:root", consumerTaskId: null, producerTaskId: "root", readOccurrence: null, table: null });
    const summary = { taskId: "root", sqlSourceId: "task:c", statementIndex: 0, rootRelationId: null, digest: "d", complete: true, readImpacts: [{ readOccurrenceId: occurrence.readRelationId, impactChannels: ["ROW_MEMBERSHIP"] as const, evidenceRefs: ["relation-evidence"], gaps: [] }], relationCount: 1, readCount: 1, edgeCount: 0, gaps: [] };
    const provider = { scanCount: 1, edgeCount: 0, lookup: (value: CandidateBranch) => ({ candidateBranchId: value.candidateBranchId, status: "PROVEN_ABSENT" as const, affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [] }) };
    const result = buildCausalClosure({ targetWriteId: "write", rootTaskId: "root", universe: { rootTaskId: "root", status: "COMPLETE_OBSERVED_EVIDENCE", branches: [root, reachable, disconnected], boundaryGapRefs: [], coverage: { sourceArtifactType: "test", sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE", sourceCoverageSemantics: null, sourceLimitsTruncated: false } }, summaries: new Map([[relationSummaryKey("root", "task:c", 0), summary]]), fieldValueProvider: provider });
    expect(result.graph.reachableBranchIds).toEqual(["branch:reachable", "branch:root"]);
    expect(result.assessments.find((item) => item.candidateBranchId === "branch:reachable")?.relationStatus).toBe("CONFIRMED_RELATED");
    expect(result.assessments.find((item) => item.candidateBranchId === "branch:disconnected")?.relationStatus).toBe("UNKNOWN");
  });

  it("keeps a complete universe unknown without an explicit negative cut", () => {
    const candidate = branch({ candidateBranchId: "branch:absent", evidenceRefs: [{ evidenceRefId: "bridge-evidence", source: "TEST", locator: "test:bridge" }] });
    const provider = { scanCount: 1, edgeCount: 0, lookup: (value: CandidateBranch) => ({ candidateBranchId: value.candidateBranchId, status: "PROVEN_ABSENT" as const, affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [] }) };
    const assessment = assessBranch({ targetWriteId: "write", branch: candidate, universeComplete: true, summary: { taskId: "c", sqlSourceId: "task:c", statementIndex: 0, rootRelationId: null, digest: "d", complete: true, readImpacts: [], relationCount: 0, readCount: 0, edgeCount: 0, gaps: [] }, fieldValueProvider: provider });
    expect(assessment.relationStatus).toBe("UNKNOWN");
    expect(assessment.negativeProofs).toHaveLength(0);
    expect(validateCausalClosure({ targetWriteId: "write", universe: { rootTaskId: "root", status: "COMPLETE_OBSERVED_EVIDENCE", branches: [candidate], boundaryGapRefs: [], coverage: { sourceArtifactType: "x", sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE", sourceCoverageSemantics: null, sourceLimitsTruncated: false } }, assessments: [assessment] }).valid).toBe(true);
  });

  it("propagates unknown certainty through a multi-hop upstream branch", () => {
    const root = branch({ branchKind: "ROOT_WRITE", candidateBranchId: "branch:root", consumerTaskId: null, producerTaskId: "root", table: null, readOccurrence: null, writeObservationId: "write:root:0" });
    const b = branch({ candidateBranchId: "branch:b", consumerTaskId: "root", producerTaskId: "b", table: { ...table, qualifiedName: "db.b", stableTableId: "db.b__gfhive" }, readOccurrence: readOccurrence("root-read-b", "root-source"), writeObservationId: "write:b:0" });
    const a = branch({ candidateBranchId: "branch:a", consumerTaskId: "b", producerTaskId: "a", table: { ...table, qualifiedName: "db.a", stableTableId: "db.a__gfhive" }, readOccurrence: readOccurrence("b-read-a", "b-source"), writeObservationId: "write:a:0" });
    const result = buildCausalClosure({
      targetWriteId: "write",
      rootTaskId: "root",
      universe: completeUniverse([root, b, a]),
      summaries: new Map([
        [relationSummaryKey("root", "root-source", 0), summary("root", "root-source", [{ readOccurrenceId: "root-read-b", impactChannels: ["ROW_MEMBERSHIP"], evidenceRefs: ["b-target"], gaps: ["b-target-unknown"] }])],
        [relationSummaryKey("b", "b-source", 0), summary("b", "b-source", [{ readOccurrenceId: "b-read-a", impactChannels: ["ROW_MEMBERSHIP"], evidenceRefs: ["a-b"], gaps: [] }])],
      ]),
      fieldValueProvider: noFieldEvidenceProvider(),
    });
    expect(result.assessments.find((item) => item.candidateBranchId === "branch:b")?.relationStatus).toBe("UNKNOWN");
    expect(result.assessments.find((item) => item.candidateBranchId === "branch:a")?.relationStatus).toBe("UNKNOWN");
  });

  it("merges alternative paths by strongest certainty while retaining unknown gaps", () => {
    const root = branch({ branchKind: "ROOT_WRITE", candidateBranchId: "branch:root", consumerTaskId: null, producerTaskId: "root", table: null, readOccurrence: null, writeObservationId: "write:root:0" });
    const p1 = branch({ candidateBranchId: "branch:p1", consumerTaskId: "root", producerTaskId: "p", readOccurrence: readOccurrence("root-read-1", "root-source"), writeObservationId: "write:p:0" });
    const p2 = branch({ candidateBranchId: "branch:p2", consumerTaskId: "root", producerTaskId: "p", readOccurrence: readOccurrence("root-read-2", "root-source"), writeObservationId: "write:p:0" });
    const a = branch({ candidateBranchId: "branch:a", consumerTaskId: "p", producerTaskId: "a", readOccurrence: readOccurrence("p-read-a", "p-source"), writeObservationId: "write:a:0" });
    const result = buildCausalClosure({
      targetWriteId: "write",
      rootTaskId: "root",
      universe: completeUniverse([root, p1, p2, a]),
      summaries: new Map([
        [relationSummaryKey("root", "root-source", 0), summary("root", "root-source", [
          { readOccurrenceId: "root-read-1", impactChannels: ["ROW_MEMBERSHIP"], evidenceRefs: ["path-1"], gaps: [] },
          { readOccurrenceId: "root-read-2", impactChannels: ["ROW_MEMBERSHIP"], evidenceRefs: ["path-2"], gaps: ["path-2-unknown"] },
        ])],
        [relationSummaryKey("p", "p-source", 0), summary("p", "p-source", [{ readOccurrenceId: "p-read-a", impactChannels: ["ROW_MEMBERSHIP"], evidenceRefs: ["p-a"], gaps: [] }])],
      ]),
      fieldValueProvider: noFieldEvidenceProvider(),
    });
    const assessment = result.assessments.find((item) => item.candidateBranchId === "branch:a");
    expect(assessment?.relationStatus).toBe("CONFIRMED_RELATED");
    expect(assessment?.channelAssessments.find((item) => item.channel === "ROW_MEMBERSHIP")?.status).toBe("CONFIRMED");
    expect(assessment?.gapRefs).toContain("path-2-unknown");
  });

  it("composes path certainty conservatively and merges alternatives monotonically", () => {
    expect(composePath("CONFIRMED", "UNKNOWN")).toBe("UNKNOWN");
    expect(composePath("CONFIRMED", "CONDITIONAL")).toBe("CONDITIONAL");
    expect(mergeAlternative("CONFIRMED", "UNKNOWN")).toBe("CONFIRMED");
  });

  it("rolls multiple branches up without counting the root write", () => {
    const confirmed = canonicalAssessment({ targetWriteId: "write", candidateBranchId: "branch:p", relationStatus: "CONFIRMED_RELATED", channelAssessments: [], evidenceRefs: ["e"], gapRefs: [], negativeProofs: [] });
    const unknown = canonicalAssessment({ targetWriteId: "write", candidateBranchId: "branch:q", relationStatus: "UNKNOWN", channelAssessments: [{ channel: "ROW_MEMBERSHIP", status: "UNKNOWN", proofRefs: [], witnessRefs: [], gapRefs: ["g"] }], evidenceRefs: [], gapRefs: ["g"], negativeProofs: [] });
    const root = { ...confirmed, candidateBranchId: "branch:root" };
    const result = rollupAssessments({ branches: [branch(), branch({ candidateBranchId: "branch:q", producerTaskId: "q" }), branch({ candidateBranchId: "branch:root", branchKind: "ROOT_WRITE", producerTaskId: "root" })], assessments: [confirmed, unknown, root] });
    expect(result.taskRollup.map((value) => value.producerTaskId).sort()).toEqual(["p", "q"]);
    expect(result.minimumCertainTaskIds).toEqual(["p"]);
    expect([...result.conservativeSafetyTaskIds].sort()).toEqual(["p", "q"]);
  });

  it("projects one assessment per candidate branch rather than per field", () => {
    const targetWrite = { identity: { targetWriteId: "write", taskId: "root", targetTableKey: "db.target", sqlSourceId: "task:root:slot:query", statementOrdinal: 0, taskWriteOrdinal: 0, rootRelationId: "root", writeObservationId: "write:root:0", evidenceRefs: [] }, snapshot: { inputPackFingerprint: "i", machineFactsHash: "m", producerIndexHash: "p", tableMultiHopHash: "t", semanticRuleVersion: "v" } };
    const artifact = { artifactType: "TABLE_MULTI_HOP_RECONCILIATION", rootTaskId: "root", writeEdges: [{ producerTaskId: "root", table }], producerBridges: [{ consumerTaskId: "root", producerTaskId: "p", table, producerRole: "PRIMARY", readOccurrence: occurrence }], scheduleEdges: [], readEdges: [], terminals: [], coverage: { status: "COMPLETE_OBSERVED_EVIDENCE" }, limits: { truncated: false } };
    const universe = projectTargetTableCandidateUniverse({ targetWrite, tableArtifact: artifact, targetTable: { ...table, qualifiedName: "db.target", stableTableId: "db.target__gfhive" } });
    expect(universe.branches.length).toBe(2);
    expect(universe.branches.every((item) => item.candidateBranchId)).toBe(true);
  });
});

function tableWithColumn(value: typeof table, column: string): Record<string, unknown> {
  return { ...value, column };
}

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { projectTargetTableCandidateUniverse } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/candidate-universe.ts";
import { canonicalAssessment } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/artifact-contract.ts";
import { buildCausalClosure } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/causal-closure.ts";
import { createFieldValueEvidenceProvider } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/field-value-provider.ts";
import { assessBranch, rollupAssessments } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/static-assessment.ts";
import { validateCausalClosure } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/proof-validator.ts";
import { summarizeTaskRelations } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/task-relation-summary.ts";
import { resolveTargetWrite } from "../../scripts/reconcile/consumer/target-table-upstream-causal-closure/target-write-contract.ts";
import type { CandidateBranch } from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";

const table: NonNullable<CandidateBranch["table"]> = { platform: "hive", dataSource: "gfhive", qualifiedName: "db.source", stableTableId: "db.source__gfhive", identityStatus: "SCHEMA_BACKED" };
const occurrence = { occurrenceId: "task:c:statement:0:relation:read", readRelationId: "task:c:statement:0:relation:read", statementIndex: 0, relationPath: ["root", "read"] } as const;

function branch(overrides: Partial<CandidateBranch> = {}): CandidateBranch {
  return { candidateBranchId: "branch:p", branchKind: "PHYSICAL_PRODUCER", rootTaskId: "root", consumerTaskId: "c", producerTaskId: "p", table, readOccurrence: occurrence, writeObservationId: null, producerRole: "PRIMARY", evidenceRefs: [], gapRefs: [], boundaryReason: null, ...overrides };
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
    expect(result.ref?.identity.writeOrdinal).toBe(1);
  });

  it("propagates filter and join semantics to read occurrences once", () => {
    const read = (id: string) => ({ task_id: "c", relation_id: `task:c:statement:0:relation:${id}`, relation_type: "read", relation: { id: `task:c:statement:0:relation:${id}`, type: "read" } });
    const rows = [read("a"), read("b"), { task_id: "c", relation_id: "task:c:statement:0:relation:join", relation_type: "join", relation: { id: "task:c:statement:0:relation:join", type: "join", join_type: "LEFT", condition_expr: "a.id = b.id" } }, { task_id: "c", relation_id: "task:c:statement:0:relation:filter", relation_type: "filter", relation: { id: "task:c:statement:0:relation:filter", type: "filter", predicate_expr: "b.status = 'A'" } }];
    const summary = summarizeTaskRelations({ taskId: "c", relationRecords: rows, relationEdgeRecords: [{ from_relation_id: rows[0].relation_id, to_relation_id: "task:c:statement:0:relation:join" }, { from_relation_id: rows[1].relation_id, to_relation_id: "task:c:statement:0:relation:join" }, { from_relation_id: "task:c:statement:0:relation:join", to_relation_id: "task:c:statement:0:relation:filter" }] });
    expect(summary.complete).toBe(true);
    expect(summary.readImpacts).toHaveLength(2);
    expect(summary.readImpacts[0]?.impactChannels).toEqual(expect.arrayContaining(["ROW_MEMBERSHIP", "MULTIPLICITY", "RELATION_EXISTENCE"]));
  });

  it("keeps relation summaries isolated by statement", () => {
    const rows = [
      { task_id: "c", statement_index: 0, relation_id: "task:c:statement:0:relation:read", relation_type: "read", relation: { id: "task:c:statement:0:relation:read", type: "read" } },
      { task_id: "c", statement_index: 0, relation_id: "task:c:statement:0:relation:filter", relation_type: "filter", relation: { id: "task:c:statement:0:relation:filter", type: "filter", predicate_expr: "status = 'A'" } },
      { task_id: "c", statement_index: 1, relation_id: "task:c:statement:1:relation:read", relation_type: "read", relation: { id: "task:c:statement:1:relation:read", type: "read" } },
      { task_id: "c", statement_index: 1, relation_id: "task:c:statement:1:relation:join", relation_type: "join", relation: { id: "task:c:statement:1:relation:join", type: "join", join_type: "INNER" } },
    ];
    const edges = [
      { from_relation_id: rows[0]!.relation_id, to_relation_id: rows[1]!.relation_id },
      { from_relation_id: rows[2]!.relation_id, to_relation_id: rows[3]!.relation_id },
    ];
    const first = summarizeTaskRelations({ taskId: "c", statementIndex: 0, relationRecords: rows, relationEdgeRecords: edges });
    const second = summarizeTaskRelations({ taskId: "c", statementIndex: 1, relationRecords: rows, relationEdgeRecords: edges });
    expect(first.statementIndex).toBe(0);
    expect(second.statementIndex).toBe(1);
    expect(first.relationCount).toBe(2);
    expect(second.relationCount).toBe(2);
    expect(first.readImpacts[0]?.impactChannels).toContain("ROW_MEMBERSHIP");
    expect(second.readImpacts[0]?.impactChannels).toContain("MULTIPLICITY");
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
      { kind: "VALUE_FLOW", evidenceStatus: "CONFIRMED", fromNodeId: "p-a", toNodeId: "c-a", consumerTaskId: "c", producerTaskId: "p", edgeId: "e-a", evidenceRefs: ["field-lineage:consumer-read:c:task:c:statement:0:relation:read-a"] },
      { kind: "VALUE_FLOW", evidenceStatus: "CONFIRMED", fromNodeId: "p-b", toNodeId: "c-b", consumerTaskId: "c", producerTaskId: "p", edgeId: "e-b", evidenceRefs: ["field-lineage:consumer-read:c:task:c:statement:0:relation:read-b"] },
    ] }));
    const provider = createFieldValueEvidenceProvider(path);
    const first = provider.lookup(branch({ readOccurrence: { ...occurrence, occurrenceId: "task:c:statement:0:relation:read-a", readRelationId: "task:c:statement:0:relation:read-a" } }));
    const second = provider.lookup(branch({ readOccurrence: { ...occurrence, occurrenceId: "task:c:statement:0:relation:read-b", readRelationId: "task:c:statement:0:relation:read-b" } }));
    expect(first.affectedTargetFields).toEqual(["target_a"]);
    expect(second.affectedTargetFields).toEqual(["target_b"]);
  });

  it("keeps relation status unknown for incomplete candidate evidence", () => {
    const candidate = branch({ gapRefs: ["boundary:read"], boundaryReason: "READ_EVIDENCE_BLOCKED" });
    const provider = { scanCount: 1, edgeCount: 0, lookup: (value: CandidateBranch) => ({ candidateBranchId: value.candidateBranchId, status: "PROVEN_ABSENT" as const, affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [] }) };
    const assessment = assessBranch({ targetWriteId: "write", branch: candidate, universeComplete: false, summary: { taskId: "c", statementIndex: 0, rootRelationId: null, digest: "d", complete: true, readImpacts: [], relationCount: 0, readCount: 0, edgeCount: 0, gaps: [] }, fieldValueProvider: provider });
    expect(assessment.relationStatus).toBe("UNKNOWN");
    expect(validateCausalClosure({ targetWriteId: "write", universe: { rootTaskId: "root", status: "INCOMPLETE", branches: [candidate], boundaryGapRefs: ["boundary:read"], coverage: { sourceArtifactType: "x", sourceCoverageStatus: "PARTIAL", sourceCoverageSemantics: null, sourceLimitsTruncated: false } }, assessments: [assessment] }).valid).toBe(true);
  });

  it("does not promote a branch with a missing producer write to confirmed", () => {
    const candidate = branch({ gapRefs: ["bridge-gap:branch:p:PRODUCER_WRITE_OBSERVATION_MISSING"] });
    const provider = { scanCount: 1, edgeCount: 1, lookup: (value: CandidateBranch) => ({ candidateBranchId: value.candidateBranchId, status: "CONFIRMED" as const, affectedTargetFields: ["amount"], outputFieldBindingIds: [], evidenceRefs: ["field-evidence"], gapRefs: [] }) };
    const assessment = assessBranch({ targetWriteId: "write", branch: candidate, universeComplete: true, summary: { taskId: "c", statementIndex: 0, rootRelationId: null, digest: "d", complete: true, readImpacts: [], relationCount: 0, readCount: 0, edgeCount: 0, gaps: [] }, fieldValueProvider: provider });
    expect(assessment.relationStatus).toBe("UNKNOWN");
    expect(assessment.gapRefs).toContain("bridge-gap:branch:p:PRODUCER_WRITE_OBSERVATION_MISSING");
  });

  it("uses the target-rooted closure and leaves disconnected branches unknown", () => {
    const reachable = branch({ consumerTaskId: "root", producerTaskId: "p", candidateBranchId: "branch:reachable" });
    const disconnected = branch({ consumerTaskId: "other", producerTaskId: "q", candidateBranchId: "branch:disconnected" });
    const root = branch({ branchKind: "ROOT_WRITE", candidateBranchId: "branch:root", consumerTaskId: null, producerTaskId: "root", readOccurrence: null, table: null });
    const summary = { taskId: "root", statementIndex: 0, rootRelationId: null, digest: "d", complete: true, readImpacts: [{ readOccurrenceId: occurrence.readRelationId, impactChannels: ["ROW_MEMBERSHIP"] as const, evidenceRefs: ["relation-evidence"], gaps: [] }], relationCount: 1, readCount: 1, edgeCount: 0, gaps: [] };
    const provider = { scanCount: 1, edgeCount: 0, lookup: (value: CandidateBranch) => ({ candidateBranchId: value.candidateBranchId, status: "PROVEN_ABSENT" as const, affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [] }) };
    const result = buildCausalClosure({ targetWriteId: "write", rootTaskId: "root", universe: { rootTaskId: "root", status: "COMPLETE_OBSERVED_EVIDENCE", branches: [root, reachable, disconnected], boundaryGapRefs: [], coverage: { sourceArtifactType: "test", sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE", sourceCoverageSemantics: null, sourceLimitsTruncated: false } }, summaries: new Map([["root|statement:0", summary]]), fieldValueProvider: provider });
    expect(result.graph.reachableBranchIds).toEqual(["branch:reachable", "branch:root"]);
    expect(result.assessments.find((item) => item.candidateBranchId === "branch:reachable")?.relationStatus).toBe("CONFIRMED_RELATED");
    expect(result.assessments.find((item) => item.candidateBranchId === "branch:disconnected")?.relationStatus).toBe("UNKNOWN");
  });

  it("only emits proven unrelated with complete negative evidence", () => {
    const candidate = branch({ candidateBranchId: "branch:absent", evidenceRefs: [{ evidenceRefId: "bridge-evidence", source: "TEST", locator: "test:bridge" }] });
    const provider = { scanCount: 1, edgeCount: 0, lookup: (value: CandidateBranch) => ({ candidateBranchId: value.candidateBranchId, status: "PROVEN_ABSENT" as const, affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [] }) };
    const assessment = assessBranch({ targetWriteId: "write", branch: candidate, universeComplete: true, summary: { taskId: "c", statementIndex: 0, rootRelationId: null, digest: "d", complete: true, readImpacts: [], relationCount: 0, readCount: 0, edgeCount: 0, gaps: [] }, fieldValueProvider: provider });
    expect(assessment.relationStatus).toBe("PROVEN_UNRELATED");
    expect(assessment.negativeProofs).toHaveLength(1);
    expect(validateCausalClosure({ targetWriteId: "write", universe: { rootTaskId: "root", status: "COMPLETE_OBSERVED_EVIDENCE", branches: [candidate], boundaryGapRefs: [], coverage: { sourceArtifactType: "x", sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE", sourceCoverageSemantics: null, sourceLimitsTruncated: false } }, assessments: [assessment] }).valid).toBe(true);
    const tampered = { ...assessment, negativeProofs: [{ ...assessment.negativeProofs[0]!, premiseRefs: ["not-a-branch-evidence"] }] };
    expect(validateCausalClosure({ targetWriteId: "write", universe: { rootTaskId: "root", status: "COMPLETE_OBSERVED_EVIDENCE", branches: [candidate], boundaryGapRefs: [], coverage: { sourceArtifactType: "x", sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE", sourceCoverageSemantics: null, sourceLimitsTruncated: false } }, assessments: [tampered] }).valid).toBe(false);
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
    const targetWrite = { identity: { targetWriteId: "write", taskId: "root", targetTableKey: "db.target", sqlSourceId: "task:root:slot:query:statement:0", statementOrdinal: 0, writeOrdinal: 0, rootRelationId: "root", writeObservationId: "write:root:0", evidenceRefs: [] }, snapshot: { inputPackFingerprint: "i", machineFactsHash: "m", producerIndexHash: "p", tableMultiHopHash: "t", semanticRuleVersion: "v" } };
    const artifact = { artifactType: "TABLE_MULTI_HOP_RECONCILIATION", rootTaskId: "root", writeEdges: [{ producerTaskId: "root", table }], producerBridges: [{ consumerTaskId: "root", producerTaskId: "p", table, producerRole: "PRIMARY", readOccurrence: occurrence }], scheduleEdges: [], readEdges: [], terminals: [], coverage: { status: "COMPLETE_OBSERVED_EVIDENCE" }, limits: { truncated: false } };
    const universe = projectTargetTableCandidateUniverse({ targetWrite, tableArtifact: artifact, targetTable: { ...table, qualifiedName: "db.target", stableTableId: "db.target__gfhive" } });
    expect(universe.branches.length).toBe(2);
    expect(universe.branches.every((item) => item.candidateBranchId)).toBe(true);
  });
});

function tableWithColumn(value: typeof table, column: string): Record<string, unknown> {
  return { ...value, column };
}

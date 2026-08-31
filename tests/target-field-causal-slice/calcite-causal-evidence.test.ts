import { describe, expect, it } from "vitest";

import {
  CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
  makeDifferentialFingerprint,
  requestFingerprint,
  type DifferentialResponse,
  PLAN_FACTS_REL_GRAPH_VERSION,
  type PlanFactsRelRequest,
  type PlanFactsRelNode,
  type RelTypedExpression,
} from "../../scripts/calcite-differential/calcite-rel-boundary.ts";
import { buildCalciteCausalEvidence } from "../../scripts/reconcile/consumer/target-field-causal-slice/calcite-causal-evidence.ts";

const integerType = {
  status: "CONCRETE" as const,
  name: "INTEGER",
  nullable: false,
};

function fieldRef(
  inputNodeId: string,
  inputOrdinal: number,
  nativeFieldId: string,
): RelTypedExpression {
  return {
    kind: "FIELD_REF",
    expressionId: `expr:${inputNodeId}:${inputOrdinal}`,
    mappingId: `mapping:expr:${inputNodeId}:${inputOrdinal}`,
    evidenceRefs: [`evidence:expr:${inputNodeId}:${inputOrdinal}`],
    type: integerType,
    inputNodeId,
    inputOrdinal,
    nativeFieldId,
  };
}

function baseRequest(): PlanFactsRelRequest {
  const read: PlanFactsRelNode = {
    kind: "READ",
    nodeId: "read-orders",
    nativeRelationId: "read-orders",
    nativeRelationOccurrenceId: "occ-orders",
    mappingId: "mapping:read-orders",
    evidenceRefs: ["evidence:relation:read-orders"],
    outputFields: [
      {
        ordinal: 0,
        name: "status",
        type: integerType,
        nativeFieldId: "field:pdata_n.orders:status",
        mappingId: "mapping:field:status",
        evidenceRefs: ["evidence:field:status"],
        sourceBinding: "o",
      },
    ],
    table: { schema: "pdata_n", name: "orders" },
  };
  const filter: PlanFactsRelNode = {
    kind: "FILTER",
    nodeId: "filter-orders",
    nativeRelationId: "filter-orders",
    mappingId: "mapping:filter-orders",
    evidenceRefs: ["evidence:relation:filter-orders"],
    outputFields: read.outputFields,
    inputNodeId: read.nodeId,
    clause: "WHERE",
    predicate: {
      kind: "CALL",
      expressionId: "expr:predicate",
      mappingId: "mapping:predicate",
      evidenceRefs: ["evidence:predicate"],
      type: { ...integerType, name: "BOOLEAN" },
      operator: "GREATER_THAN",
      operands: [
        fieldRef(read.nodeId, 0, "field:pdata_n.orders:status"),
        {
          kind: "LITERAL",
          expressionId: "expr:literal",
          mappingId: "mapping:literal",
          evidenceRefs: ["evidence:literal"],
          type: integerType,
          value: 0,
        },
      ],
    },
  };
  const body: Omit<PlanFactsRelRequest, "fingerprint"> = {
    protocolVersion: CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
    requestKind: "PLAN_FACTS_REL_V1",
    graphVersion: PLAN_FACTS_REL_GRAPH_VERSION,
    taskId: "task-calcite-evidence",
    statementId: "statement-0",
    schema: {
      tables: [{
        schema: "pdata_n",
        name: "orders",
        columns: [{
          name: "status",
          type: "INTEGER",
          nullable: false,
          evidenceRefs: ["evidence:field:status"],
        }],
      }],
    },
    relations: [read, filter],
    roots: [filter.nodeId],
    mappings: [
      {
        mappingId: read.mappingId,
        nativeRelationId: read.nativeRelationId,
        nativeRelationOccurrenceId: read.nativeRelationOccurrenceId,
        evidenceRefs: [...read.evidenceRefs],
      },
      {
        mappingId: filter.mappingId,
        nativeRelationId: filter.nativeRelationId,
        nativeRelationOccurrenceId: "occ-filter-orders",
        evidenceRefs: [...filter.evidenceRefs],
      },
    ],
  };
  return { ...body, fingerprint: requestFingerprint(body) };
}

function responseFor(
  request: PlanFactsRelRequest,
  observation: DifferentialResponse["observations"][number],
  status: DifferentialResponse["status"] = "SUCCESS",
): DifferentialResponse {
  return {
    protocolVersion: CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
    requestKind: request.requestKind,
    status,
    fingerprint: makeDifferentialFingerprint(request.fingerprint),
    issues: [],
    mappingRefs: [],
    observations: status === "SUCCESS" ? [observation] : [],
  };
}

describe("Calcite causal evidence adapter", () => {
  it("maps an evaluated predicate to exact physical evidence only", () => {
    const request = baseRequest();
    const report = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "observation:filter-predicate",
        kind: "predicates",
        status: "EVALUATED",
        mappingRefs: ["mapping:filter-orders"],
        evidenceRefs: ["evidence:relation:filter-orders"],
        values: [{ predicate: "status > 0" }],
      }),
      rootTargetFieldId: "field:target:amount",
    });

    expect(report.gaps).toEqual([]);
    expect(report.observations).toHaveLength(1);
    expect(report.observations[0]).toMatchObject({
      status: "MAPPED",
      operatorKind: "FILTER",
      localEdgeKind: "ROWSET_CONTROL",
      subjects: [{
        subjectKind: "PHYSICAL_FIELD",
        physicalFieldId: "field:pdata_n.orders:status",
      }],
    });
    expect(report).not.toHaveProperty("definitions");
    expect(report).not.toHaveProperty("applications");
    expect(report).not.toHaveProperty("edges");
    expect(report.safety).toEqual({
      canonicalArtifactsWritten: false,
      causalDecisionsWritten: false,
      negativeConclusionsWritten: false,
    });
  });

  it("keeps NOT_EVALUATED explicit and blocks negative proof", () => {
    const request = baseRequest();
    const report = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "observation:unique-keys",
        kind: "uniqueKeys",
        status: "NOT_EVALUATED",
        mappingRefs: ["mapping:filter-orders"],
        evidenceRefs: [],
        values: [],
      }),
    });

    expect(report.observations[0]).toMatchObject({
      status: "NOT_EVALUATED",
      reasonCode: "CALCITE_OBSERVATION_NOT_EVALUATED",
    });
    expect(report.gaps).toMatchObject([{
      reasonCode: "CALCITE_OBSERVATION_NOT_EVALUATED",
      blocksNegativeProof: true,
    }]);
  });

  it("fails closed for ambiguous mapping and name-only metadata", () => {
    const request = baseRequest();
    const ambiguous = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "observation:ambiguous",
        kind: "predicates",
        status: "EVALUATED",
        mappingRefs: ["mapping:filter-orders", "mapping:read-orders"],
        evidenceRefs: ["evidence:relation:filter-orders"],
        values: [{ predicate: "status > 0" }],
      }),
    });
    expect(ambiguous.observations[0]).toMatchObject({
      status: "UNMAPPABLE",
      reasonCode: "CALCITE_MAPPING_NOT_UNIQUE",
    });
    expect(ambiguous.gaps[0]).toMatchObject({
      reasonCode: "CALCITE_MAPPING_NOT_UNIQUE",
      blocksNegativeProof: true,
    });

    const nameOnly = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "observation:name-only-fd",
        kind: "functionalDependencies",
        status: "EVALUATED",
        mappingRefs: ["mapping:filter-orders"],
        evidenceRefs: ["evidence:relation:filter-orders"],
        values: [{ determinant: ["status"], dependent: ["status"] }],
      }),
    });
    expect(nameOnly.observations[0]).toMatchObject({
      status: "UNMAPPABLE",
      reasonCode: "CALCITE_SUBJECT_IDENTITY_MISSING",
    });
  });

  it("represents a failed sidecar without observations or conclusions", () => {
    const request = baseRequest();
    const report = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "unused",
        kind: "predicates",
        status: "EVALUATED",
        mappingRefs: [],
        evidenceRefs: [],
      }, "FAILED"),
    });
    expect(report.observations).toEqual([]);
    expect(report.gaps).toMatchObject([{
      reasonCode: "CALCITE_SIDECAR_NOT_EVALUATED",
      blocksNegativeProof: true,
    }]);
    expect(report.safety.causalDecisionsWritten).toBe(false);
  });
});

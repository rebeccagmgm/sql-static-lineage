import { describe, expect, it } from "vitest";

import {
  CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
  makeDifferentialFingerprint,
  type DifferentialResponse,
  type PlanFactsRelRequest,
} from "../../scripts/calcite-differential/protocol.ts";
import {
  PLAN_FACTS_REL_GRAPH_VERSION,
  type PlanFactsRelNode,
  type RelTypedExpression,
} from "../../scripts/calcite-differential/plan-facts-rel-contract.ts";
import { requestFingerprint } from "../../scripts/calcite-differential/protocol.ts";
import {
  augmentSemanticNormalizationWithCalciteEvidence,
  buildCalciteCausalEvidence,
  integrateCalciteOperatorEvidence,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/calcite-causal-evidence.ts";
import {
  makeSemanticDependencyApplication,
  makeSemanticDependencyDefinition,
  makeSemanticDependencyEdge,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";

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
): DifferentialResponse {
  return {
    protocolVersion: CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
    requestKind: request.requestKind,
    status: "SUCCESS",
    fingerprint: makeDifferentialFingerprint(request.fingerprint),
    issues: [],
    mappingRefs: [],
    observations: [observation],
  };
}

describe("Calcite causal evidence mapping", () => {
  it("maps a predicate back to the exact physical field and canonical fact", () => {
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
    expect(report.observations[0]?.proofRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "CALCITE_OBSERVATION",
          refId: "observation:filter-predicate",
        }),
        expect.objectContaining({
          kind: "CANONICAL_FACT",
          refId: "evidence:relation:filter-orders",
        }),
      ]),
    );
    expect(report.edges).toHaveLength(1);
    expect(report.edges[0]).toMatchObject({
      rootDependenceKind: "CONTROL_TO_TARGET",
      localEdgeKind: "ROWSET_CONTROL",
      toSubject: {
        subjectKind: "PHYSICAL_FIELD",
        physicalFieldId: "field:target:amount",
      },
    });
  });

  it("turns a non-evaluated observation into an explicit gap", () => {
    const request = baseRequest();
    const report = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "observation:unique-keys",
        kind: "uniqueKeys",
        status: "NOT_EVALUATED",
        mappingRefs: [],
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
    expect(report.edges).toEqual([]);
  });

  it("does not infer a dependency when the mapping is ambiguous", () => {
    const request = baseRequest();
    const report = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "observation:ambiguous",
        kind: "predicates",
        status: "EVALUATED",
        mappingRefs: ["mapping:filter-orders", "mapping:read-orders"],
        evidenceRefs: ["evidence:relation:filter-orders"],
        values: [{ predicate: "status > 0" }],
      }),
      rootTargetFieldId: "field:target:amount",
    });

    expect(report.observations[0]).toMatchObject({
      status: "UNMAPPABLE",
      reasonCode: "CALCITE_MAPPING_NOT_UNIQUE",
    });
    expect(report.gaps[0]).toMatchObject({
      reasonCode: "CALCITE_MAPPING_NOT_UNIQUE",
      blocksNegativeProof: true,
    });
    expect(report.definitions).toEqual([]);
    expect(report.edges).toEqual([]);
  });

  it("maps Calcite key and functional-dependency ordinals to exact physical fields", () => {
    const request = baseRequest();
    const join: PlanFactsRelNode = {
      kind: "JOIN",
      nodeId: "join-orders",
      nativeRelationId: "join-orders",
      mappingId: "mapping:join-orders",
      evidenceRefs: ["evidence:relation:join-orders"],
      outputFields: [
        {
          ordinal: 0,
          name: "left_id",
          type: integerType,
          nativeFieldId: "field:pdata_n.left:id",
          mappingId: "mapping:join:left-id",
          evidenceRefs: ["evidence:join:left-id"],
        },
        {
          ordinal: 1,
          name: "right_status",
          type: integerType,
          nativeFieldId: "field:pdata_n.right:status",
          mappingId: "mapping:join:right-status",
          evidenceRefs: ["evidence:join:right-status"],
        },
      ],
      leftNodeId: "read-orders",
      rightNodeId: "read-orders",
      joinType: "INNER",
    };
    const joinRequest: PlanFactsRelRequest = {
      ...request,
      relations: [...request.relations, join],
      roots: [join.nodeId],
      mappings: [
        ...request.mappings,
        {
          mappingId: join.mappingId,
          nativeRelationId: join.nativeRelationId,
          nativeRelationOccurrenceId: "occ-join-orders",
          evidenceRefs: [...join.evidenceRefs],
        },
      ],
    };
    const report = buildCalciteCausalEvidence({
      request: joinRequest,
      response: responseFor(joinRequest, {
        observationId: "observation:join-unique-keys",
        kind: "uniqueKeys",
        status: "EVALUATED",
        mappingRefs: [join.mappingId],
        evidenceRefs: [...join.evidenceRefs],
        values: [{ columns: ["left_id"], ordinals: [0] }],
      }),
      rootTargetFieldId: "field:target:amount",
    });

    expect(report.gaps).toEqual([]);
    expect(report.observations[0]).toMatchObject({
      status: "MAPPED",
      operatorKind: "JOIN",
      operatorRole: "UNIQUE_KEYS",
      subjects: [{
        subjectKind: "PHYSICAL_FIELD",
        physicalFieldId: "field:pdata_n.left:id",
      }],
    });
    expect(report.edges[0]).toMatchObject({
      fromSubject: {
        subjectKind: "PHYSICAL_FIELD",
        physicalFieldId: "field:pdata_n.left:id",
      },
      localEdgeKind: "ROWSET_CONTROL",
    });
  });

  it("keeps name-only Calcite metadata unmappable instead of guessing duplicate fields", () => {
    const request = baseRequest();
    const report = buildCalciteCausalEvidence({
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

    expect(report.observations[0]).toMatchObject({
      status: "UNMAPPABLE",
      reasonCode: "CALCITE_SUBJECT_IDENTITY_MISSING",
    });
    expect(report.gaps[0]).toMatchObject({
      reasonCode: "CALCITE_SUBJECT_IDENTITY_MISSING",
      blocksNegativeProof: true,
    });
    expect(report.edges).toEqual([]);
  });

  it("integrates exact Calcite metadata as a conditional control branch", () => {
    const request = baseRequest();
    const report = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "observation:metadata-control",
        kind: "uniqueKeys",
        status: "EVALUATED",
        mappingRefs: ["mapping:filter-orders"],
        evidenceRefs: ["evidence:relation:filter-orders"],
        values: [{ columns: ["status"], ordinals: [0] }],
      }),
    });
    expect(report.observations[0]).toMatchObject({
      operatorKind: "RELATION",
      operatorVariant: "FILTER",
      operatorRole: "UNIQUE_KEYS",
      effectKind: "MULTIPLICITY",
      localEdgeKind: "ROWSET_CONTROL",
      subjects: [{
        subjectKind: "PHYSICAL_FIELD",
        physicalFieldId: "field:pdata_n.orders:status",
      }],
    });
    const result = integrateCalciteOperatorEvidence(
      (() => {
        const definition = makeSemanticDependencyDefinition({
          subject: {
            subjectKind: "PHYSICAL_FIELD",
            physicalFieldId: "field:pdata_n.orders:status",
          },
          effectKind: "MULTIPLICITY",
          operatorKind: "RELATION",
          operatorVariant: "FILTER",
          operatorRole: "UNIQUE_KEYS",
          localEdgeKind: "ROWSET_CONTROL",
        }, "SUPPORTED", []);
        const application = makeSemanticDependencyApplication({
          dependencyId: definition.dependencyId,
          rootTargetFieldId: "field:target:amount",
          rootDependenceKind: "CONTROL_TO_TARGET",
          pathCertainty: "CONDITIONAL",
        });
        const edge = makeSemanticDependencyEdge({
          dependencyId: definition.dependencyId,
          fromSubject: definition.subject,
          toSubject: {
            subjectKind: "PHYSICAL_FIELD",
            physicalFieldId: "field:target:amount",
          },
          rootDependenceKind: "CONTROL_TO_TARGET",
          localEdgeKind: "ROWSET_CONTROL",
          pathCertainty: "CONDITIONAL",
        });
        return {
          definitions: [definition],
          applications: [application],
          edges: [edge],
          semanticEdges: [edge],
          gaps: [],
          legacyEdges: [],
        };
      })(),
      report,
      {
        relevantNativeRelationIds: new Set(["filter-orders"]),
        canonicalPhysicalFieldIds: new Set(["field:pdata_n.orders:status"]),
        rootTargetFieldIds: ["field:target:amount"],
      },
    );

    expect(result.integratedObservationIds).toEqual(["observation:metadata-control"]);
    expect(result.blockedObservationIds).toEqual([]);
    expect(result.normalization.definitions).toHaveLength(1);
    expect(result.normalization.applications).toMatchObject([{
      rootTargetFieldId: "field:target:amount",
      pathCertainty: "CONDITIONAL",
    }]);
    expect(result.normalization.edges).toMatchObject([{
      fromSubject: {
        subjectKind: "PHYSICAL_FIELD",
        physicalFieldId: "field:pdata_n.orders:status",
      },
      localEdgeKind: "ROWSET_CONTROL",
      pathCertainty: "CONDITIONAL",
    }]);
  });

  it("blocks negative proof when Calcite metadata is not evaluated", () => {
    const request = baseRequest();
    const report = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "observation:metadata-missing",
        kind: "uniqueKeys",
        status: "NOT_EVALUATED",
        mappingRefs: ["mapping:filter-orders"],
        evidenceRefs: [],
        values: [],
      }),
    });
    const result = integrateCalciteOperatorEvidence(
      {
        definitions: [],
        applications: [],
        edges: [],
        semanticEdges: [],
        gaps: [],
        legacyEdges: [],
      },
      report,
      {
        relevantNativeRelationIds: new Set(["filter-orders"]),
        rootTargetFieldIds: ["field:target:amount"],
      },
    );

    expect(result.integratedObservationIds).toEqual([]);
    expect(result.blockedObservationIds).toEqual(["observation:metadata-missing"]);
    expect(result.normalization.gaps).toMatchObject([{
      reasonCode: "CALCITE_OBSERVATION_NOT_EVALUATED",
      rootTargetFieldId: "field:target:amount",
      blocksNegativeProof: true,
    }]);
  });

  it("does not integrate evidence produced for a non-target request root", () => {
    const request = baseRequest();
    const report = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "observation:non-target-root",
        kind: "predicates",
        status: "EVALUATED",
        mappingRefs: ["mapping:filter-orders"],
        evidenceRefs: ["evidence:relation:filter-orders"],
        values: [{ predicate: "status > 0" }],
      }),
    });
    const result = integrateCalciteOperatorEvidence(
      {
        definitions: [],
        applications: [],
        edges: [],
        semanticEdges: [],
        gaps: [],
        legacyEdges: [],
      },
      report,
      {
        relevantNativeRelationIds: new Set(["filter-orders"]),
        relevantRequestRootNodeIds: new Set(["read-orders"]),
        canonicalPhysicalFieldIds: new Set(["field:pdata_n.orders:status"]),
        rootTargetFieldIds: ["field:target:amount"],
      },
    );

    expect(result.integratedObservationIds).toEqual([]);
    expect(result.blockedObservationIds).toEqual([]);
    expect(result.normalization.definitions).toEqual([]);
    expect(result.normalization.applications).toEqual([]);
    expect(result.normalization.edges).toEqual([]);
    expect(result.normalization.gaps).toEqual([]);
  });

  it("blocks evidence with no request root instead of guessing its target scope", () => {
    const request = baseRequest();
    const report = buildCalciteCausalEvidence({
      request: { ...request, roots: [] },
      response: responseFor({ ...request, roots: [] }, {
        observationId: "observation:missing-root",
        kind: "uniqueKeys",
        status: "NOT_EVALUATED",
        mappingRefs: ["mapping:filter-orders"],
        evidenceRefs: [],
        values: [],
      }),
    });
    const result = integrateCalciteOperatorEvidence(
      {
        definitions: [],
        applications: [],
        edges: [],
        semanticEdges: [],
        gaps: [],
        legacyEdges: [],
      },
      report,
      {
        relevantRequestRootNodeIds: new Set(["filter-orders"]),
        rootTargetFieldIds: ["field:target:amount"],
      },
    );

    expect(result.blockedObservationIds).toEqual(["observation:missing-root"]);
    expect(result.normalization.gaps).toMatchObject([{
      reasonCode: "CALCITE_REQUEST_ROOT_SCOPE_MISSING",
      rootTargetFieldId: "field:target:amount",
      blocksNegativeProof: true,
    }]);
  });

  it("attaches Calcite proof to an exact Native dependency without changing its identity", () => {
    const request = baseRequest();
    const calciteReport = buildCalciteCausalEvidence({
      request,
      response: responseFor(request, {
        observationId: "observation:filter-predicate",
        kind: "predicates",
        status: "EVALUATED",
        mappingRefs: ["mapping:filter-orders"],
        evidenceRefs: ["evidence:relation:filter-orders"],
        values: [{ predicate: "status > 0" }],
      }),
    });
    const nativeDefinition = makeSemanticDependencyDefinition({
      subject: {
        subjectKind: "PHYSICAL_FIELD",
        physicalFieldId: "field:pdata_n.orders:status",
      },
      effectKind: "ROW_MEMBERSHIP",
      operatorKind: "FILTER",
      operatorVariant: "WHERE",
      operatorRole: "PREDICATE",
      localEdgeKind: "ROWSET_CONTROL",
    }, "SUPPORTED", []);
    const result = augmentSemanticNormalizationWithCalciteEvidence({
      definitions: [nativeDefinition],
      applications: [],
      edges: [],
      semanticEdges: [],
      gaps: [],
      legacyEdges: [],
    }, calciteReport);

    expect(result.matchedObservationIds).toEqual(["observation:filter-predicate"]);
    expect(result.unmappedObservationIds).toEqual([]);
    expect(result.normalization.definitions[0]?.dependencyId).toBe(
      nativeDefinition.dependencyId,
    );
    expect(result.normalization.definitions[0]?.proofRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "CALCITE_OBSERVATION",
          refId: "observation:filter-predicate",
        }),
      ]),
    );
  });
});

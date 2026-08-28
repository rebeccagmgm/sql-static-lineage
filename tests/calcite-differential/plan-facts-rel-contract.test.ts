import { describe, expect, it } from "vitest";
import {
  PLAN_FACTS_REL_GRAPH_VERSION,
  validatePlanFactsRelGraph,
  type ConcreteSqlType,
  type PlanFactsRelGraph,
  type PlanFactsRelNode,
  type RelReadNode,
} from "../../scripts/calcite-differential/plan-facts-rel-contract.ts";

const integerType: ConcreteSqlType = {
  status: "CONCRETE",
  name: "INTEGER",
  nullable: false,
};

function readNode(overrides: Partial<RelReadNode> = {}): RelReadNode {
  return {
    kind: "READ",
    nodeId: "read-1",
    nativeRelationId: "native-read-1",
    nativeRelationOccurrenceId: "occurrence-1",
    mappingId: "mapping-read-1",
    evidenceRefs: ["evidence-read-1"],
    table: { schema: "demo", name: "source_table" },
    outputFields: [
      {
        ordinal: 0,
        name: "id",
        type: integerType,
        mappingId: "mapping-field-1",
        evidenceRefs: ["evidence-field-1"],
      },
    ],
    ...overrides,
  };
}

function graph(
  nodes: readonly PlanFactsRelNode[] = [readNode()],
  roots = ["read-1"],
): PlanFactsRelGraph {
  return {
    graphVersion: PLAN_FACTS_REL_GRAPH_VERSION,
    taskId: "task-1",
    statementId: "statement-1",
    nodes,
    rootNodeIds: roots,
  };
}

describe("Plan Facts relational contract", () => {
  it("accepts a typed, evidence-mapped read graph", () => {
    expect(validatePlanFactsRelGraph(graph())).toEqual({ valid: true, issues: [] });
  });

  it.each(["ANY", "UNKNOWN", ""])("rejects non-concrete SQL type %s", (name) => {
    const node = readNode({
      outputFields: [
        {
          ...readNode().outputFields[0]!,
          type: { ...integerType, name },
        },
      ],
    });
    expect(validatePlanFactsRelGraph(graph([node])).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "TYPE_NOT_CONCRETE" })]),
    );
  });

  it("rejects duplicate nodes and dangling inputs and roots", () => {
    const project = {
      kind: "PROJECT" as const,
      nodeId: "project-1",
      nativeRelationId: "native-project-1",
      mappingId: "mapping-project-1",
      evidenceRefs: ["evidence-project-1"],
      outputFields: [],
      inputNodeId: "missing-input",
      expressions: [],
    };
    const result = validatePlanFactsRelGraph(
      graph([readNode(), readNode(), project], ["missing-root"]),
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "NODE_ID_DUPLICATE" }),
        expect.objectContaining({ code: "RELATION_INPUT_DANGLING" }),
        expect.objectContaining({ code: "ROOT_NODE_DANGLING" }),
      ]),
    );
  });

  it("rejects semantic objects without mapping or evidence", () => {
    const result = validatePlanFactsRelGraph(
      graph([readNode({ mappingId: "", evidenceRefs: [] })]),
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MAPPING_ID_MISSING" }),
        expect.objectContaining({ code: "EVIDENCE_REFS_MISSING" }),
      ]),
    );
  });

  it("rejects field references that do not resolve to a direct input ordinal", () => {
    const unrelated = readNode({
      nodeId: "read-unrelated",
      nativeRelationId: "native-read-unrelated",
      nativeRelationOccurrenceId: "occurrence-unrelated",
      mappingId: "mapping-read-unrelated",
    });
    const project = {
      kind: "PROJECT" as const,
      nodeId: "project-1",
      nativeRelationId: "native-project-1",
      mappingId: "mapping-project-1",
      evidenceRefs: ["evidence-project-1"],
      outputFields: [
        {
          ordinal: 0,
          name: "id",
          type: integerType,
          mappingId: "mapping-project-field-1",
          evidenceRefs: ["evidence-project-field-1"],
        },
      ],
      inputNodeId: "read-1",
      expressions: [
        {
          kind: "FIELD_REF" as const,
          expressionId: "expression-1",
          type: integerType,
          inputNodeId: "read-1",
          inputOrdinal: 4,
          mappingId: "mapping-expression-1",
          evidenceRefs: ["evidence-expression-1"],
        },
        {
          kind: "FIELD_REF" as const,
          expressionId: "expression-2",
          type: integerType,
          inputNodeId: "read-unrelated",
          inputOrdinal: 0,
          mappingId: "mapping-expression-2",
          evidenceRefs: ["evidence-expression-2"],
        },
      ],
    };

    expect(
      validatePlanFactsRelGraph(
        graph([readNode(), unrelated, project], ["project-1"]),
      ).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "FIELD_REF_ORDINAL_OUT_OF_RANGE" }),
        expect.objectContaining({ code: "FIELD_REF_INPUT_NOT_DIRECT" }),
      ]),
    );
  });

  it("rejects cyclic relation graphs and invalid concrete type status", () => {
    const first = {
      kind: "PROJECT" as const,
      nodeId: "project-a",
      nativeRelationId: "native-project-a",
      mappingId: "mapping-project-a",
      evidenceRefs: ["evidence-project-a"],
      outputFields: [],
      inputNodeId: "project-b",
      expressions: [],
    };
    const second = {
      ...first,
      nodeId: "project-b",
      nativeRelationId: "native-project-b",
      mappingId: "mapping-project-b",
      evidenceRefs: ["evidence-project-b"],
      inputNodeId: "project-a",
    };
    expect(validatePlanFactsRelGraph(graph([first, second], ["project-a"])).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "RELATION_GRAPH_CYCLE" }),
      ]));

    const invalidStatus = readNode({
      outputFields: [{
        ...readNode().outputFields[0]!,
        type: { ...integerType, status: "UNKNOWN" as "CONCRETE" },
      }],
    });
    expect(validatePlanFactsRelGraph(graph([invalidStatus])).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TYPE_STATUS_INVALID" }),
      ]),
    );
  });
});

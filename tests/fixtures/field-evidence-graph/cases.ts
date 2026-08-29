import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalJson } from "../../../scripts/machine-facts/machine-facts-contract.ts";
import { buildProjectTopology } from "../../../scripts/project-graph/topology/project-topology-projector.ts";
import { publishProjectTopology } from "../../../scripts/project-graph/topology/project-topology-publication.ts";
import { loadProjectTopologySources } from "../../../scripts/project-graph/topology/project-topology-source.ts";
import {
  canonicalizeFieldLineageArtifact,
  type FieldLineageArtifact,
  type FieldLineageEdge,
  type FieldLineageNode,
  type PhysicalFieldIdentity,
} from "../../../scripts/reconcile/consumer/field-lineage/field-lineage-contract.ts";
import {
  projectTopologyFixturePair,
  type ProjectTopologyFixturePair,
} from "../project-topology/cases.ts";

const GENERATED_AT = "2026-08-29T01:00:00.000Z";

export const FIELD_FIXTURE_TARGET = Object.freeze({
  platform: "hive",
  dataSource: "warehouse-target",
  stableTableId: "guid-target",
  qualifiedName: "dm.target",
});
export const FIELD_FIXTURE_WRITE_ID =
  "write-observation:root-1:platform-target:0";

export interface FieldLineageFixtureOptions {
  readonly partial?: boolean;
  readonly includeGap?: boolean;
  readonly ambiguousPrecision?: boolean;
  readonly producerTaskId?: string;
  readonly crossDatasetSource?: "warehouse-a" | "warehouse-b";
  readonly rootWriteObservationIds?: readonly string[];
  readonly truncated?: boolean;
  readonly sharedWriteSecondBinding?: boolean;
  readonly blocked?: boolean;
}

export function fieldLineageFixture(
  options: FieldLineageFixtureOptions = {},
): FieldLineageArtifact {
  const producerTaskId = options.producerTaskId ?? "shared-producer";
  const crossDataSource = options.crossDatasetSource ?? "warehouse-a";
  const targetDelta = field(FIELD_FIXTURE_TARGET, "delta");
  const targetGamma = field(FIELD_FIXTURE_TARGET, "gamma");
  const producerDelta = field(
    {
      platform: "hive",
      dataSource: crossDataSource,
      stableTableId: `guid-shared-${crossDataSource}`,
      qualifiedName: "dm.shared_source",
    },
    "delta",
  );
  const consumerDelta = producerDelta;
  const otherSourceGamma = field(
    {
      platform: "hive",
      dataSource: "warehouse-b",
      stableTableId: "guid-shared-warehouse-b",
      qualifiedName: "dm.shared_source",
    },
    "gamma",
  );
  const nodes: FieldLineageNode[] = [
    {
      nodeId: "node:producer:delta",
      taskId: producerTaskId,
      taskName: "producer",
      depth: 1,
      field: producerDelta,
      bindingId: "producer-binding:delta",
      expressionId: "producer-expression:delta",
      expressionText: "delta",
      inputDependencyStatus: "PHYSICAL",
      evidenceStatus: "CONFIRMED",
    },
    {
      nodeId: "node:root:read:delta",
      taskId: "root-1",
      taskName: "root",
      depth: 0,
      field: consumerDelta,
      bindingId: "consumer-binding:delta",
      expressionId: null,
      expressionText: null,
      evidenceStatus: "CONFIRMED",
    },
    {
      nodeId: "node:root:target:delta",
      taskId: "root-1",
      taskName: "root",
      depth: 0,
      field: targetDelta,
      bindingId: "target-binding:delta",
      expressionId: "root-expression:delta",
      expressionText: "coalesce(delta, 0)",
      inputDependencyStatus: "PHYSICAL",
      evidenceStatus: "CONFIRMED",
    },
    {
      nodeId: "node:root:read:gamma",
      taskId: "root-1",
      taskName: "root",
      depth: 0,
      field: otherSourceGamma,
      bindingId: "consumer-binding:gamma",
      expressionId: null,
      expressionText: null,
      evidenceStatus: "CONFIRMED",
    },
    {
      nodeId: "node:root:target:gamma",
      taskId: "root-1",
      taskName: "root",
      depth: 0,
      field: targetGamma,
      bindingId: "target-binding:gamma",
      expressionId: "root-expression:gamma",
      expressionText: "gamma",
      inputDependencyStatus: "PHYSICAL",
      evidenceStatus: "CONFIRMED",
    },
    ...(options.sharedWriteSecondBinding
      ? [
          {
            nodeId: "node:producer:delta:second-binding",
            taskId: producerTaskId,
            taskName: "producer",
            depth: 1,
            field: { ...producerDelta, column: "delta_aux" },
            bindingId: "producer-binding:delta:second",
            expressionId: "producer-expression:delta:second",
            expressionText: "delta_aux",
            inputDependencyStatus: "PHYSICAL" as const,
            evidenceStatus: "CONFIRMED" as const,
          },
          {
            nodeId: "node:root:read:delta:second-binding",
            taskId: "root-1",
            taskName: "root",
            depth: 0,
            field: { ...consumerDelta, column: "delta_aux" },
            bindingId: "consumer-binding:delta:second",
            expressionId: null,
            expressionText: null,
            evidenceStatus: "CONFIRMED" as const,
          },
        ]
      : []),
  ];
  const producerWriteRefs = [
    `field-lineage:producer-write:${producerTaskId}:write-observation:${producerTaskId}:0:producer-binding:delta`,
    ...(options.ambiguousPrecision
      ? [
          `field-lineage:producer-write:${producerTaskId}:write-observation:${producerTaskId}:1:producer-binding:delta`,
        ]
      : []),
  ];
  const edges: FieldLineageEdge[] = [
    {
      edgeId: "edge:cross:delta",
      fromNodeId: "node:producer:delta",
      toNodeId: "node:root:read:delta",
      consumerTaskId: "root-1",
      producerTaskId,
      kind: "VALUE_FLOW",
      mapping: "delta -> delta",
      evidenceStatus: "CONFIRMED",
      evidenceRefs: [
        `field-lineage:consumer-read:root-1:root-1:read:0:root-1:relation:0`,
        ...producerWriteRefs,
      ],
    },
    {
      edgeId: "edge:root:delta",
      fromNodeId: "node:root:read:delta",
      toNodeId: "node:root:target:delta",
      consumerTaskId: "root-1",
      producerTaskId: null,
      kind: "VALUE_FLOW",
      mapping: "coalesce(delta, 0)",
      evidenceStatus: "CONFIRMED",
      evidenceRefs: ["machine-facts:root-expression:delta"],
    },
    {
      edgeId: "edge:root:gamma",
      fromNodeId: "node:root:read:gamma",
      toNodeId: "node:root:target:gamma",
      consumerTaskId: "root-1",
      producerTaskId: null,
      kind: "VALUE_FLOW",
      mapping: "gamma",
      evidenceStatus: "CONFIRMED",
      evidenceRefs: ["machine-facts:root-expression:gamma"],
    },
    ...(options.sharedWriteSecondBinding
      ? [
          {
            edgeId: "edge:cross:delta:second-binding",
            fromNodeId: "node:producer:delta:second-binding",
            toNodeId: "node:root:read:delta:second-binding",
            consumerTaskId: "root-1",
            producerTaskId,
            kind: "VALUE_FLOW" as const,
            mapping: "delta_aux -> delta",
            evidenceStatus: "CONFIRMED" as const,
            evidenceRefs: [
              "field-lineage:consumer-read:root-1:root-1:read:0:root-1:relation:0",
              `field-lineage:producer-write:${producerTaskId}:write-observation:${producerTaskId}:0:producer-binding:delta:second`,
            ],
          },
          {
            edgeId: "edge:root:delta:second-binding",
            fromNodeId: "node:root:read:delta:second-binding",
            toNodeId: "node:root:target:delta",
            consumerTaskId: "root-1",
            producerTaskId: null,
            kind: "VALUE_FLOW" as const,
            mapping: "delta_aux",
            evidenceStatus: "CONFIRMED" as const,
            evidenceRefs: ["machine-facts:root-expression:delta:second"],
          },
        ]
      : []),
  ];
  const partial =
    options.partial === true ||
    options.includeGap === true ||
    options.truncated === true;
  return canonicalizeFieldLineageArtifact({
    schemaVersion: "1.1.0",
    artifactType: "FIELD_MULTI_HOP_RECONCILIATION",
    generatedAt: GENERATED_AT,
    request: {
      rootTaskId: "root-1",
      rootTable: "dm.target",
      rootWriteObservationIds: options.rootWriteObservationIds ?? [
        FIELD_FIXTURE_WRITE_ID,
      ],
      rootFields: ["delta", "gamma"],
      rootFieldSelection: "ALL_TARGET_COLUMNS",
      factsPolicy: "current-only",
    },
    overallStatus: options.blocked
      ? "BLOCKED"
      : partial
        ? "PARTIAL"
        : "COMPLETE",
    rootNodeIds: ["node:root:target:delta", "node:root:target:gamma"],
    nodes,
    edges,
    rowsetControls: [
      {
        controlId: "control:delta:filter",
        taskId: "root-1",
        nodeId: "node:root:target:delta",
        statementId: "statement:root:0",
        relationId: "relation:root:0",
        controlType: "filter",
        fields: [consumerDelta],
        sourceText: "where delta is not null",
        evidenceStatus: "CONFIRMED",
        reasonCode: null,
        evidenceRefs: ["machine-facts:control:delta"],
      },
    ],
    candidates: [
      {
        candidateId: "candidate:delta:alternative",
        consumerTaskId: "root-1",
        producerTaskId: "root-1-unknown-producer",
        field: consumerDelta,
        evidenceStatus: "CANDIDATE",
        reasonCode: "ADDITIONAL_PRODUCER_NOT_SELECTED",
      },
      {
        candidateId: "candidate:task-scoped",
        consumerTaskId: "root-1",
        producerTaskId: "root-1-unknown-producer",
        field: null,
        evidenceStatus: "CANDIDATE",
        reasonCode: "TASK_SCOPED_CANDIDATE",
      },
    ],
    gaps: options.includeGap
      ? [
          {
            gapId: "gap:delta",
            taskId: "root-1",
            nodeId: "node:root:target:delta",
            field: targetDelta,
            reasonCode: "FIXTURE_GAP",
            message: "Fixture unresolved evidence",
            evidenceStatus: "UNRESOLVED",
            evidenceRefs: ["fixture:gap:delta"],
          },
          {
            gapId: "gap:task-scoped",
            taskId: "root-1",
            nodeId: null,
            field: null,
            reasonCode: "FIXTURE_TASK_GAP",
            message: "Fixture task-scoped gap",
            evidenceStatus: "UNRESOLVED",
            evidenceRefs: [],
          },
        ]
      : [],
    tableEdges: [
      {
        consumerTaskId: "root-1",
        producerTaskId,
        classification:
          crossDataSource === "warehouse-a" ? "PRIMARY" : "UNKNOWN",
      },
    ],
    limits: {
      maxDepth: 25,
      maxStates: 5_000,
      maxPaths: 10_000,
      truncated: options.truncated === true,
      reasons: options.truncated ? ["MAX_STATES_REACHED"] : [],
    },
    boundaries: {
      staticSqlOnly: true,
      runtimeExecution: "NOT_EVALUATED",
      dataCorrectness: "NOT_EVALUATED",
      businessAcceptance: "NOT_EVALUATED",
    },
  });
}

export function invalidFieldLineageFixtures(): Readonly<{
  multipleRootWrites: FieldLineageArtifact;
  missingProjectTask: FieldLineageArtifact;
  nonPrimaryCrossTask: FieldLineageArtifact;
  ambiguousPrecision: FieldLineageArtifact;
  brokenContentHash: FieldLineageArtifact;
}> {
  const valid = fieldLineageFixture();
  return {
    multipleRootWrites: fieldLineageFixture({
      rootWriteObservationIds: [FIELD_FIXTURE_WRITE_ID, "write:second"],
    }),
    missingProjectTask: fieldLineageFixture({
      producerTaskId: "task-not-in-project",
    }),
    nonPrimaryCrossTask: fieldLineageFixture({
      producerTaskId: "root-1-unknown-producer",
      crossDatasetSource: "warehouse-b",
    }),
    ambiguousPrecision: fieldLineageFixture({ ambiguousPrecision: true }),
    brokenContentHash: {
      ...valid,
      contentHash: "0".repeat(64),
    },
  };
}

export interface MaterializedFieldEvidenceFixture {
  readonly projectTopologyDirectory: string;
  readonly fieldLineagePath: string;
  readonly outputRoot: string;
  readonly artifact: FieldLineageArtifact;
}

export function materializeFieldEvidenceFixture(
  directory: string,
  options: {
    readonly field?: FieldLineageArtifact;
    readonly topology?: ProjectTopologyFixturePair;
    readonly projectKey?: string;
  } = {},
): MaterializedFieldEvidenceFixture {
  mkdirSync(directory, { recursive: true });
  const topology = options.topology ?? projectTopologyFixturePair();
  const oneHopPath = join(directory, "one-hop.json");
  const multiHopPath = join(directory, "multi-hop.json");
  writeFileSync(oneHopPath, canonicalJson(topology.oneHop), "utf8");
  writeFileSync(multiHopPath, canonicalJson(topology.multiHop), "utf8");
  const roots = loadProjectTopologySources([
    { rootTaskId: "root-1", oneHopPath, multiHopPath },
  ]);
  const project = buildProjectTopology({
    projectKey: options.projectKey ?? "field-fixture-project",
    roots,
  });
  const projectOutput = join(directory, "project-output");
  const published = publishProjectTopology(project, {
    outputRoot: projectOutput,
  });
  const artifact = options.field ?? fieldLineageFixture();
  const fieldLineagePath = join(directory, "field-lineage.json");
  writeFileSync(fieldLineagePath, canonicalJson(artifact), "utf8");
  return {
    projectTopologyDirectory: published.directory,
    fieldLineagePath,
    outputRoot: join(directory, "field-output"),
    artifact,
  };
}

function field(
  table: {
    readonly platform: string;
    readonly dataSource: string;
    readonly stableTableId: string;
    readonly qualifiedName: string;
  },
  column: string,
): PhysicalFieldIdentity {
  return {
    ...table,
    column,
    identityStatus: "SCHEMA_BACKED",
  };
}

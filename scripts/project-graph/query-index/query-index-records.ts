import {
  canonicalJson,
  sha256,
} from "../../machine-facts/machine-facts-contract.ts";
import { compareText } from "../contracts/project-topology-contract.ts";
import type { QueryIndexProjectionKind } from "./query-index-contract.ts";
import type { LoadedQueryIndexSource } from "./query-index-source.ts";
import type {
  QueryIndexBuildProjection,
  QueryIndexIndexedEdge,
  QueryIndexIndexedNode,
} from "./query-index-store.ts";

export interface QueryIndexRecordBundle {
  readonly nodes: readonly QueryIndexIndexedNode[];
  readonly edges: readonly QueryIndexIndexedEdge[];
  readonly projections: readonly QueryIndexBuildProjection[];
  readonly expectedCounts: {
    readonly nodes: number;
    readonly edges: number;
  };
  readonly payloadHashes: {
    readonly nodes: string;
    readonly edges: string;
  };
}

export function buildQueryIndexRecordBundle(
  source: LoadedQueryIndexSource,
): QueryIndexRecordBundle {
  const nodes: QueryIndexIndexedNode[] = [];
  const edges: QueryIndexIndexedEdge[] = [];
  const topologySnapshotId = source.topology.projection.snapshot.snapshotId;
  for (const node of source.topology.projection.nodes)
    nodes.push(
      indexedNode(
        source.indexBuildId,
        "PROJECT_TOPOLOGY",
        topologySnapshotId,
        node.nodeId,
        node.nodeType,
        node,
      ),
    );
  for (const edge of source.topology.projection.edges)
    edges.push(
      indexedEdge(
        source.indexBuildId,
        "PROJECT_TOPOLOGY",
        topologySnapshotId,
        edge.edgeId,
        edge.edgeType,
        edge.relationLayer,
        edge.fromNodeId,
        edge.toNodeId,
        edge,
      ),
    );
  for (const field of source.fieldEvidence) {
    const snapshotId = field.projection.snapshot.snapshotId;
    for (const node of field.projection.nodes)
      nodes.push(
        indexedNode(
          source.indexBuildId,
          "FIELD_EVIDENCE",
          snapshotId,
          node.nodeId,
          node.nodeType,
          node,
        ),
      );
    for (const edge of field.projection.edges)
      edges.push(
        indexedEdge(
          source.indexBuildId,
          "FIELD_EVIDENCE",
          snapshotId,
          edge.edgeId,
          edge.edgeType,
          edge.relationLayer,
          edge.fromNodeId,
          edge.toNodeId,
          edge,
        ),
      );
  }
  for (const causal of source.targetCausalOverlays) {
    const snapshotId = causal.projection.snapshot.snapshotId;
    for (const node of causal.projection.nodes)
      nodes.push(
        indexedNode(
          source.indexBuildId,
          "TARGET_CAUSAL_OVERLAY",
          snapshotId,
          node.nodeId,
          node.nodeType,
          node,
        ),
      );
    for (const edge of causal.projection.edges)
      edges.push(
        indexedEdge(
          source.indexBuildId,
          "TARGET_CAUSAL_OVERLAY",
          snapshotId,
          edge.edgeId,
          edge.edgeType,
          edge.relationLayer,
          edge.fromNodeId,
          edge.toNodeId,
          edge,
        ),
      );
  }
  nodes.sort(compareIndexedRecords);
  edges.sort(compareIndexedRecords);
  const projections: QueryIndexBuildProjection[] = [
    {
      projectionKind: "PROJECT_TOPOLOGY",
      projectionSnapshotId: source.descriptor.topology.snapshotId,
      snapshotJson: canonicalJson(source.topology.projection.snapshot),
      snapshotFileSha256: source.descriptor.topology.files.snapshot.sha256,
      counts: source.descriptor.topology.counts,
    },
    ...source.descriptor.fieldEvidence.map((field, index) => ({
      projectionKind: "FIELD_EVIDENCE" as const,
      projectionSnapshotId: field.snapshotId,
      snapshotJson: canonicalJson(
        source.fieldEvidence[index]!.projection.snapshot,
      ),
      snapshotFileSha256: field.files.snapshot.sha256,
      counts: field.counts,
    })),
    ...(source.descriptor.targetCausalOverlays ?? []).map((causal, index) => ({
      projectionKind: "TARGET_CAUSAL_OVERLAY" as const,
      projectionSnapshotId: causal.snapshotId,
      snapshotJson: canonicalJson(
        source.targetCausalOverlays[index]!.projection.snapshot,
      ),
      snapshotFileSha256: causal.files.snapshot.sha256,
      counts: causal.counts,
    })),
  ];
  return {
    nodes,
    edges,
    projections,
    expectedCounts: { nodes: nodes.length, edges: edges.length },
    payloadHashes: {
      nodes: payloadHash(nodes),
      edges: payloadHash(edges),
    },
  };
}

function indexedNode(
  indexBuildId: string,
  projectionKind: QueryIndexProjectionKind,
  projectionSnapshotId: string,
  canonicalNodeId: string,
  nodeType: string,
  record: unknown,
): QueryIndexIndexedNode {
  const recordJson = canonicalJson(record);
  return {
    key: {
      indexBuildId,
      projectionKind,
      projectionSnapshotId,
      recordType: "NODE",
      canonicalRecordId: canonicalNodeId,
    },
    canonicalNodeId,
    nodeType,
    recordJson,
    recordHash: sha256(recordJson),
  };
}

function indexedEdge(
  indexBuildId: string,
  projectionKind: QueryIndexProjectionKind,
  projectionSnapshotId: string,
  canonicalEdgeId: string,
  edgeType: string,
  relationLayer: string,
  fromCanonicalNodeId: string,
  toCanonicalNodeId: string,
  record: unknown,
): QueryIndexIndexedEdge {
  const recordJson = canonicalJson(record);
  return {
    key: {
      indexBuildId,
      projectionKind,
      projectionSnapshotId,
      recordType: "EDGE",
      canonicalRecordId: canonicalEdgeId,
    },
    canonicalEdgeId,
    edgeType,
    relationLayer,
    fromCanonicalNodeId,
    toCanonicalNodeId,
    recordJson,
    recordHash: sha256(recordJson),
  };
}

function compareIndexedRecords(
  left: QueryIndexIndexedNode | QueryIndexIndexedEdge,
  right: QueryIndexIndexedNode | QueryIndexIndexedEdge,
): number {
  return compareText(canonicalJson(left.key), canonicalJson(right.key));
}

function payloadHash(
  records: readonly (QueryIndexIndexedNode | QueryIndexIndexedEdge)[],
): string {
  return sha256(canonicalJson(records.map(({ recordJson }) => recordJson)));
}

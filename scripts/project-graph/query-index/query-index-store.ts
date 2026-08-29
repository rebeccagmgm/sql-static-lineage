import type {
  QueryIndexBuildState,
  QueryIndexEdgeRecordKey,
  QueryIndexNodeRecordKey,
  QueryIndexProjectionCounts,
  QueryIndexProjectionKind,
  QueryIndexSourceDescriptorV1,
} from "./query-index-contract.ts";

export type QueryIndexGateState = "PENDING" | "PASSED" | "FAILED";

export interface QueryIndexBuildProjection {
  readonly projectionKind: QueryIndexProjectionKind;
  readonly projectionSnapshotId: string;
  readonly snapshotJson: string;
  readonly snapshotFileSha256: string;
  readonly counts: QueryIndexProjectionCounts;
}

export interface QueryIndexBuildMetadata {
  readonly indexBuildId: string;
  readonly projectKey: string;
  readonly sourceDescriptorHash: string;
  readonly sourceDescriptor: QueryIndexSourceDescriptorV1;
  readonly state: QueryIndexBuildState;
  readonly projections: readonly QueryIndexBuildProjection[];
  readonly expectedCounts: {
    readonly nodes: number;
    readonly edges: number;
  };
  readonly validationState: QueryIndexGateState;
  readonly parityState: QueryIndexGateState;
  readonly parityReportContentHash: string | null;
  readonly failureCode: string | null;
}

export interface QueryIndexStagedBuildInput {
  readonly indexBuildId: string;
  readonly projectKey: string;
  readonly sourceDescriptorHash: string;
  readonly sourceDescriptor: QueryIndexSourceDescriptorV1;
  readonly projections: readonly QueryIndexBuildProjection[];
  readonly expectedCounts: {
    readonly nodes: number;
    readonly edges: number;
  };
}

export interface QueryIndexIndexedNode {
  readonly key: QueryIndexNodeRecordKey;
  readonly canonicalNodeId: string;
  readonly nodeType: string;
  readonly recordJson: string;
  readonly recordHash: string;
}

export interface QueryIndexIndexedEdge {
  readonly key: QueryIndexEdgeRecordKey;
  readonly canonicalEdgeId: string;
  readonly edgeType: string;
  readonly relationLayer: string;
  readonly fromCanonicalNodeId: string;
  readonly toCanonicalNodeId: string;
  readonly recordJson: string;
  readonly recordHash: string;
}

export interface QueryIndexRecordSelection {
  readonly indexBuildId: string;
  readonly projectionKind: QueryIndexProjectionKind;
  readonly projectionSnapshotId: string;
  readonly canonicalRecordIds?: readonly string[];
  readonly recordKinds?: readonly string[];
  readonly fromCanonicalNodeIds?: readonly string[];
  readonly toCanonicalNodeIds?: readonly string[];
  readonly offset?: number;
  readonly limit: number;
}

export interface QueryIndexRecordCounts {
  readonly nodes: number;
  readonly edges: number;
  readonly uniqueNodeKeys: number;
  readonly uniqueEdgeKeys: number;
  readonly unresolvedEdgeEndpoints: number;
  readonly nodePayloadHash: string;
  readonly edgePayloadHash: string;
}

export interface QueryIndexActivationResult {
  readonly previousCurrentBuildId: string | null;
  readonly currentBuild: QueryIndexBuildMetadata;
}

export interface QueryIndexStore {
  setupSchema(): Promise<void>;
  beginStagedBuild(input: QueryIndexStagedBuildInput): Promise<{
    readonly status: "CREATED" | "REUSED";
    readonly build: QueryIndexBuildMetadata;
  }>;
  writeNodes(
    indexBuildId: string,
    nodes: readonly QueryIndexIndexedNode[],
  ): Promise<void>;
  writeEdges(
    indexBuildId: string,
    edges: readonly QueryIndexIndexedEdge[],
  ): Promise<void>;
  readBuild(indexBuildId: string): Promise<QueryIndexBuildMetadata | null>;
  readBuildRecordCounts(indexBuildId: string): Promise<QueryIndexRecordCounts>;
  readNodes(
    selection: QueryIndexRecordSelection,
  ): Promise<readonly QueryIndexIndexedNode[]>;
  readEdges(
    selection: QueryIndexRecordSelection,
  ): Promise<readonly QueryIndexIndexedEdge[]>;
  recordValidation(
    indexBuildId: string,
    state: Exclude<QueryIndexGateState, "PENDING">,
    failureCode?: string,
  ): Promise<QueryIndexBuildMetadata>;
  recordParity(
    indexBuildId: string,
    state: Exclude<QueryIndexGateState, "PENDING">,
    parityReportContentHash: string,
    failureCode?: string,
  ): Promise<QueryIndexBuildMetadata>;
  markBuildFailed(
    indexBuildId: string,
    failureCode: string,
  ): Promise<QueryIndexBuildMetadata>;
  activateReadyBuild(input: {
    readonly projectKey: string;
    readonly indexBuildId: string;
    readonly sourceDescriptorHash: string;
  }): Promise<QueryIndexActivationResult>;
  resolveCurrentBuild(
    projectKey: string,
  ): Promise<QueryIndexBuildMetadata | null>;
  cleanupBuild(input: {
    readonly projectKey: string;
    readonly indexBuildId: string;
  }): Promise<boolean>;
  close(): Promise<void>;
}

import {
  canonicalJson,
  sha256,
} from "../../machine-facts/machine-facts-contract.ts";
import { compareText } from "../contracts/project-topology-contract.ts";
import {
  queryIndexProjectionRecordKeyHash,
  type QueryIndexProjectionRecordKey,
} from "./query-index-contract.ts";
import type {
  QueryIndexActivationResult,
  QueryIndexBuildMetadata,
  QueryIndexGateState,
  QueryIndexIndexedEdge,
  QueryIndexIndexedNode,
  QueryIndexRecordCounts,
  QueryIndexRecordSelection,
  QueryIndexStagedBuildInput,
  QueryIndexStore,
} from "./query-index-store.ts";

export type InMemoryQueryIndexFailureOperation =
  | "BEGIN"
  | "WRITE_NODES"
  | "WRITE_EDGES"
  | "VALIDATION"
  | "PARITY"
  | "ACTIVATE"
  | "CLEANUP";

interface MutableBuild {
  metadata: QueryIndexBuildMetadata;
  readonly nodes: Map<string, QueryIndexIndexedNode>;
  readonly edges: Map<string, QueryIndexIndexedEdge>;
}

export class InMemoryQueryIndexStore implements QueryIndexStore {
  private readonly builds = new Map<string, MutableBuild>();
  private readonly currentByProject = new Map<string, string>();
  private readonly failures = new Set<InMemoryQueryIndexFailureOperation>();

  async setupSchema(): Promise<void> {}

  failNext(operation: InMemoryQueryIndexFailureOperation): void {
    this.failures.add(operation);
  }

  /** Test-only fault injection for a pointer whose build does not exist. */
  setDanglingCurrentPointer(projectKey: string, indexBuildId: string): void {
    this.currentByProject.set(projectKey, indexBuildId);
  }

  /** Test-only fault injection for a READY build that is no longer current. */
  clearCurrentPointer(projectKey: string): void {
    this.currentByProject.delete(projectKey);
  }

  async beginStagedBuild(input: QueryIndexStagedBuildInput): Promise<{
    readonly status: "CREATED" | "REUSED";
    readonly build: QueryIndexBuildMetadata;
  }> {
    this.maybeFail("BEGIN");
    const existing = this.builds.get(input.indexBuildId);
    if (existing !== undefined) {
      if (!sameBuildIdentity(existing.metadata, input))
        throw new Error(
          `QUERY_INDEX_BUILD_IDENTITY_CONFLICT:${input.indexBuildId}`,
        );
      return { status: "REUSED", build: existing.metadata };
    }
    const metadata: QueryIndexBuildMetadata = {
      ...input,
      state: "STAGING",
      validationState: "PENDING",
      parityState: "PENDING",
      parityReportContentHash: null,
      failureCode: null,
    };
    this.builds.set(input.indexBuildId, {
      metadata,
      nodes: new Map(),
      edges: new Map(),
    });
    return { status: "CREATED", build: metadata };
  }

  async writeNodes(
    indexBuildId: string,
    nodes: readonly QueryIndexIndexedNode[],
  ): Promise<void> {
    this.maybeFail("WRITE_NODES");
    const build = this.requireWritableBuild(indexBuildId);
    for (const node of nodes) {
      assertRecordBuild(node.key, indexBuildId, "NODE");
      assertRecordHash(node.recordJson, node.recordHash);
      const key = queryIndexProjectionRecordKeyHash(node.key);
      const existing = build.nodes.get(key);
      if (
        existing !== undefined &&
        canonicalJson(existing) !== canonicalJson(node)
      )
        throw new Error(`QUERY_INDEX_NODE_IMMUTABLE_CONFLICT:${key}`);
      build.nodes.set(key, node);
    }
  }

  async writeEdges(
    indexBuildId: string,
    edges: readonly QueryIndexIndexedEdge[],
  ): Promise<void> {
    this.maybeFail("WRITE_EDGES");
    const build = this.requireWritableBuild(indexBuildId);
    for (const edge of edges) {
      assertRecordBuild(edge.key, indexBuildId, "EDGE");
      assertRecordHash(edge.recordJson, edge.recordHash);
      if (
        !hasEndpoint(build, edge, edge.fromCanonicalNodeId) ||
        !hasEndpoint(build, edge, edge.toCanonicalNodeId)
      )
        throw new Error(
          `QUERY_INDEX_EDGE_ENDPOINT_MISSING:${edge.canonicalEdgeId}`,
        );
      const key = queryIndexProjectionRecordKeyHash(edge.key);
      const existing = build.edges.get(key);
      if (
        existing !== undefined &&
        canonicalJson(existing) !== canonicalJson(edge)
      )
        throw new Error(`QUERY_INDEX_EDGE_IMMUTABLE_CONFLICT:${key}`);
      build.edges.set(key, edge);
    }
  }

  async readBuild(
    indexBuildId: string,
  ): Promise<QueryIndexBuildMetadata | null> {
    return this.builds.get(indexBuildId)?.metadata ?? null;
  }

  async readBuildRecordCounts(
    indexBuildId: string,
  ): Promise<QueryIndexRecordCounts> {
    const build = this.requireBuild(indexBuildId);
    const nodes = sortedValues(build.nodes);
    const edges = sortedValues(build.edges);
    return {
      nodes: nodes.length,
      edges: edges.length,
      uniqueNodeKeys: new Set(nodes.map(({ key }) => keyString(key))).size,
      uniqueEdgeKeys: new Set(edges.map(({ key }) => keyString(key))).size,
      unresolvedEdgeEndpoints: edges.filter(
        (edge) =>
          !hasEndpoint(build, edge, edge.fromCanonicalNodeId) ||
          !hasEndpoint(build, edge, edge.toCanonicalNodeId),
      ).length,
      nodePayloadHash: sha256(
        canonicalJson(nodes.map(({ recordJson }) => recordJson)),
      ),
      edgePayloadHash: sha256(
        canonicalJson(edges.map(({ recordJson }) => recordJson)),
      ),
    };
  }

  async readNodes(
    selection: QueryIndexRecordSelection,
  ): Promise<readonly QueryIndexIndexedNode[]> {
    const build = this.requireBuild(selection.indexBuildId);
    return selectRecords(
      sortedValues(build.nodes).filter(
        (node) =>
          matchesProjection(node.key, selection) &&
          matchesSet(node.canonicalNodeId, selection.canonicalRecordIds) &&
          matchesSet(node.nodeType, selection.recordKinds),
      ),
      selection,
    );
  }

  async readEdges(
    selection: QueryIndexRecordSelection,
  ): Promise<readonly QueryIndexIndexedEdge[]> {
    const build = this.requireBuild(selection.indexBuildId);
    return selectRecords(
      sortedValues(build.edges).filter(
        (edge) =>
          matchesProjection(edge.key, selection) &&
          matchesSet(edge.canonicalEdgeId, selection.canonicalRecordIds) &&
          matchesSet(edge.edgeType, selection.recordKinds) &&
          matchesSet(
            edge.fromCanonicalNodeId,
            selection.fromCanonicalNodeIds,
          ) &&
          matchesSet(edge.toCanonicalNodeId, selection.toCanonicalNodeIds),
      ),
      selection,
    );
  }

  async recordValidation(
    indexBuildId: string,
    state: Exclude<QueryIndexGateState, "PENDING">,
    failureCode?: string,
  ): Promise<QueryIndexBuildMetadata> {
    this.maybeFail("VALIDATION");
    return this.updateGate(indexBuildId, "validationState", state, failureCode);
  }

  async recordParity(
    indexBuildId: string,
    state: Exclude<QueryIndexGateState, "PENDING">,
    parityReportContentHash: string,
    failureCode?: string,
  ): Promise<QueryIndexBuildMetadata> {
    this.maybeFail("PARITY");
    if (!/^[0-9a-f]{64}$/u.test(parityReportContentHash))
      throw new Error("QUERY_INDEX_PARITY_REPORT_HASH_INVALID");
    const metadata = this.updateGate(
      indexBuildId,
      "parityState",
      state,
      failureCode,
    );
    return this.replaceMetadata(indexBuildId, {
      ...metadata,
      parityReportContentHash,
    });
  }

  async markBuildFailed(
    indexBuildId: string,
    failureCode: string,
  ): Promise<QueryIndexBuildMetadata> {
    const build = this.requireBuild(indexBuildId);
    return this.replaceMetadata(indexBuildId, {
      ...build.metadata,
      state: "FAILED",
      failureCode: boundedFailureCode(failureCode),
    });
  }

  async activateReadyBuild(input: {
    readonly projectKey: string;
    readonly indexBuildId: string;
    readonly sourceDescriptorHash: string;
  }): Promise<QueryIndexActivationResult> {
    const build = this.requireBuild(input.indexBuildId);
    if (
      build.metadata.projectKey !== input.projectKey ||
      build.metadata.sourceDescriptorHash !== input.sourceDescriptorHash
    )
      throw new Error(
        `QUERY_INDEX_ACTIVATION_SOURCE_MISMATCH:${input.indexBuildId}`,
      );
    if (
      build.metadata.state === "FAILED" ||
      build.metadata.validationState !== "PASSED" ||
      build.metadata.parityState !== "PASSED" ||
      build.metadata.parityReportContentHash === null
    )
      throw new Error(
        `QUERY_INDEX_ACTIVATION_GATES_INCOMPLETE:${input.indexBuildId}`,
      );
    this.maybeFail("ACTIVATE");
    const previousCurrentBuildId =
      this.currentByProject.get(input.projectKey) ?? null;
    const currentBuild = this.replaceMetadata(input.indexBuildId, {
      ...build.metadata,
      state: "READY",
      failureCode: null,
    });
    this.currentByProject.set(input.projectKey, input.indexBuildId);
    return { previousCurrentBuildId, currentBuild };
  }

  async resolveCurrentBuild(
    projectKey: string,
  ): Promise<QueryIndexBuildMetadata | null> {
    const buildId = this.currentByProject.get(projectKey);
    if (buildId === undefined) return null;
    const build = this.builds.get(buildId);
    if (
      build === undefined ||
      build.metadata.projectKey !== projectKey ||
      build.metadata.state !== "READY"
    )
      return null;
    return build.metadata;
  }

  async cleanupBuild(input: {
    readonly projectKey: string;
    readonly indexBuildId: string;
  }): Promise<boolean> {
    this.maybeFail("CLEANUP");
    const build = this.builds.get(input.indexBuildId);
    if (build === undefined) return false;
    if (build.metadata.projectKey !== input.projectKey)
      throw new Error(
        `QUERY_INDEX_CLEANUP_PROJECT_MISMATCH:${input.indexBuildId}`,
      );
    if (this.currentByProject.get(input.projectKey) === input.indexBuildId)
      throw new Error(
        `QUERY_INDEX_CLEANUP_CURRENT_FORBIDDEN:${input.indexBuildId}`,
      );
    return this.builds.delete(input.indexBuildId);
  }

  async close(): Promise<void> {}

  private updateGate(
    indexBuildId: string,
    key: "validationState" | "parityState",
    state: Exclude<QueryIndexGateState, "PENDING">,
    failureCode?: string,
  ): QueryIndexBuildMetadata {
    const build = this.requireWritableBuild(indexBuildId);
    return this.replaceMetadata(indexBuildId, {
      ...build.metadata,
      [key]: state,
      failureCode:
        state === "FAILED"
          ? boundedFailureCode(failureCode ?? `QUERY_INDEX_${key}_FAILED`)
          : build.metadata.failureCode,
    });
  }

  private replaceMetadata(
    indexBuildId: string,
    metadata: QueryIndexBuildMetadata,
  ): QueryIndexBuildMetadata {
    const build = this.requireBuild(indexBuildId);
    build.metadata = metadata;
    return metadata;
  }

  private requireBuild(indexBuildId: string): MutableBuild {
    const build = this.builds.get(indexBuildId);
    if (build === undefined)
      throw new Error(`QUERY_INDEX_BUILD_NOT_FOUND:${indexBuildId}`);
    return build;
  }

  private requireWritableBuild(indexBuildId: string): MutableBuild {
    const build = this.requireBuild(indexBuildId);
    if (build.metadata.state !== "STAGING")
      throw new Error(`QUERY_INDEX_BUILD_NOT_STAGING:${indexBuildId}`);
    return build;
  }

  private maybeFail(operation: InMemoryQueryIndexFailureOperation): void {
    if (!this.failures.delete(operation)) return;
    throw new Error(`QUERY_INDEX_SIMULATED_${operation}_FAILURE`);
  }
}

function sameBuildIdentity(
  metadata: QueryIndexBuildMetadata,
  input: QueryIndexStagedBuildInput,
): boolean {
  return (
    metadata.projectKey === input.projectKey &&
    metadata.sourceDescriptorHash === input.sourceDescriptorHash &&
    canonicalJson(metadata.sourceDescriptor) ===
      canonicalJson(input.sourceDescriptor) &&
    canonicalJson(metadata.projections) === canonicalJson(input.projections) &&
    canonicalJson(metadata.expectedCounts) ===
      canonicalJson(input.expectedCounts)
  );
}

function assertRecordBuild(
  key: QueryIndexProjectionRecordKey,
  indexBuildId: string,
  recordType: "NODE" | "EDGE",
): void {
  if (key.indexBuildId !== indexBuildId || key.recordType !== recordType)
    throw new Error("QUERY_INDEX_RECORD_KEY_SCOPE_INVALID");
}

function assertRecordHash(recordJson: string, recordHash: string): void {
  if (sha256(recordJson) !== recordHash)
    throw new Error("QUERY_INDEX_RECORD_HASH_INVALID");
}

function hasEndpoint(
  build: MutableBuild,
  edge: QueryIndexIndexedEdge,
  canonicalNodeId: string,
): boolean {
  return [...build.nodes.values()].some(
    (node) =>
      node.key.projectionKind === edge.key.projectionKind &&
      node.key.projectionSnapshotId === edge.key.projectionSnapshotId &&
      node.canonicalNodeId === canonicalNodeId,
  );
}

function matchesProjection(
  key: QueryIndexProjectionRecordKey,
  selection: QueryIndexRecordSelection,
): boolean {
  return (
    key.projectionKind === selection.projectionKind &&
    key.projectionSnapshotId === selection.projectionSnapshotId
  );
}

function matchesSet(value: string, values?: readonly string[]): boolean {
  return values === undefined || values.includes(value);
}

function selectRecords<T>(
  records: readonly T[],
  selection: QueryIndexRecordSelection,
): readonly T[] {
  if (!Number.isSafeInteger(selection.limit) || selection.limit < 1)
    throw new Error("QUERY_INDEX_READ_LIMIT_INVALID");
  const offset = selection.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new Error("QUERY_INDEX_READ_OFFSET_INVALID");
  return records.slice(offset, offset + selection.limit);
}

function sortedValues<
  T extends { readonly key: QueryIndexProjectionRecordKey },
>(values: ReadonlyMap<string, T>): T[] {
  return [...values.values()].sort((left, right) =>
    compareText(keyString(left.key), keyString(right.key)),
  );
}

function keyString(key: QueryIndexProjectionRecordKey): string {
  return canonicalJson(key);
}

function boundedFailureCode(value: string): string {
  const normalized = value.replace(/[^A-Z0-9_:-]/giu, "_");
  return normalized.slice(0, 160) || "QUERY_INDEX_FAILURE";
}

import type { Driver, ManagedTransaction } from "neo4j-driver";

import { canonicalJson, sha256 } from "../../contracts/runtime.ts";
import { compareText } from "../contracts/project-topology-contract.ts";
import {
  QUERY_INDEX_SCHEMA_VERSION,
  queryIndexBuildId,
  queryIndexProjectionRecordKeyHash,
  queryIndexSourceDescriptorHash,
  validateQueryIndexSourceDescriptor,
  type QueryIndexEdgeRecordKey,
  type QueryIndexNodeRecordKey,
  type QueryIndexProjectionRecordKey,
} from "./query-index-contract.ts";
import { boundedNeo4jConnectionError } from "./neo4j-query-index-connection.ts";
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

export const QUERY_INDEX_LABELS = Object.freeze([
  "SLQueryIndexProject",
  "SLQueryIndexBuild",
  "SLIndexedNode",
] as const);

export const QUERY_INDEX_RELATIONSHIP_TYPES = Object.freeze([
  "SL_HAS_INDEX_BUILD",
  "SL_CURRENT_INDEX",
  "SL_HAS_INDEXED_NODE",
  "SL_INDEX_EDGE",
] as const);

export const QUERY_INDEX_SCHEMA_STATEMENTS = Object.freeze([
  "CREATE CONSTRAINT sl_query_index_project_key IF NOT EXISTS FOR (p:SLQueryIndexProject) REQUIRE p.projectKey IS UNIQUE",
  "CREATE CONSTRAINT sl_query_index_build_id IF NOT EXISTS FOR (b:SLQueryIndexBuild) REQUIRE b.indexBuildId IS UNIQUE",
  "CREATE CONSTRAINT sl_query_index_node_record_key IF NOT EXISTS FOR (n:SLIndexedNode) REQUIRE n.recordKey IS UNIQUE",
  "CREATE INDEX sl_query_index_build_project IF NOT EXISTS FOR (b:SLQueryIndexBuild) ON (b.projectKey, b.state)",
  "CREATE INDEX sl_query_index_node_lookup IF NOT EXISTS FOR (n:SLIndexedNode) ON (n.indexBuildId, n.projectionKind, n.projectionSnapshotId, n.canonicalNodeId)",
] as const);

export interface BoundedTopologyPathQuery {
  readonly indexBuildId: string;
  readonly projectionSnapshotId: string;
  readonly startNodeId: string;
  readonly maxHops: number;
  readonly limit: number;
}

export interface BoundedTopologyPath {
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
}

export class Neo4jQueryIndexStore implements QueryIndexStore {
  constructor(
    private readonly driver: Driver,
    private readonly database: string,
  ) {}

  async setupSchema(): Promise<void> {
    await this.write("SCHEMA_SETUP", async (transaction) => {
      for (const statement of QUERY_INDEX_SCHEMA_STATEMENTS)
        await transaction.run(statement);
    });
  }

  async beginStagedBuild(input: QueryIndexStagedBuildInput): Promise<{
    readonly status: "CREATED" | "REUSED";
    readonly build: QueryIndexBuildMetadata;
  }> {
    assertStagedBuildInput(input);
    return this.write("BEGIN_STAGING", async (transaction) => {
      const existing = await transaction.run(
        "MATCH (b:SLQueryIndexBuild {indexBuildId: $indexBuildId}) RETURN b",
        { indexBuildId: input.indexBuildId },
      );
      if (existing.records.length > 1)
        throw new Error(
          `QUERY_INDEX_BUILD_ID_NOT_UNIQUE:${input.indexBuildId}`,
        );
      if (existing.records.length === 1) {
        const metadata = buildMetadata(existing.records[0]?.get("b"));
        if (!sameBuildIdentity(metadata, input))
          throw new Error(
            `QUERY_INDEX_BUILD_IDENTITY_CONFLICT:${input.indexBuildId}`,
          );
        await assertBuildOwnership(
          transaction,
          input.projectKey,
          input.indexBuildId,
        );
        return { status: "REUSED", build: metadata };
      }
      const metadata = stagedMetadata(input);
      const created = await transaction.run(
        `MERGE (p:SLQueryIndexProject {projectKey: $projectKey})
         CREATE (b:SLQueryIndexBuild {
           indexBuildId: $indexBuildId,
           projectKey: $projectKey,
           sourceDescriptorHash: $sourceDescriptorHash,
           sourceDescriptorJson: $sourceDescriptorJson,
           projectionsJson: $projectionsJson,
           expectedCountsJson: $expectedCountsJson,
           state: $state,
           validationState: $validationState,
           parityState: $parityState,
           parityReportContentHash: $parityReportContentHash,
           failureCode: $failureCode,
           schemaVersion: $schemaVersion
         })
         CREATE (p)-[:SL_HAS_INDEX_BUILD]->(b)
         RETURN b`,
        metadataParameters(metadata),
      );
      if (created.records.length !== 1)
        throw new Error(
          `QUERY_INDEX_BUILD_CREATE_FAILED:${input.indexBuildId}`,
        );
      return {
        status: "CREATED",
        build: buildMetadata(created.records[0]?.get("b")),
      };
    });
  }

  async writeNodes(
    indexBuildId: string,
    nodes: readonly QueryIndexIndexedNode[],
  ): Promise<void> {
    if (nodes.length === 0) return;
    const rows = nodes.map((node) => nodeRow(indexBuildId, node));
    assertUniqueRows(rows, "QUERY_INDEX_NODE_BATCH_DUPLICATE");
    await this.write("WRITE_NODES", async (transaction) => {
      const result = await transaction.run(
        `MATCH (b:SLQueryIndexBuild {indexBuildId: $indexBuildId, state: 'STAGING'})
         UNWIND $rows AS row
         MERGE (n:SLIndexedNode {recordKey: row.recordKey})
         ON CREATE SET
           n.indexBuildId = row.indexBuildId,
           n.projectionKind = row.projectionKind,
           n.projectionSnapshotId = row.projectionSnapshotId,
           n.canonicalNodeId = row.canonicalNodeId,
           n.nodeType = row.nodeType,
           n.recordJson = row.recordJson,
           n.recordHash = row.recordHash,
           n.schemaVersion = $schemaVersion
         WITH b, n, row
         WHERE n.indexBuildId = row.indexBuildId
           AND n.projectionKind = row.projectionKind
           AND n.projectionSnapshotId = row.projectionSnapshotId
           AND n.canonicalNodeId = row.canonicalNodeId
           AND n.nodeType = row.nodeType
           AND n.recordJson = row.recordJson
           AND n.recordHash = row.recordHash
         MERGE (b)-[:SL_HAS_INDEXED_NODE]->(n)
         RETURN count(n) AS written`,
        { indexBuildId, rows, schemaVersion: QUERY_INDEX_SCHEMA_VERSION },
      );
      if (countValue(result.records[0]?.get("written")) !== rows.length)
        throw new Error(`QUERY_INDEX_NODE_BATCH_CONFLICT:${indexBuildId}`);
    });
  }

  async writeEdges(
    indexBuildId: string,
    edges: readonly QueryIndexIndexedEdge[],
  ): Promise<void> {
    if (edges.length === 0) return;
    const rows = edges.map((edge) => edgeRow(indexBuildId, edge));
    assertUniqueRows(rows, "QUERY_INDEX_EDGE_BATCH_DUPLICATE");
    await this.write("WRITE_EDGES", async (transaction) => {
      const result = await transaction.run(
        `MATCH (b:SLQueryIndexBuild {indexBuildId: $indexBuildId, state: 'STAGING'})
         UNWIND $rows AS row
         MATCH (from:SLIndexedNode {recordKey: row.fromRecordKey})
         MATCH (to:SLIndexedNode {recordKey: row.toRecordKey})
         WHERE from.indexBuildId = $indexBuildId
           AND to.indexBuildId = $indexBuildId
         MERGE (from)-[r:SL_INDEX_EDGE {recordKey: row.recordKey}]->(to)
         ON CREATE SET
           r.indexBuildId = row.indexBuildId,
           r.projectionKind = row.projectionKind,
           r.projectionSnapshotId = row.projectionSnapshotId,
           r.canonicalEdgeId = row.canonicalEdgeId,
           r.edgeType = row.edgeType,
           r.relationLayer = row.relationLayer,
           r.fromCanonicalNodeId = row.fromCanonicalNodeId,
           r.toCanonicalNodeId = row.toCanonicalNodeId,
           r.recordJson = row.recordJson,
           r.recordHash = row.recordHash,
           r.schemaVersion = $schemaVersion
         WITH r, row
         WHERE r.indexBuildId = row.indexBuildId
           AND r.projectionKind = row.projectionKind
           AND r.projectionSnapshotId = row.projectionSnapshotId
           AND r.canonicalEdgeId = row.canonicalEdgeId
           AND r.edgeType = row.edgeType
           AND r.relationLayer = row.relationLayer
           AND r.fromCanonicalNodeId = row.fromCanonicalNodeId
           AND r.toCanonicalNodeId = row.toCanonicalNodeId
           AND r.recordJson = row.recordJson
           AND r.recordHash = row.recordHash
         RETURN count(r) AS written`,
        { indexBuildId, rows, schemaVersion: QUERY_INDEX_SCHEMA_VERSION },
      );
      if (countValue(result.records[0]?.get("written")) !== rows.length)
        throw new Error(`QUERY_INDEX_EDGE_BATCH_CONFLICT:${indexBuildId}`);
    });
  }

  async readBuild(
    indexBuildId: string,
  ): Promise<QueryIndexBuildMetadata | null> {
    return this.read("READ_BUILD", async (transaction) => {
      const result = await transaction.run(
        "MATCH (b:SLQueryIndexBuild {indexBuildId: $indexBuildId}) RETURN b",
        { indexBuildId },
      );
      if (result.records.length === 0) return null;
      if (result.records.length !== 1)
        throw new Error(`QUERY_INDEX_BUILD_ID_NOT_UNIQUE:${indexBuildId}`);
      return buildMetadata(result.records[0]?.get("b"));
    });
  }

  async readBuildRecordCounts(
    indexBuildId: string,
  ): Promise<QueryIndexRecordCounts> {
    return this.read("READ_BUILD_COUNTS", async (transaction) => {
      const nodes = await transaction.run(
        `MATCH (n:SLIndexedNode {indexBuildId: $indexBuildId})
         RETURN n.recordKey AS recordKey,
                n.projectionKind AS projectionKind,
                n.projectionSnapshotId AS projectionSnapshotId,
                n.canonicalNodeId AS canonicalRecordId,
                n.recordJson AS recordJson
         ORDER BY projectionKind, projectionSnapshotId, canonicalRecordId`,
        { indexBuildId },
      );
      const edges = await transaction.run(
        `MATCH (:SLIndexedNode)-[r:SL_INDEX_EDGE {indexBuildId: $indexBuildId}]->(:SLIndexedNode)
         RETURN r.recordKey AS recordKey,
                r.projectionKind AS projectionKind,
                r.projectionSnapshotId AS projectionSnapshotId,
                r.canonicalEdgeId AS canonicalRecordId,
                r.recordJson AS recordJson
         ORDER BY projectionKind, projectionSnapshotId, canonicalRecordId`,
        { indexBuildId },
      );
      const unresolved = await transaction.run(
        `MATCH (from:SLIndexedNode)-[r:SL_INDEX_EDGE {indexBuildId: $indexBuildId}]->(to:SLIndexedNode)
         WHERE from.indexBuildId <> $indexBuildId
            OR to.indexBuildId <> $indexBuildId
            OR from.projectionKind <> r.projectionKind
            OR to.projectionKind <> r.projectionKind
            OR from.projectionSnapshotId <> r.projectionSnapshotId
            OR to.projectionSnapshotId <> r.projectionSnapshotId
         RETURN count(r) AS unresolved`,
        { indexBuildId },
      );
      const nodeRows = canonicalRows(nodes.records, indexBuildId, "NODE");
      const edgeRows = canonicalRows(edges.records, indexBuildId, "EDGE");
      return {
        nodes: nodeRows.length,
        edges: edgeRows.length,
        uniqueNodeKeys: new Set(nodeRows.map(({ recordKey }) => recordKey))
          .size,
        uniqueEdgeKeys: new Set(edgeRows.map(({ recordKey }) => recordKey))
          .size,
        unresolvedEdgeEndpoints: countValue(
          unresolved.records[0]?.get("unresolved"),
        ),
        nodePayloadHash: sha256(
          canonicalJson(nodeRows.map(({ recordJson }) => recordJson)),
        ),
        edgePayloadHash: sha256(
          canonicalJson(edgeRows.map(({ recordJson }) => recordJson)),
        ),
      };
    });
  }

  async readNodes(
    selection: QueryIndexRecordSelection,
  ): Promise<readonly QueryIndexIndexedNode[]> {
    const parameters = selectionParameters(selection);
    return this.read("READ_NODES", async (transaction) => {
      const result = await transaction.run(
        `MATCH (b:SLQueryIndexBuild {indexBuildId: $indexBuildId})-[:SL_HAS_INDEXED_NODE]->(n:SLIndexedNode)
         WHERE n.projectionKind = $projectionKind
           AND n.projectionSnapshotId = $projectionSnapshotId
           AND ($hasRecordIds = false OR n.canonicalNodeId IN $recordIds)
           AND ($hasRecordKinds = false OR n.nodeType IN $recordKinds)
         RETURN n
         ORDER BY n.canonicalNodeId
         SKIP toInteger($offset) LIMIT toInteger($limit)`,
        parameters,
      );
      return result.records.map((record) => indexedNode(record.get("n")));
    });
  }

  async readEdges(
    selection: QueryIndexRecordSelection,
  ): Promise<readonly QueryIndexIndexedEdge[]> {
    const parameters = selectionParameters(selection);
    return this.read("READ_EDGES", async (transaction) => {
      const result = await transaction.run(
        `MATCH (b:SLQueryIndexBuild {indexBuildId: $indexBuildId})-[:SL_HAS_INDEXED_NODE]->(from:SLIndexedNode)
         MATCH (from)-[r:SL_INDEX_EDGE]->(to:SLIndexedNode)
         MATCH (b)-[:SL_HAS_INDEXED_NODE]->(to)
         WHERE r.projectionKind = $projectionKind
           AND r.projectionSnapshotId = $projectionSnapshotId
           AND ($hasRecordIds = false OR r.canonicalEdgeId IN $recordIds)
           AND ($hasRecordKinds = false OR r.edgeType IN $recordKinds)
           AND ($hasFromIds = false OR r.fromCanonicalNodeId IN $fromIds)
           AND ($hasToIds = false OR r.toCanonicalNodeId IN $toIds)
         RETURN r
         ORDER BY r.canonicalEdgeId
         SKIP toInteger($offset) LIMIT toInteger($limit)`,
        parameters,
      );
      return result.records.map((record) => indexedEdge(record.get("r")));
    });
  }

  /**
   * Execute one graph-native, bounded topology traversal. The query returns
   * only path identifiers and never reconstructs the full projection in JS.
   */
  async traceProjectUpstreamGraphNative(
    input: BoundedTopologyPathQuery,
  ): Promise<readonly BoundedTopologyPath[]> {
    const maxHops = boundedInteger(input.maxHops, "maxHops", 1, 32);
    const limit = boundedInteger(input.limit, "limit", 1, 1_000);
    return this.read(
      "TRACE_PROJECT_UPSTREAM_GRAPH_NATIVE",
      async (transaction) => {
        const result = await transaction.run(
          `MATCH p=(start:SLIndexedNode)-[:SL_INDEX_EDGE*1..${maxHops}]->(upstream:SLIndexedNode)
         WHERE start.indexBuildId = $indexBuildId
           AND upstream.indexBuildId = $indexBuildId
           AND start.projectionKind = 'PROJECT_TOPOLOGY'
           AND upstream.projectionKind = 'PROJECT_TOPOLOGY'
           AND start.projectionSnapshotId = $projectionSnapshotId
           AND upstream.projectionSnapshotId = $projectionSnapshotId
           AND start.canonicalNodeId = $startNodeId
           AND ALL(r IN relationships(p) WHERE
             r.indexBuildId = $indexBuildId
             AND r.projectionKind = 'PROJECT_TOPOLOGY'
             AND r.projectionSnapshotId = $projectionSnapshotId
             AND r.edgeType IN ['PRODUCER_BRIDGE', 'SCHEDULE_DEPENDS_ON'])
         RETURN [n IN nodes(p) | n.canonicalNodeId] AS nodeIds,
                [r IN relationships(p) | r.canonicalEdgeId] AS edgeIds
         ORDER BY length(p), nodeIds
         LIMIT toInteger($limit)`,
          {
            indexBuildId: input.indexBuildId,
            projectionSnapshotId: input.projectionSnapshotId,
            startNodeId: input.startNodeId,
            limit,
          },
        );
        return result.records.map((record) => ({
          nodeIds: stringArray(record.get("nodeIds")),
          edgeIds: stringArray(record.get("edgeIds")),
        }));
      },
    );
  }

  async recordValidation(
    indexBuildId: string,
    state: Exclude<QueryIndexGateState, "PENDING">,
    failureCode?: string,
  ): Promise<QueryIndexBuildMetadata> {
    return this.updateGate({
      indexBuildId,
      gateProperty: "validationState",
      state,
      failureCode,
      parityReportContentHash: null,
    });
  }

  async recordParity(
    indexBuildId: string,
    state: Exclude<QueryIndexGateState, "PENDING">,
    parityReportContentHash: string,
    failureCode?: string,
  ): Promise<QueryIndexBuildMetadata> {
    if (!isSha256(parityReportContentHash))
      throw new Error("QUERY_INDEX_PARITY_REPORT_HASH_INVALID");
    return this.updateGate({
      indexBuildId,
      gateProperty: "parityState",
      state,
      failureCode,
      parityReportContentHash,
    });
  }

  async markBuildFailed(
    indexBuildId: string,
    failureCode: string,
  ): Promise<QueryIndexBuildMetadata> {
    return this.write("MARK_FAILED", async (transaction) => {
      const result = await transaction.run(
        `MATCH (b:SLQueryIndexBuild {indexBuildId: $indexBuildId})
         SET b.state = 'FAILED', b.failureCode = $failureCode
         RETURN b`,
        { indexBuildId, failureCode: boundedFailureCode(failureCode) },
      );
      return oneBuild(result.records, indexBuildId);
    });
  }

  async activateReadyBuild(input: {
    readonly projectKey: string;
    readonly indexBuildId: string;
    readonly sourceDescriptorHash: string;
  }): Promise<QueryIndexActivationResult> {
    return this.write("ACTIVATE", async (transaction) => {
      const result = await transaction.run(
        `MATCH (p:SLQueryIndexProject {projectKey: $projectKey})-[:SL_HAS_INDEX_BUILD]->(b:SLQueryIndexBuild {indexBuildId: $indexBuildId})
         WHERE b.projectKey = $projectKey
           AND b.sourceDescriptorHash = $sourceDescriptorHash
           AND b.state <> 'FAILED'
           AND b.validationState = 'PASSED'
           AND b.parityState = 'PASSED'
           AND b.parityReportContentHash IS NOT NULL
         OPTIONAL MATCH (p)-[oldPointer:SL_CURRENT_INDEX]->(oldBuild:SLQueryIndexBuild)
         WITH p, b, collect(oldPointer) AS oldPointers,
              [value IN collect(oldBuild.indexBuildId) WHERE value IS NOT NULL] AS oldBuildIds
         FOREACH (pointer IN oldPointers | DELETE pointer)
         SET b.state = 'READY', b.failureCode = null
         MERGE (p)-[:SL_CURRENT_INDEX]->(b)
         RETURN b, head(oldBuildIds) AS previousCurrentBuildId`,
        input,
      );
      if (result.records.length !== 1)
        throw new Error(
          `QUERY_INDEX_ACTIVATION_GATES_INCOMPLETE:${input.indexBuildId}`,
        );
      return {
        previousCurrentBuildId: nullableString(
          result.records[0]?.get("previousCurrentBuildId"),
        ),
        currentBuild: buildMetadata(result.records[0]?.get("b")),
      };
    });
  }

  async resolveCurrentBuild(
    projectKey: string,
  ): Promise<QueryIndexBuildMetadata | null> {
    return this.read("RESOLVE_CURRENT", async (transaction) => {
      const result = await transaction.run(
        `MATCH (:SLQueryIndexProject {projectKey: $projectKey})-[:SL_CURRENT_INDEX]->(b:SLQueryIndexBuild)
         WHERE b.projectKey = $projectKey AND b.state = 'READY'
         RETURN b ORDER BY b.indexBuildId`,
        { projectKey },
      );
      if (result.records.length === 0) return null;
      if (result.records.length !== 1)
        throw new Error(`QUERY_INDEX_CURRENT_POINTER_CONFLICT:${projectKey}`);
      return buildMetadata(result.records[0]?.get("b"));
    });
  }

  async cleanupBuild(input: {
    readonly projectKey: string;
    readonly indexBuildId: string;
  }): Promise<boolean> {
    return this.write("CLEANUP", async (transaction) => {
      const check = await transaction.run(
        `MATCH (p:SLQueryIndexProject {projectKey: $projectKey})-[:SL_HAS_INDEX_BUILD]->(b:SLQueryIndexBuild {indexBuildId: $indexBuildId})
         OPTIONAL MATCH (p)-[current:SL_CURRENT_INDEX]->(b)
         RETURN b, count(current) AS currentCount`,
        input,
      );
      if (check.records.length === 0) return false;
      if (countValue(check.records[0]?.get("currentCount")) !== 0)
        throw new Error(
          `QUERY_INDEX_CLEANUP_CURRENT_FORBIDDEN:${input.indexBuildId}`,
        );
      await transaction.run(
        `MATCH (n:SLIndexedNode {indexBuildId: $indexBuildId})
         DETACH DELETE n`,
        { indexBuildId: input.indexBuildId },
      );
      const removed = await transaction.run(
        `MATCH (:SLQueryIndexProject {projectKey: $projectKey})-[:SL_HAS_INDEX_BUILD]->(b:SLQueryIndexBuild {indexBuildId: $indexBuildId})
         DETACH DELETE b
         RETURN count(*) AS removed`,
        input,
      );
      return countValue(removed.records[0]?.get("removed")) === 1;
    });
  }

  async close(): Promise<void> {
    try {
      await this.driver.close();
    } catch (error) {
      throw boundedNeo4jConnectionError("CLOSE", error);
    }
  }

  private async updateGate(input: {
    readonly indexBuildId: string;
    readonly gateProperty: "validationState" | "parityState";
    readonly state: Exclude<QueryIndexGateState, "PENDING">;
    readonly failureCode?: string;
    readonly parityReportContentHash: string | null;
  }): Promise<QueryIndexBuildMetadata> {
    const statement =
      input.gateProperty === "validationState"
        ? `MATCH (b:SLQueryIndexBuild {indexBuildId: $indexBuildId, state: 'STAGING'})
           SET b.validationState = $state, b.failureCode = $failureCode
           RETURN b`
        : `MATCH (b:SLQueryIndexBuild {indexBuildId: $indexBuildId, state: 'STAGING'})
           SET b.parityState = $state,
               b.parityReportContentHash = $parityReportContentHash,
               b.failureCode = $failureCode
           RETURN b`;
    return this.write("UPDATE_GATE", async (transaction) => {
      const result = await transaction.run(statement, {
        indexBuildId: input.indexBuildId,
        state: input.state,
        failureCode:
          input.state === "FAILED"
            ? boundedFailureCode(
                input.failureCode ?? "QUERY_INDEX_GATE_VALIDATION_FAILED",
              )
            : null,
        parityReportContentHash: input.parityReportContentHash,
      });
      return oneBuild(result.records, input.indexBuildId);
    });
  }

  private async read<T>(
    operation: string,
    work: (transaction: ManagedTransaction) => Promise<T>,
  ): Promise<T> {
    const session = this.driver.session({ database: this.database });
    try {
      return await session.executeRead(work);
    } catch (error) {
      if (isQueryIndexError(error)) throw error;
      throw boundedNeo4jConnectionError(operation, error);
    } finally {
      await session.close().catch(() => undefined);
    }
  }

  private async write<T>(
    operation: string,
    work: (transaction: ManagedTransaction) => Promise<T>,
  ): Promise<T> {
    const session = this.driver.session({ database: this.database });
    try {
      return await session.executeWrite(work);
    } catch (error) {
      if (isQueryIndexError(error)) throw error;
      throw boundedNeo4jConnectionError(operation, error);
    } finally {
      await session.close().catch(() => undefined);
    }
  }
}

function boundedInteger(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new Error(`QUERY_INDEX_${label.toUpperCase()}_INVALID`);
  return value;
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error("QUERY_INDEX_GRAPH_NATIVE_RESULT_INVALID");
  return value;
}

function assertStagedBuildInput(input: QueryIndexStagedBuildInput): void {
  validateQueryIndexSourceDescriptor(input.sourceDescriptor);
  if (
    input.projectKey !== input.sourceDescriptor.projectKey ||
    input.sourceDescriptorHash !==
      queryIndexSourceDescriptorHash(input.sourceDescriptor) ||
    input.indexBuildId !== queryIndexBuildId(input.sourceDescriptor)
  )
    throw new Error("QUERY_INDEX_STAGED_BUILD_IDENTITY_INVALID");
  if (
    !Number.isSafeInteger(input.expectedCounts.nodes) ||
    !Number.isSafeInteger(input.expectedCounts.edges) ||
    input.expectedCounts.nodes < 0 ||
    input.expectedCounts.edges < 0
  )
    throw new Error("QUERY_INDEX_STAGED_BUILD_COUNTS_INVALID");
}

function stagedMetadata(
  input: QueryIndexStagedBuildInput,
): QueryIndexBuildMetadata {
  return {
    ...input,
    state: "STAGING",
    validationState: "PENDING",
    parityState: "PENDING",
    parityReportContentHash: null,
    failureCode: null,
  };
}

function metadataParameters(
  metadata: QueryIndexBuildMetadata,
): Record<string, unknown> {
  return {
    indexBuildId: metadata.indexBuildId,
    projectKey: metadata.projectKey,
    sourceDescriptorHash: metadata.sourceDescriptorHash,
    sourceDescriptorJson: canonicalJson(metadata.sourceDescriptor),
    projectionsJson: canonicalJson(metadata.projections),
    expectedCountsJson: canonicalJson(metadata.expectedCounts),
    state: metadata.state,
    validationState: metadata.validationState,
    parityState: metadata.parityState,
    parityReportContentHash: metadata.parityReportContentHash,
    failureCode: metadata.failureCode,
    schemaVersion: QUERY_INDEX_SCHEMA_VERSION,
  };
}

async function assertBuildOwnership(
  transaction: ManagedTransaction,
  projectKey: string,
  indexBuildId: string,
): Promise<void> {
  const result = await transaction.run(
    `MATCH (:SLQueryIndexProject {projectKey: $projectKey})-[:SL_HAS_INDEX_BUILD]->(b:SLQueryIndexBuild {indexBuildId: $indexBuildId})
     RETURN count(b) AS owned`,
    { projectKey, indexBuildId },
  );
  if (countValue(result.records[0]?.get("owned")) !== 1)
    throw new Error(`QUERY_INDEX_BUILD_OWNERSHIP_INVALID:${indexBuildId}`);
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

function nodeRow(
  indexBuildId: string,
  node: QueryIndexIndexedNode,
): Record<string, unknown> {
  assertIndexedRecord(indexBuildId, node.key, node.recordJson, node.recordHash);
  return {
    recordKey: queryIndexProjectionRecordKeyHash(node.key),
    indexBuildId,
    projectionKind: node.key.projectionKind,
    projectionSnapshotId: node.key.projectionSnapshotId,
    canonicalNodeId: node.canonicalNodeId,
    nodeType: node.nodeType,
    recordJson: node.recordJson,
    recordHash: node.recordHash,
  };
}

function edgeRow(
  indexBuildId: string,
  edge: QueryIndexIndexedEdge,
): Record<string, unknown> {
  assertIndexedRecord(indexBuildId, edge.key, edge.recordJson, edge.recordHash);
  const endpointKey = (canonicalRecordId: string) =>
    queryIndexProjectionRecordKeyHash({
      indexBuildId,
      projectionKind: edge.key.projectionKind,
      projectionSnapshotId: edge.key.projectionSnapshotId,
      recordType: "NODE",
      canonicalRecordId,
    });
  return {
    recordKey: queryIndexProjectionRecordKeyHash(edge.key),
    fromRecordKey: endpointKey(edge.fromCanonicalNodeId),
    toRecordKey: endpointKey(edge.toCanonicalNodeId),
    indexBuildId,
    projectionKind: edge.key.projectionKind,
    projectionSnapshotId: edge.key.projectionSnapshotId,
    canonicalEdgeId: edge.canonicalEdgeId,
    edgeType: edge.edgeType,
    relationLayer: edge.relationLayer,
    fromCanonicalNodeId: edge.fromCanonicalNodeId,
    toCanonicalNodeId: edge.toCanonicalNodeId,
    recordJson: edge.recordJson,
    recordHash: edge.recordHash,
  };
}

function assertIndexedRecord(
  indexBuildId: string,
  key: QueryIndexProjectionRecordKey,
  recordJson: string,
  recordHash: string,
): void {
  if (key.indexBuildId !== indexBuildId)
    throw new Error("QUERY_INDEX_RECORD_BUILD_MISMATCH");
  if (sha256(recordJson) !== recordHash)
    throw new Error("QUERY_INDEX_RECORD_HASH_INVALID");
}

function assertUniqueRows(
  rows: readonly Record<string, unknown>[],
  code: string,
): void {
  const keys = rows.map((row) => String(row.recordKey));
  if (new Set(keys).size !== keys.length) throw new Error(code);
}

function selectionParameters(
  selection: QueryIndexRecordSelection,
): Record<string, unknown> {
  if (!Number.isSafeInteger(selection.limit) || selection.limit < 1)
    throw new Error("QUERY_INDEX_READ_LIMIT_INVALID");
  const offset = selection.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new Error("QUERY_INDEX_READ_OFFSET_INVALID");
  return {
    indexBuildId: selection.indexBuildId,
    projectionKind: selection.projectionKind,
    projectionSnapshotId: selection.projectionSnapshotId,
    recordIds: selection.canonicalRecordIds ?? [],
    hasRecordIds: selection.canonicalRecordIds !== undefined,
    recordKinds: selection.recordKinds ?? [],
    hasRecordKinds: selection.recordKinds !== undefined,
    fromIds: selection.fromCanonicalNodeIds ?? [],
    hasFromIds: selection.fromCanonicalNodeIds !== undefined,
    toIds: selection.toCanonicalNodeIds ?? [],
    hasToIds: selection.toCanonicalNodeIds !== undefined,
    offset,
    limit: selection.limit,
  };
}

function indexedNode(value: unknown): QueryIndexIndexedNode {
  const properties = entityProperties(value);
  const key = indexedKey(properties, "NODE");
  return {
    key,
    canonicalNodeId: requiredString(properties.canonicalNodeId, "NODE_ID"),
    nodeType: requiredString(properties.nodeType, "NODE_TYPE"),
    recordJson: requiredString(properties.recordJson, "NODE_JSON"),
    recordHash: requiredString(properties.recordHash, "NODE_HASH"),
  };
}

function indexedEdge(value: unknown): QueryIndexIndexedEdge {
  const properties = entityProperties(value);
  const key = indexedKey(properties, "EDGE");
  return {
    key,
    canonicalEdgeId: requiredString(properties.canonicalEdgeId, "EDGE_ID"),
    edgeType: requiredString(properties.edgeType, "EDGE_TYPE"),
    relationLayer: requiredString(properties.relationLayer, "RELATION_LAYER"),
    fromCanonicalNodeId: requiredString(
      properties.fromCanonicalNodeId,
      "FROM_NODE_ID",
    ),
    toCanonicalNodeId: requiredString(
      properties.toCanonicalNodeId,
      "TO_NODE_ID",
    ),
    recordJson: requiredString(properties.recordJson, "EDGE_JSON"),
    recordHash: requiredString(properties.recordHash, "EDGE_HASH"),
  };
}

function indexedKey(
  properties: Record<string, unknown>,
  recordType: "NODE",
): QueryIndexNodeRecordKey;
function indexedKey(
  properties: Record<string, unknown>,
  recordType: "EDGE",
): QueryIndexEdgeRecordKey;
function indexedKey(
  properties: Record<string, unknown>,
  recordType: "NODE" | "EDGE",
): QueryIndexProjectionRecordKey {
  const projectionKind = requiredString(
    properties.projectionKind,
    "PROJECTION",
  );
  if (
    projectionKind !== "PROJECT_TOPOLOGY" &&
    projectionKind !== "FIELD_EVIDENCE" &&
    projectionKind !== "TARGET_CAUSAL_OVERLAY"
  )
    throw new Error("QUERY_INDEX_STORED_PROJECTION_INVALID");
  return {
    indexBuildId: requiredString(properties.indexBuildId, "BUILD_ID"),
    projectionKind,
    projectionSnapshotId: requiredString(
      properties.projectionSnapshotId,
      "SNAPSHOT_ID",
    ),
    recordType,
    canonicalRecordId: requiredString(
      recordType === "NODE"
        ? properties.canonicalNodeId
        : properties.canonicalEdgeId,
      "RECORD_ID",
    ),
  };
}

function buildMetadata(value: unknown): QueryIndexBuildMetadata {
  const properties = entityProperties(value);
  const sourceDescriptor = parseJsonProperty(
    properties.sourceDescriptorJson,
    "SOURCE_DESCRIPTOR",
  ) as QueryIndexBuildMetadata["sourceDescriptor"];
  validateQueryIndexSourceDescriptor(sourceDescriptor);
  const metadata: QueryIndexBuildMetadata = {
    indexBuildId: requiredString(properties.indexBuildId, "BUILD_ID"),
    projectKey: requiredString(properties.projectKey, "PROJECT_KEY"),
    sourceDescriptorHash: requiredString(
      properties.sourceDescriptorHash,
      "SOURCE_HASH",
    ),
    sourceDescriptor,
    state: buildState(properties.state),
    projections: parseJsonProperty(
      properties.projectionsJson,
      "PROJECTIONS",
    ) as QueryIndexBuildMetadata["projections"],
    expectedCounts: parseJsonProperty(
      properties.expectedCountsJson,
      "EXPECTED_COUNTS",
    ) as QueryIndexBuildMetadata["expectedCounts"],
    validationState: gateState(properties.validationState),
    parityState: gateState(properties.parityState),
    parityReportContentHash: nullableString(properties.parityReportContentHash),
    failureCode: nullableString(properties.failureCode),
  };
  if (
    metadata.sourceDescriptor.projectKey !== metadata.projectKey ||
    queryIndexSourceDescriptorHash(metadata.sourceDescriptor) !==
      metadata.sourceDescriptorHash ||
    queryIndexBuildId(metadata.sourceDescriptor) !== metadata.indexBuildId
  )
    throw new Error("QUERY_INDEX_STORED_BUILD_IDENTITY_INVALID");
  return metadata;
}

function oneBuild(
  records: readonly { get(key: string): unknown }[],
  indexBuildId: string,
): QueryIndexBuildMetadata {
  if (records.length !== 1)
    throw new Error(`QUERY_INDEX_BUILD_UPDATE_FAILED:${indexBuildId}`);
  return buildMetadata(records[0]?.get("b"));
}

function entityProperties(value: unknown): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    !("properties" in value) ||
    typeof value.properties !== "object" ||
    value.properties === null
  )
    throw new Error("QUERY_INDEX_STORED_ENTITY_INVALID");
  return value.properties as Record<string, unknown>;
}

function canonicalRows(
  records: readonly { get(key: string): unknown }[],
  indexBuildId: string,
  recordType: "NODE" | "EDGE",
): readonly { readonly recordKey: string; readonly recordJson: string }[] {
  return records
    .map((record) => ({
      recordKey: requiredString(record.get("recordKey"), "RECORD_KEY"),
      recordJson: requiredString(record.get("recordJson"), "RECORD_JSON"),
      orderKey: canonicalJson({
        indexBuildId,
        projectionKind: requiredString(
          record.get("projectionKind"),
          "PROJECTION_KIND",
        ),
        projectionSnapshotId: requiredString(
          record.get("projectionSnapshotId"),
          "PROJECTION_SNAPSHOT_ID",
        ),
        recordType,
        canonicalRecordId: requiredString(
          record.get("canonicalRecordId"),
          "CANONICAL_RECORD_ID",
        ),
      }),
    }))
    .sort((left, right) => compareText(left.orderKey, right.orderKey));
}

function parseJsonProperty(value: unknown, label: string): unknown {
  const text = requiredString(value, label);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`QUERY_INDEX_STORED_${label}_INVALID`);
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`QUERY_INDEX_STORED_${label}_INVALID`);
  return value;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value, "NULLABLE_STRING");
}

function countValue(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    const converted = value.toNumber();
    if (Number.isSafeInteger(converted) && converted >= 0) return converted;
  }
  throw new Error("QUERY_INDEX_NEO4J_COUNT_INVALID");
}

function buildState(value: unknown): QueryIndexBuildMetadata["state"] {
  if (value === "STAGING" || value === "READY" || value === "FAILED")
    return value;
  throw new Error("QUERY_INDEX_STORED_BUILD_STATE_INVALID");
}

function gateState(value: unknown): QueryIndexGateState {
  if (value === "PENDING" || value === "PASSED" || value === "FAILED")
    return value;
  throw new Error("QUERY_INDEX_STORED_GATE_STATE_INVALID");
}

function boundedFailureCode(value: string): string {
  return (
    value.replace(/[^A-Z0-9_:-]/giu, "_").slice(0, 160) || "QUERY_INDEX_FAILURE"
  );
}

function isQueryIndexError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith("QUERY_INDEX_");
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/u.test(value);
}

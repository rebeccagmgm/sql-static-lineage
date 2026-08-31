import {
  createQueryIndexAuditManifest,
  loadExistingQueryIndexAudit,
  publishQueryIndexAudit,
  validateQueryIndexParityReport,
  type PublishQueryIndexAuditResult,
} from "./query-index-audit-publication.ts";
import type { QueryIndexParityReportV1 } from "./query-index-contract.ts";
import {
  buildQueryIndexRecordBundle,
  type QueryIndexRecordBundle,
} from "./query-index-records.ts";
import type { LoadedQueryIndexSource } from "./query-index-source.ts";
import { assertRequiredQueryIndexParityCoverage } from "./query-index-parity.ts";
import type {
  QueryIndexActivationResult,
  QueryIndexBuildMetadata,
  QueryIndexStore,
} from "./query-index-store.ts";
import {
  validateQueryIndexBuild,
  type QueryIndexValidationResult,
} from "./query-index-validation.ts";

export interface StagedQueryIndexBuild {
  readonly source: LoadedQueryIndexSource;
  readonly records: QueryIndexRecordBundle;
  readonly beginStatus: "CREATED" | "REUSED";
  readonly validation: QueryIndexValidationResult;
}

export interface QueryIndexBuildResult {
  readonly source: LoadedQueryIndexSource;
  readonly records: QueryIndexRecordBundle;
  readonly build: QueryIndexBuildMetadata;
  readonly activation: QueryIndexActivationResult;
  readonly audit: PublishQueryIndexAuditResult;
  readonly outcome: "CREATED" | "REUSED";
}

const NEO4J_EDGE_BATCH_LIMIT = 10;

export async function stageQueryIndexBuild(input: {
  readonly source: LoadedQueryIndexSource;
  readonly store: QueryIndexStore;
  readonly batchSize?: number;
}): Promise<StagedQueryIndexBuild> {
  const batchSize = positiveBatchSize(input.batchSize ?? 500);
  const edgeBatchSize = Math.min(batchSize, NEO4J_EDGE_BATCH_LIMIT);
  const records = buildQueryIndexRecordBundle(input.source);
  await input.store.setupSchema();
  const begun = await input.store.beginStagedBuild({
    indexBuildId: input.source.indexBuildId,
    projectKey: input.source.descriptor.projectKey,
    sourceDescriptorHash: input.source.descriptorHash,
    sourceDescriptor: input.source.descriptor,
    projections: records.projections,
    expectedCounts: records.expectedCounts,
  });
  try {
    if (begun.build.state === "STAGING") {
      for (const batch of batches(records.nodes, batchSize))
        await input.store.writeNodes(input.source.indexBuildId, batch);
      for (const batch of batches(records.edges, edgeBatchSize))
        await input.store.writeEdges(input.source.indexBuildId, batch);
    } else if (begun.build.state !== "READY") {
      throw new Error(`QUERY_INDEX_BUILD_NOT_REUSABLE:${begun.build.state}`);
    }
    const validation = await validateQueryIndexBuild({
      store: input.store,
      source: input.source,
      records,
    });
    if (begun.build.state === "STAGING")
      await input.store.recordValidation(input.source.indexBuildId, "PASSED");
    return {
      source: input.source,
      records,
      beginStatus: begun.status,
      validation,
    };
  } catch (error) {
    await failStagingBuild(input.store, input.source.indexBuildId, error);
    throw error;
  }
}

export async function activateQueryIndexBuild(input: {
  readonly staged: StagedQueryIndexBuild;
  readonly store: QueryIndexStore;
  readonly parityReport: QueryIndexParityReportV1;
  readonly auditOutputRoot: string;
  readonly beforeAuditInstall?: () => void;
}): Promise<QueryIndexBuildResult> {
  const { source, records } = input.staged;
  try {
    validateQueryIndexParityReport(input.parityReport);
    assertRequiredQueryIndexParityCoverage(source, input.parityReport);
    if (
      input.parityReport.indexBuildId !== source.indexBuildId ||
      input.parityReport.sourceDescriptorHash !== source.descriptorHash
    )
      throw new Error("QUERY_INDEX_PARITY_BUILD_MISMATCH");
    if (input.parityReport.status !== "PASSED")
      throw new Error("QUERY_INDEX_PARITY_REQUIRED_CASE_FAILED");
    const beforeActivation = await input.store.readBuild(source.indexBuildId);
    if (beforeActivation === null)
      throw new Error("QUERY_INDEX_ACTIVATION_BUILD_MISSING");
    if (beforeActivation.state === "STAGING") {
      await input.store.recordParity(
        source.indexBuildId,
        "PASSED",
        input.parityReport.contentHash,
      );
    } else if (
      beforeActivation.state !== "READY" ||
      beforeActivation.parityState !== "PASSED" ||
      beforeActivation.parityReportContentHash !==
        input.parityReport.contentHash
    ) {
      throw new Error("QUERY_INDEX_READY_REUSE_PARITY_CONFLICT");
    }
    const existingAudit = loadExistingQueryIndexAudit({
      outputRoot: input.auditOutputRoot,
      projectKey: source.descriptor.projectKey,
      indexBuildId: source.indexBuildId,
    });
    if (existingAudit !== null) {
      if (
        existingAudit.manifest.sourceDescriptorHash !== source.descriptorHash ||
        existingAudit.parityReport.contentHash !==
          input.parityReport.contentHash
      )
        throw new Error("QUERY_INDEX_READY_REUSE_AUDIT_CONFLICT");
      const current = await input.store.resolveCurrentBuild(
        source.descriptor.projectKey,
      );
      const activation =
        current?.indexBuildId === source.indexBuildId
          ? {
              previousCurrentBuildId:
                existingAudit.manifest.publication.previousCurrentBuildId,
              currentBuild: current,
            }
          : await input.store.activateReadyBuild({
              projectKey: source.descriptor.projectKey,
              indexBuildId: source.indexBuildId,
              sourceDescriptorHash: source.descriptorHash,
            });
      return {
        source,
        records,
        build: activation.currentBuild,
        activation,
        audit: {
          status: "REUSED",
          ...existingAudit,
        },
        outcome: "REUSED",
      };
    }
    const activation = await input.store.activateReadyBuild({
      projectKey: source.descriptor.projectKey,
      indexBuildId: source.indexBuildId,
      sourceDescriptorHash: source.descriptorHash,
    });
    const outcome =
      input.staged.beginStatus === "CREATED" ? "CREATED" : "REUSED";
    const manifest = createQueryIndexAuditManifest({
      indexBuildId: source.indexBuildId,
      projectKey: source.descriptor.projectKey,
      sourceDescriptorHash: source.descriptorHash,
      sourceDescriptor: source.descriptor,
      sourceCounts: {
        topology: source.descriptor.topology.counts,
        fieldEvidence: source.descriptor.fieldEvidence.map((field) => ({
          snapshotId: field.snapshotId,
          counts: field.counts,
        })),
        targetCausalOverlays: (
          source.descriptor.targetCausalOverlays ?? []
        ).map((causal) => ({
          snapshotId: causal.snapshotId,
          counts: causal.counts,
        })),
      },
      indexedCounts: {
        nodes: records.expectedCounts.nodes,
        edges: records.expectedCounts.edges,
        projections: records.projections.length,
      },
      publication: {
        buildState: "READY",
        activationState: "CURRENT",
        outcome,
        previousCurrentBuildId: activation.previousCurrentBuildId,
      },
      parityReportContentHash: input.parityReport.contentHash,
    });
    const audit = publishQueryIndexAudit({
      outputRoot: input.auditOutputRoot,
      manifest,
      parityReport: input.parityReport,
      beforeInstall: input.beforeAuditInstall,
    });
    return {
      source,
      records,
      build: activation.currentBuild,
      activation,
      audit,
      outcome,
    };
  } catch (error) {
    await failStagingBuild(input.store, source.indexBuildId, error);
    throw error;
  }
}

export async function buildQueryIndex(input: {
  readonly source: LoadedQueryIndexSource;
  readonly store: QueryIndexStore;
  readonly auditOutputRoot: string;
  readonly runParity: (
    staged: StagedQueryIndexBuild,
  ) => Promise<QueryIndexParityReportV1>;
  readonly batchSize?: number;
  readonly beforeAuditInstall?: () => void;
}): Promise<QueryIndexBuildResult> {
  const staged = await stageQueryIndexBuild(input);
  let parityReport: QueryIndexParityReportV1;
  try {
    parityReport = await input.runParity(staged);
  } catch (error) {
    await failStagingBuild(input.store, input.source.indexBuildId, error);
    throw error;
  }
  return activateQueryIndexBuild({
    staged,
    store: input.store,
    parityReport,
    auditOutputRoot: input.auditOutputRoot,
    beforeAuditInstall: input.beforeAuditInstall,
  });
}

async function failStagingBuild(
  store: QueryIndexStore,
  indexBuildId: string,
  error: unknown,
): Promise<void> {
  try {
    const build = await store.readBuild(indexBuildId);
    if (build === null || build.state !== "STAGING") return;
    const code = failureCode(error);
    if (build.validationState === "PENDING")
      await store.recordValidation(indexBuildId, "FAILED", code);
    else if (build.parityState === "PENDING")
      await store.recordParity(indexBuildId, "FAILED", "0".repeat(64), code);
    await store.markBuildFailed(indexBuildId, code);
  } catch {
    // Preserve the original build error; cleanup/status can inspect leftovers.
  }
}

function batches<T>(values: readonly T[], size: number): readonly T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size)
    result.push(values.slice(offset, offset + size));
  return result;
}

function positiveBatchSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10_000)
    throw new Error("QUERY_INDEX_BATCH_SIZE_INVALID");
  return value;
}

function failureCode(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("QUERY_INDEX_"))
    return error.message.split(":", 1)[0] ?? "QUERY_INDEX_BUILD_FAILED";
  return "QUERY_INDEX_BUILD_FAILED";
}

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { canonicalJson } from "../../machine-facts/machine-facts-contract.ts";
import { projectKeySegment } from "../contracts/project-topology-contract.ts";
import {
  QUERY_INDEX_ALGORITHM_VERSION,
  QUERY_INDEX_MANIFEST_TYPE,
  QUERY_INDEX_PARITY_REPORT_TYPE,
  QUERY_INDEX_SCHEMA_VERSION,
  queryIndexAuditManifestContentHash,
  queryIndexParityReportContentHash,
  queryIndexSourceDescriptorHash,
  type QueryIndexAuditManifestV1,
  type QueryIndexParityCaseResultV1,
  type QueryIndexParityReportV1,
} from "./query-index-contract.ts";

export const QUERY_INDEX_MANIFEST_FILE = "query-index-manifest.json" as const;
export const QUERY_INDEX_PARITY_REPORT_FILE = "parity-report.json" as const;

export interface PublishQueryIndexAuditResult {
  readonly status: "CREATED" | "REUSED";
  readonly directory: string;
  readonly manifest: QueryIndexAuditManifestV1;
  readonly parityReport: QueryIndexParityReportV1;
}

export function queryIndexAuditDirectory(input: {
  readonly outputRoot: string;
  readonly projectKey: string;
  readonly indexBuildId: string;
}): string {
  return join(
    resolve(input.outputRoot),
    "projects",
    projectKeySegment(input.projectKey),
    "query-index",
    input.indexBuildId,
  );
}

export function loadExistingQueryIndexAudit(input: {
  readonly outputRoot: string;
  readonly projectKey: string;
  readonly indexBuildId: string;
}): ReturnType<typeof loadQueryIndexAuditDirectory> | null {
  const directory = queryIndexAuditDirectory(input);
  return existsSync(directory) ? loadQueryIndexAuditDirectory(directory) : null;
}

export function createQueryIndexParityReport(input: {
  readonly indexBuildId: string;
  readonly sourceDescriptorHash: string;
  readonly cases: readonly QueryIndexParityCaseResultV1[];
}): QueryIndexParityReportV1 {
  assertSha256(input.indexBuildId, "BUILD_ID");
  assertSha256(input.sourceDescriptorHash, "SOURCE_DESCRIPTOR_HASH");
  const cases = [...input.cases].sort((left, right) =>
    left.caseId < right.caseId ? -1 : left.caseId > right.caseId ? 1 : 0,
  );
  if (
    new Set(cases.map(({ caseId }) => caseId)).size !== cases.length ||
    cases.some(({ caseId }) => caseId.length === 0)
  )
    throw new Error("QUERY_INDEX_PARITY_CASE_ID_INVALID");
  for (const item of cases) {
    assertSha256(item.referenceResultHash, "REFERENCE_RESULT_HASH");
    assertSha256(item.indexedResultHash, "INDEXED_RESULT_HASH");
    if (
      (item.status === "PASSED") !==
      (item.referenceResultHash === item.indexedResultHash &&
        item.difference === null)
    )
      throw new Error(`QUERY_INDEX_PARITY_CASE_STATUS_INVALID:${item.caseId}`);
  }
  const body = {
    schemaVersion: QUERY_INDEX_SCHEMA_VERSION,
    artifactType: QUERY_INDEX_PARITY_REPORT_TYPE,
    algorithmVersion: QUERY_INDEX_ALGORITHM_VERSION,
    indexBuildId: input.indexBuildId,
    sourceDescriptorHash: input.sourceDescriptorHash,
    status: cases.every(
      ({ required, status }) => !required || status === "PASSED",
    )
      ? ("PASSED" as const)
      : ("FAILED" as const),
    cases,
  };
  return { ...body, contentHash: queryIndexParityReportContentHash(body) };
}

export function createQueryIndexAuditManifest(
  input: Omit<
    QueryIndexAuditManifestV1,
    "schemaVersion" | "artifactType" | "algorithmVersion" | "contentHash"
  >,
): QueryIndexAuditManifestV1 {
  const body = {
    schemaVersion: QUERY_INDEX_SCHEMA_VERSION,
    artifactType: QUERY_INDEX_MANIFEST_TYPE,
    algorithmVersion: QUERY_INDEX_ALGORITHM_VERSION,
    ...input,
  };
  const manifest = {
    ...body,
    contentHash: queryIndexAuditManifestContentHash(body),
  };
  validateQueryIndexAuditManifest(manifest);
  return manifest;
}

export function publishQueryIndexAudit(input: {
  readonly outputRoot: string;
  readonly manifest: QueryIndexAuditManifestV1;
  readonly parityReport: QueryIndexParityReportV1;
  readonly beforeInstall?: () => void;
}): PublishQueryIndexAuditResult {
  validateQueryIndexAuditManifest(input.manifest);
  validateQueryIndexParityReport(input.parityReport);
  if (
    input.manifest.indexBuildId !== input.parityReport.indexBuildId ||
    input.manifest.sourceDescriptorHash !==
      input.parityReport.sourceDescriptorHash ||
    input.manifest.parityReportContentHash !== input.parityReport.contentHash
  )
    throw new Error("QUERY_INDEX_AUDIT_PARITY_MISMATCH");
  const projectKey = projectKeySegment(input.manifest.projectKey);
  const directory = queryIndexAuditDirectory({
    outputRoot: input.outputRoot,
    projectKey,
    indexBuildId: input.manifest.indexBuildId,
  });
  const root = resolve(directory, "..");
  const serialized = {
    manifest: canonicalJson(input.manifest),
    parityReport: canonicalJson(input.parityReport),
  };
  mkdirSync(root, { recursive: true });
  if (existsSync(directory)) {
    assertDirectoryMatches(directory, serialized);
    return {
      status: "REUSED",
      directory,
      manifest: input.manifest,
      parityReport: input.parityReport,
    };
  }
  const staging = mkdtempSync(join(root, ".query-index-staging-"));
  try {
    writeSerialized(staging, serialized);
    loadQueryIndexAuditDirectory(staging);
    input.beforeInstall?.();
    if (existsSync(directory)) {
      assertDirectoryMatches(directory, serialized);
      return {
        status: "REUSED",
        directory,
        manifest: input.manifest,
        parityReport: input.parityReport,
      };
    }
    renameSync(staging, directory);
    return {
      status: "CREATED",
      directory,
      manifest: input.manifest,
      parityReport: input.parityReport,
    };
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function loadQueryIndexAuditDirectory(directoryInput: string): {
  readonly directory: string;
  readonly manifest: QueryIndexAuditManifestV1;
  readonly parityReport: QueryIndexParityReportV1;
} {
  const directory = resolve(directoryInput);
  const manifest = parseJson<QueryIndexAuditManifestV1>(
    join(directory, QUERY_INDEX_MANIFEST_FILE),
  );
  const parityReport = parseJson<QueryIndexParityReportV1>(
    join(directory, QUERY_INDEX_PARITY_REPORT_FILE),
  );
  validateQueryIndexAuditManifest(manifest);
  validateQueryIndexParityReport(parityReport);
  if (
    manifest.indexBuildId !== parityReport.indexBuildId ||
    manifest.sourceDescriptorHash !== parityReport.sourceDescriptorHash ||
    manifest.parityReportContentHash !== parityReport.contentHash
  )
    throw new Error("QUERY_INDEX_AUDIT_PARITY_MISMATCH");
  return { directory, manifest, parityReport };
}

export function validateQueryIndexParityReport(
  report: QueryIndexParityReportV1,
): void {
  if (
    report.schemaVersion !== QUERY_INDEX_SCHEMA_VERSION ||
    report.artifactType !== QUERY_INDEX_PARITY_REPORT_TYPE ||
    report.algorithmVersion !== QUERY_INDEX_ALGORITHM_VERSION
  )
    throw new Error("QUERY_INDEX_PARITY_REPORT_CONTRACT_INVALID");
  const { contentHash: _contentHash, ...body } = report;
  if (queryIndexParityReportContentHash(body) !== report.contentHash)
    throw new Error("QUERY_INDEX_PARITY_REPORT_HASH_INVALID");
  const recreated = createQueryIndexParityReport({
    indexBuildId: report.indexBuildId,
    sourceDescriptorHash: report.sourceDescriptorHash,
    cases: report.cases,
  });
  if (canonicalJson(recreated) !== canonicalJson(report))
    throw new Error("QUERY_INDEX_PARITY_REPORT_CONTENT_INVALID");
}

export function validateQueryIndexAuditManifest(
  manifest: QueryIndexAuditManifestV1,
): void {
  if (
    manifest.schemaVersion !== QUERY_INDEX_SCHEMA_VERSION ||
    manifest.artifactType !== QUERY_INDEX_MANIFEST_TYPE ||
    manifest.algorithmVersion !== QUERY_INDEX_ALGORITHM_VERSION ||
    manifest.indexBuildId !== manifest.sourceDescriptorHash ||
    manifest.sourceDescriptorHash !==
      queryIndexSourceDescriptorHash(manifest.sourceDescriptor) ||
    manifest.projectKey !== manifest.sourceDescriptor.projectKey ||
    manifest.publication.buildState !== "READY" ||
    manifest.publication.activationState !== "CURRENT"
  )
    throw new Error("QUERY_INDEX_AUDIT_MANIFEST_CONTRACT_INVALID");
  const { contentHash: _contentHash, ...body } = manifest;
  if (queryIndexAuditManifestContentHash(body) !== manifest.contentHash)
    throw new Error("QUERY_INDEX_AUDIT_MANIFEST_HASH_INVALID");
  const forbiddenKeys = [
    "uri",
    "username",
    "password",
    "passwordFile",
    "passwordPath",
    "topologyDirectory",
    "fieldEvidenceDirectory",
  ];
  const serialized = canonicalJson(manifest);
  for (const key of forbiddenKeys) {
    if (serialized.includes(`\"${key}\"`))
      throw new Error(`QUERY_INDEX_AUDIT_SECRET_OR_PATH_FORBIDDEN:${key}`);
  }
}

function writeSerialized(
  directory: string,
  serialized: { readonly manifest: string; readonly parityReport: string },
): void {
  writeFileSync(
    join(directory, QUERY_INDEX_MANIFEST_FILE),
    serialized.manifest,
    "utf8",
  );
  writeFileSync(
    join(directory, QUERY_INDEX_PARITY_REPORT_FILE),
    serialized.parityReport,
    "utf8",
  );
}

function assertDirectoryMatches(
  directory: string,
  serialized: { readonly manifest: string; readonly parityReport: string },
): void {
  const actualManifest = readFileSync(
    join(directory, QUERY_INDEX_MANIFEST_FILE),
    "utf8",
  );
  const actualParity = readFileSync(
    join(directory, QUERY_INDEX_PARITY_REPORT_FILE),
    "utf8",
  );
  if (
    actualManifest !== serialized.manifest ||
    actualParity !== serialized.parityReport
  )
    throw new Error("QUERY_INDEX_AUDIT_IMMUTABLE_CONFLICT");
  loadQueryIndexAuditDirectory(directory);
}

function parseJson<T>(path: string): T {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    throw new Error("QUERY_INDEX_AUDIT_FILE_READ_FAILED");
  }
  if (bytes.byteLength > 16 * 1024 * 1024)
    throw new Error("QUERY_INDEX_AUDIT_FILE_LIMIT");
  try {
    return JSON.parse(bytes.toString("utf8")) as T;
  } catch {
    throw new Error("QUERY_INDEX_AUDIT_JSON_INVALID");
  }
}

function assertSha256(value: string, label: string): void {
  if (!/^[0-9a-f]{64}$/u.test(value))
    throw new Error(`QUERY_INDEX_${label}_INVALID`);
}

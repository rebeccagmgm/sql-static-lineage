import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { OneHopReconciliationResult } from "../../reconcile/consumer/one-hop/reconcile-one-hop.ts";
import {
  validateMultiHopReconciliation,
  type MultiHopReconciliationResult,
} from "../../reconcile/consumer/multi-hop/reconcile-multi-hop.ts";
import {
  canonicalJson,
  safeSegment,
  sha256,
} from "../../machine-facts/machine-facts-contract.ts";
import {
  stableProjectEvidenceHash,
  validateOneHopArtifact,
  type ProjectEvidenceSourceDescriptorV1,
} from "./project-evidence-contract.ts";

export const PROJECT_EVIDENCE_ARTIFACT_SCHEMA_VERSION = "1.0.0" as const;
export const PROJECT_EVIDENCE_ARTIFACT_TYPE =
  "PROJECT_EVIDENCE_BUNDLE" as const;

export interface ProjectEvidenceArtifactRootInput {
  readonly rootTaskId: string;
  readonly oneHop: OneHopReconciliationResult;
  readonly traversal: MultiHopReconciliationResult;
}

export interface ProjectEvidenceArtifactRootRef {
  readonly rootTaskId: string;
  readonly oneHopFile: string;
  readonly multiHopFile: string;
  readonly oneHopContentHash: string;
  readonly multiHopContentHash: string;
}

export interface ProjectEvidenceArtifactManifest {
  readonly schemaVersion: typeof PROJECT_EVIDENCE_ARTIFACT_SCHEMA_VERSION;
  readonly artifactType: typeof PROJECT_EVIDENCE_ARTIFACT_TYPE;
  readonly source: ProjectEvidenceSourceDescriptorV1;
  readonly roots: readonly ProjectEvidenceArtifactRootRef[];
  readonly files: readonly string[];
  readonly contentHash: string;
}

export interface PublishProjectEvidenceArtifactResult {
  readonly status: "CREATED" | "REUSED";
  readonly directory: string;
  readonly manifest: ProjectEvidenceArtifactManifest;
}

export function publishProjectEvidenceArtifact(input: {
  readonly outputRoot: string;
  readonly projectKey: string;
  readonly source: ProjectEvidenceSourceDescriptorV1;
  readonly roots: readonly ProjectEvidenceArtifactRootInput[];
}): PublishProjectEvidenceArtifactResult {
  const projectKey = safeSegment(input.projectKey, "projectKey");
  if (input.source.projectKey !== projectKey)
    throw new Error("PROJECT_EVIDENCE_SOURCE_PROJECT_KEY_MISMATCH");
  const roots = [...input.roots].sort((left, right) =>
    left.rootTaskId < right.rootTaskId
      ? -1
      : left.rootTaskId > right.rootTaskId
        ? 1
        : 0,
  );
  if (
    roots.length === 0 ||
    new Set(roots.map((root) => root.rootTaskId)).size !== roots.length ||
    roots.some(
      (root) =>
        !input.source.rootTaskIds.includes(root.rootTaskId) ||
        root.oneHop.taskId !== root.rootTaskId ||
        root.traversal.rootTaskId !== root.rootTaskId,
    ) ||
    roots.length !== input.source.rootTaskIds.length
  )
    throw new Error("PROJECT_EVIDENCE_ROOTS_MISMATCH");
  for (const root of roots) {
    validateOneHopArtifact(root.oneHop, root.rootTaskId);
    validateMultiHopReconciliation(root.traversal);
  }

  const rootRefs = roots.map((root) => {
    const rootTaskId = safeSegment(root.rootTaskId, "rootTaskId");
    return {
      rootTaskId,
      oneHopFile: `roots/${rootTaskId}/one-hop.json`,
      multiHopFile: `roots/${rootTaskId}/multi-hop.json`,
      oneHopContentHash: stableProjectEvidenceHash(root.oneHop),
      multiHopContentHash: stableProjectEvidenceHash(root.traversal),
    };
  });
  const files = [
    "manifest.json",
    ...rootRefs.flatMap((root) => [root.oneHopFile, root.multiHopFile]),
  ];
  const body = {
    schemaVersion: PROJECT_EVIDENCE_ARTIFACT_SCHEMA_VERSION,
    artifactType: PROJECT_EVIDENCE_ARTIFACT_TYPE,
    source: input.source,
    roots: rootRefs,
    files,
  } as const;
  const contentHash = sha256(canonicalJson(body));
  const manifest: ProjectEvidenceArtifactManifest = {
    ...body,
    contentHash,
  };
  const directory = join(
    resolve(input.outputRoot),
    "projects",
    projectKey,
    "evidence",
    `project-evidence-${contentHash}`,
  );
  if (existsSync(directory)) {
    if (isReusable(directory, manifest))
      return { status: "REUSED", directory, manifest };
    throw new Error(`PROJECT_EVIDENCE_ARTIFACT_CONFLICT:${directory}`);
  }

  const staging = `${directory}.${process.pid}.tmp`;
  if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  mkdirSync(dirname(directory), { recursive: true });
  mkdirSync(staging, { recursive: true });
  try {
    for (const [index, root] of roots.entries()) {
      const rootRef = rootRefs[index];
      if (!rootRef) throw new Error("PROJECT_EVIDENCE_ROOT_REF_MISSING");
      const rootDirectory = join(staging, "roots", rootRef.rootTaskId);
      mkdirSync(rootDirectory, { recursive: true });
      writeJson(join(staging, rootRef.oneHopFile), root.oneHop);
      writeJson(join(staging, rootRef.multiHopFile), root.traversal);
    }
    writeJson(join(staging, "manifest.json"), manifest);
    renameSync(staging, directory);
  } catch (error) {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return { status: "CREATED", directory, manifest };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value)}\n`, "utf8");
}

function isReusable(
  directory: string,
  expected: ProjectEvidenceArtifactManifest,
): boolean {
  try {
    const existing = JSON.parse(
      readFileSync(join(directory, "manifest.json"), "utf8"),
    ) as Partial<ProjectEvidenceArtifactManifest>;
    return (
      existing.contentHash === expected.contentHash &&
      expected.files.every((file) => existsSync(join(directory, file)))
    );
  } catch {
    return false;
  }
}

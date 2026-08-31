import {
	canonicalJson,
	sha256,
	type JsonValue,
} from "../../../machine-facts/machine-facts-contract.ts";
import {
	FIELD_LINEAGE_ARTIFACT_TYPE,
	FIELD_LINEAGE_SCHEMA_VERSION,
	type FactsPolicy,
	type FieldLineageArtifact,
} from "./field-lineage-contract.ts";

export const FIELD_LINEAGE_BUILD_CACHE_SCHEMA_VERSION =
	"field-lineage-build-cache-v1" as const;
export const FIELD_LINEAGE_BUILD_ALGORITHM_VERSION =
	"field-lineage-build-revision-v1" as const;

export type FieldLineageRootFieldSelection =
	| "EXPLICIT"
	| "ALL_TARGET_COLUMNS";

export type FieldLineageBuildRequest = {
	readonly cacheSchemaVersion: typeof FIELD_LINEAGE_BUILD_CACHE_SCHEMA_VERSION;
	readonly algorithmVersion: typeof FIELD_LINEAGE_BUILD_ALGORITHM_VERSION;
	readonly fieldLineageSchemaVersion: typeof FIELD_LINEAGE_SCHEMA_VERSION;
	readonly fieldLineageArtifactType: typeof FIELD_LINEAGE_ARTIFACT_TYPE;
	readonly multiHopContentHash: string;
	readonly consumerTaskPackContentHash: string;
	readonly consumerFactsManifestSha256: string;
	readonly consumerFactsState: "CURRENT_L1" | "LEGACY_NOT_L1";
	readonly rootTaskId: string;
	readonly rootTable: string;
	readonly rootFieldSelection: FieldLineageRootFieldSelection;
	readonly rootWriteObservationIds: readonly string[];
	readonly rootFields: readonly string[];
	readonly factsPolicy: FactsPolicy;
	readonly limits: {
		readonly maxDepth: number;
		readonly maxStates: number;
		readonly maxPaths: number;
	};
};

export type FieldLineageBuildDependency = {
	readonly taskId: string;
	readonly taskPackPresent: true;
	readonly taskPackContentHash: string;
	readonly factsPresent: boolean;
	readonly factsManifestSha256: string | null;
	readonly factsRevisionSha256: string;
	readonly factsState:
		| "CURRENT_L1"
		| "LEGACY_NOT_L1"
		| "STALE"
		| "INVALID";
	readonly producerTargetIdentity: string | null;
};

export type FieldLineageBuildTableDependency = {
	readonly physicalTableKey: string;
	readonly tableContentHash: string;
	readonly ddlSha256: string;
};

export type FieldLineageBuildCacheManifest = {
	readonly schemaVersion: typeof FIELD_LINEAGE_BUILD_CACHE_SCHEMA_VERSION;
	readonly key: string;
	readonly request: FieldLineageBuildRequest;
	readonly dependencies: readonly FieldLineageBuildDependency[];
	readonly tableDependencies: readonly FieldLineageBuildTableDependency[];
	readonly artifactContentHash: string;
	readonly artifactFileSha256: string;
	readonly htmlFileSha256: string | null;
	readonly integritySha256: string;
};

export type FieldLineageBuildRequestInput = Omit<
	FieldLineageBuildRequest,
	| "cacheSchemaVersion"
	| "algorithmVersion"
	| "fieldLineageSchemaVersion"
	| "fieldLineageArtifactType"
>;

export function createFieldLineageBuildRequest(
	input: FieldLineageBuildRequestInput,
): FieldLineageBuildRequest {
	return {
		cacheSchemaVersion: FIELD_LINEAGE_BUILD_CACHE_SCHEMA_VERSION,
		algorithmVersion: FIELD_LINEAGE_BUILD_ALGORITHM_VERSION,
		fieldLineageSchemaVersion: FIELD_LINEAGE_SCHEMA_VERSION,
		fieldLineageArtifactType: FIELD_LINEAGE_ARTIFACT_TYPE,
		multiHopContentHash: input.multiHopContentHash,
		consumerTaskPackContentHash: input.consumerTaskPackContentHash,
		consumerFactsManifestSha256: input.consumerFactsManifestSha256,
		consumerFactsState: input.consumerFactsState,
		rootTaskId: input.rootTaskId.trim(),
		rootTable: input.rootTable.trim().toLowerCase(),
		rootFieldSelection: input.rootFieldSelection,
		rootWriteObservationIds: [...new Set(input.rootWriteObservationIds)].sort(),
		rootFields: [...new Set(input.rootFields.map((field) => field.trim().toLowerCase()))].sort(),
		factsPolicy: input.factsPolicy,
		limits: { ...input.limits },
	};
}

export function fieldLineageBuildRequestKey(
	request: FieldLineageBuildRequest,
): string {
	return sha256(canonicalJson(request as unknown as JsonValue));
}

export function fieldLineageBuildManifestIntegrity(
	manifest: Omit<FieldLineageBuildCacheManifest, "integritySha256">,
): string {
	return sha256(canonicalJson(manifest as unknown as JsonValue));
}

export function fieldLineageBuildManifestFor(
	request: FieldLineageBuildRequest,
	dependencies: readonly FieldLineageBuildDependency[],
	artifact: FieldLineageArtifact,
	artifactFileSha256: string,
	htmlFileSha256: string | null,
	tableDependencies: readonly FieldLineageBuildTableDependency[] = [],
): FieldLineageBuildCacheManifest {
	const key = fieldLineageBuildRequestKey(request);
	const withoutIntegrity: Omit<FieldLineageBuildCacheManifest, "integritySha256"> = {
		schemaVersion: FIELD_LINEAGE_BUILD_CACHE_SCHEMA_VERSION,
		key,
		request,
		dependencies: [...dependencies].sort((left, right) => left.taskId.localeCompare(right.taskId)),
		tableDependencies: [...tableDependencies].sort((left, right) =>
			left.physicalTableKey.localeCompare(right.physicalTableKey),
		),
		artifactContentHash: artifact.contentHash,
		artifactFileSha256,
		htmlFileSha256,
	};
	return {
		...withoutIntegrity,
		integritySha256: fieldLineageBuildManifestIntegrity(withoutIntegrity),
	};
}

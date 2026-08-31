import {
	closeSync,
	copyFileSync,
	existsSync,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";

import {
	canonicalJson,
	sha256,
	type JsonValue,
} from "../../../machine-facts/machine-facts-contract.ts";
import {
	validateFieldLineageArtifact,
	type FieldLineageArtifact,
} from "./field-lineage-contract.ts";
import {
	fieldLineageBuildManifestFor,
	fieldLineageBuildManifestIntegrity,
	fieldLineageBuildRequestKey,
	FIELD_LINEAGE_BUILD_CACHE_SCHEMA_VERSION,
	type FieldLineageBuildCacheManifest,
	type FieldLineageBuildDependency,
	type FieldLineageBuildRequest,
	type FieldLineageBuildTableDependency,
} from "./field-lineage-build-contract.ts";

export interface FieldLineageBuildCacheCounters {
	hits: number;
	misses: number;
	stale: number;
	corrupt: number;
	writes: number;
}

export function createFieldLineageBuildCacheCounters(): FieldLineageBuildCacheCounters {
	return { hits: 0, misses: 0, stale: 0, corrupt: 0, writes: 0 };
}

export type FieldLineageBuildCacheHit = {
	readonly manifest: FieldLineageBuildCacheManifest;
	readonly artifact: FieldLineageArtifact;
	readonly artifactBytes: Buffer;
	readonly artifactPath: string;
	readonly htmlPath: string | null;
};

type RevisionReadResult =
	| { readonly status: "ABSENT" }
	| { readonly status: "CORRUPT" }
	| { readonly status: "VALID"; readonly hit: FieldLineageBuildCacheHit };

export type FieldLineageBuildDependencyProvider = (
	taskId: string,
) => FieldLineageBuildDependency;

export type FieldLineageBuildTableDependencyProvider = (
	physicalTableKey: string,
) => FieldLineageBuildTableDependency;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
	return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function dependencyValid(value: unknown): value is FieldLineageBuildDependency {
	if (!isRecord(value)) return false;
	return (
		typeof value.taskId === "string" &&
		value.taskId.length > 0 &&
		value.taskPackPresent === true &&
		isSha256(value.taskPackContentHash) &&
		typeof value.factsPresent === "boolean" &&
		(value.factsManifestSha256 === null || isSha256(value.factsManifestSha256)) &&
		isSha256(value.factsRevisionSha256) &&
		(value.factsState === "CURRENT_L1" ||
			value.factsState === "LEGACY_NOT_L1" ||
			value.factsState === "STALE" ||
			value.factsState === "INVALID") &&
		(value.factsPresent
			? (value.factsState === "CURRENT_L1" || value.factsState === "LEGACY_NOT_L1") &&
				isSha256(value.factsManifestSha256)
			: (value.factsState === "STALE" || value.factsState === "INVALID") &&
				value.factsManifestSha256 === null) &&
		(value.producerTargetIdentity === null || isSha256(value.producerTargetIdentity))
	);
}

function tableDependencyValid(
	value: unknown,
): value is FieldLineageBuildTableDependency {
	return (
		isRecord(value) &&
		typeof value.physicalTableKey === "string" &&
		value.physicalTableKey.trim() !== "" &&
		isSha256(value.tableContentHash) &&
		isSha256(value.ddlSha256)
	);
}

function tableDependencyEqual(
	left: FieldLineageBuildTableDependency,
	right: FieldLineageBuildTableDependency,
): boolean {
	return (
		left.physicalTableKey === right.physicalTableKey &&
		left.tableContentHash === right.tableContentHash &&
		left.ddlSha256 === right.ddlSha256
	);
}

function requestValid(value: unknown): value is FieldLineageBuildRequest {
	if (!isRecord(value)) return false;
	if (
		value.cacheSchemaVersion !== FIELD_LINEAGE_BUILD_CACHE_SCHEMA_VERSION ||
		value.algorithmVersion !== "field-lineage-build-revision-v1" ||
		value.fieldLineageSchemaVersion !== "1.1.0" ||
		value.fieldLineageArtifactType !== "FIELD_MULTI_HOP_RECONCILIATION" ||
		!isSha256(value.multiHopContentHash) ||
		!isSha256(value.consumerTaskPackContentHash) ||
		!isSha256(value.consumerFactsManifestSha256) ||
		(value.consumerFactsState !== "CURRENT_L1" &&
			value.consumerFactsState !== "LEGACY_NOT_L1") ||
		typeof value.rootTaskId !== "string" ||
		value.rootTaskId.trim() === "" ||
		typeof value.rootTable !== "string" ||
		value.rootTable.trim() === "" ||
		!Array.isArray(value.rootWriteObservationIds) ||
		value.rootWriteObservationIds.length === 0 ||
		value.rootWriteObservationIds.some(
			(item) => typeof item !== "string" || item.trim() === "",
		) ||
		new Set(value.rootWriteObservationIds).size !== value.rootWriteObservationIds.length ||
		(value.rootFieldSelection !== "EXPLICIT" &&
			value.rootFieldSelection !== "ALL_TARGET_COLUMNS") ||
		!Array.isArray(value.rootFields) ||
		value.rootFields.length === 0 ||
		value.rootFields.some((item) => typeof item !== "string" || item.trim() === "") ||
		new Set(value.rootFields).size !== value.rootFields.length ||
		(value.factsPolicy !== "current-only" &&
			value.factsPolicy !== "allow-legacy-partial") ||
		!isRecord(value.limits)
	)
		return false;
	const limits = value.limits as Record<string, unknown>;
	return ["maxDepth", "maxStates", "maxPaths"].every((name) => {
		const limit = limits[name];
		const minimum = name === "maxDepth" ? 0 : 1;
		return typeof limit === "number" && Number.isInteger(limit) && limit >= minimum;
	});
}

function equalStringList(
	left: readonly string[],
	right: readonly string[],
	normalize: (value: string) => string = (value) => value,
): boolean {
	const canonical = (values: readonly string[]): string[] =>
		[...new Set(values.map(normalize))].sort();
	return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

/**
 * The key protects the build request, while this second check protects the
 * artifact payload. An artifact with a valid self hash but a different root
 * selection/target contract is not reusable for the current request.
 */
function fieldLineageBuildRequestMatchesArtifact(
	request: FieldLineageBuildRequest,
	artifact: FieldLineageArtifact,
): boolean {
	const artifactRequest = artifact.request;
	return (
		artifactRequest.rootTaskId.trim() === request.rootTaskId &&
		artifactRequest.rootTable.trim().toLowerCase() === request.rootTable &&
		artifactRequest.rootFieldSelection === request.rootFieldSelection &&
		equalStringList(
			artifactRequest.rootWriteObservationIds,
			request.rootWriteObservationIds,
		) &&
		equalStringList(
			artifactRequest.rootFields,
			request.rootFields,
			(value) => value.trim().toLowerCase(),
		) &&
		artifactRequest.factsPolicy === request.factsPolicy &&
		artifact.limits.maxDepth === request.limits.maxDepth &&
		artifact.limits.maxStates === request.limits.maxStates &&
		artifact.limits.maxPaths === request.limits.maxPaths
	);
}

function dependencyEqual(
	left: FieldLineageBuildDependency,
	right: FieldLineageBuildDependency,
): boolean {
	return (
		left.taskId === right.taskId &&
		left.taskPackPresent === right.taskPackPresent &&
		left.taskPackContentHash === right.taskPackContentHash &&
		left.factsPresent === right.factsPresent &&
		left.factsManifestSha256 === right.factsManifestSha256 &&
		left.factsRevisionSha256 === right.factsRevisionSha256 &&
		left.factsState === right.factsState &&
		left.producerTargetIdentity === right.producerTargetIdentity
	);
}

function writeAtomic(path: string, bytes: Uint8Array): void {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.tmp-${randomUUID()}`;
	let fd: number | undefined;
	try {
		fd = openSync(temporary, "wx");
		const written = writeSync(fd, bytes, 0, bytes.byteLength);
		if (written !== bytes.byteLength) throw new Error("CACHE_WRITE_SHORT");
		fsyncSync(fd);
		closeSync(fd);
		fd = undefined;
		try {
			renameSync(temporary, path);
		} catch (error) {
			if (!existsSync(path)) throw error;
			rmSync(temporary, { force: true });
		}
	} finally {
		if (fd !== undefined) closeSync(fd);
		if (existsSync(temporary)) rmSync(temporary, { force: true });
	}
}

function artifactBytes(artifact: FieldLineageArtifact): Buffer {
	return Buffer.from(`${canonicalJson(artifact as unknown as JsonValue)}\n`, "utf8");
}

export class FieldLineageArtifactRevisionStore {
	private readonly root: string;

	public constructor(cacheRoot: string) {
		this.root = join(resolve(cacheRoot), "field-lineage-revisions-v1");
	}

	public revisionDirectory(key: string): string {
		return join(this.root, key.slice(0, 2), key);
	}

	public manifestPath(key: string): string {
		return join(this.revisionDirectory(key), "manifest.json");
	}

	public artifactPath(key: string): string {
		return join(this.revisionDirectory(key), "field-lineage.json");
	}

	public htmlPath(key: string): string {
		return join(this.revisionDirectory(key), "field-lineage.html");
	}

	public read(key: string): RevisionReadResult {
		const manifestPath = this.manifestPath(key);
		if (!existsSync(manifestPath)) return { status: "ABSENT" };
		try {
			const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
			if (!isRecord(manifest)) return { status: "CORRUPT" };
			if (
				manifest.schemaVersion !== FIELD_LINEAGE_BUILD_CACHE_SCHEMA_VERSION ||
				manifest.key !== key ||
				!requestValid(manifest.request) ||
				!Array.isArray(manifest.dependencies) ||
				manifest.dependencies.some((dependency) => !dependencyValid(dependency)) ||
				new Set(manifest.dependencies.map((dependency) => (dependency as Record<string, unknown>).taskId)).size !==
					manifest.dependencies.length ||
				!Array.isArray(manifest.tableDependencies) ||
				manifest.tableDependencies.some((dependency) => !tableDependencyValid(dependency)) ||
				new Set(
					manifest.tableDependencies.map((dependency) =>
						(dependency as Record<string, unknown>).physicalTableKey,
					),
				).size !== manifest.tableDependencies.length ||
				!isSha256(manifest.artifactContentHash) ||
				!isSha256(manifest.artifactFileSha256) ||
				!(manifest.htmlFileSha256 === null || isSha256(manifest.htmlFileSha256)) ||
				!isSha256(manifest.integritySha256)
			)
				return { status: "CORRUPT" };
			const withoutIntegrity = {
				schemaVersion: manifest.schemaVersion,
				key: manifest.key,
				request: manifest.request,
				dependencies: manifest.dependencies,
				tableDependencies: manifest.tableDependencies,
				artifactContentHash: manifest.artifactContentHash,
				artifactFileSha256: manifest.artifactFileSha256,
				htmlFileSha256: manifest.htmlFileSha256,
			} as Omit<FieldLineageBuildCacheManifest, "integritySha256">;
			if (fieldLineageBuildManifestIntegrity(withoutIntegrity) !== manifest.integritySha256)
				return { status: "CORRUPT" };
			if (fieldLineageBuildRequestKey(manifest.request) !== key)
				return { status: "CORRUPT" };
			const artifactPath = this.artifactPath(key);
			if (!existsSync(artifactPath)) return { status: "CORRUPT" };
			const bytes = readFileSync(artifactPath);
			if (sha256(bytes) !== manifest.artifactFileSha256) return { status: "CORRUPT" };
			const artifact = JSON.parse(bytes.toString("utf8")) as unknown;
			const errors = validateFieldLineageArtifact(artifact);
			if (errors.length > 0 || !isRecord(artifact) || artifact.contentHash !== manifest.artifactContentHash)
				return { status: "CORRUPT" };
			const htmlPath = this.htmlPath(key);
			if (manifest.htmlFileSha256 !== null) {
				if (!existsSync(htmlPath) || sha256(readFileSync(htmlPath)) !== manifest.htmlFileSha256)
					return { status: "CORRUPT" };
			}
			return {
				status: "VALID",
				hit: {
					manifest: manifest as unknown as FieldLineageBuildCacheManifest,
					artifact: artifact as unknown as FieldLineageArtifact,
					artifactBytes: bytes,
					artifactPath,
					htmlPath: manifest.htmlFileSha256 === null ? null : htmlPath,
				},
			};
		} catch {
			return { status: "CORRUPT" };
		}
	}

	public write(
		request: FieldLineageBuildRequest,
		dependencies: readonly FieldLineageBuildDependency[],
		artifact: FieldLineageArtifact,
		html?: string,
		tableDependencies: readonly FieldLineageBuildTableDependency[] = [],
	): FieldLineageBuildCacheManifest {
		const key = fieldLineageBuildRequestKey(request);
		const bytes = artifactBytes(artifact);
		const htmlBytes = html === undefined ? null : Buffer.from(html, "utf8");
		const manifest = fieldLineageBuildManifestFor(
			request,
			dependencies,
			artifact,
			sha256(bytes),
			htmlBytes === null ? null : sha256(htmlBytes),
			tableDependencies,
		);
		writeAtomic(this.artifactPath(key), bytes);
		if (htmlBytes !== null) writeAtomic(this.htmlPath(key), htmlBytes);
		writeAtomic(
			this.manifestPath(key),
			Buffer.from(`${canonicalJson(manifest as unknown as JsonValue)}\n`, "utf8"),
		);
		return manifest;
	}

	public copyArtifact(key: string, outputPath: string): void {
		mkdirSync(dirname(outputPath), { recursive: true });
		copyFileSync(this.artifactPath(key), outputPath);
	}

	public copyHtml(key: string, outputPath: string): boolean {
		const source = this.htmlPath(key);
		if (!existsSync(source)) return false;
		mkdirSync(dirname(outputPath), { recursive: true });
		copyFileSync(source, outputPath);
		return true;
	}
}

export class FieldLineageArtifactRevisionCache {
	public readonly counters: FieldLineageBuildCacheCounters;
	private readonly store: FieldLineageArtifactRevisionStore;

	public constructor(
		cacheRoot: string,
		counters: FieldLineageBuildCacheCounters = createFieldLineageBuildCacheCounters(),
	) {
		this.counters = counters;
		this.store = new FieldLineageArtifactRevisionStore(cacheRoot);
	}

	public get(
		request: FieldLineageBuildRequest,
		currentDependency: FieldLineageBuildDependencyProvider,
		currentTableDependency?: FieldLineageBuildTableDependencyProvider,
	): FieldLineageBuildCacheHit | null {
		const key = fieldLineageBuildRequestKey(request);
		const result = this.store.read(key);
		if (result.status === "ABSENT") {
			this.counters.misses += 1;
			return null;
		}
		if (result.status === "CORRUPT") {
			this.counters.corrupt += 1;
			this.counters.misses += 1;
			return null;
		}
		if (!fieldLineageBuildRequestMatchesArtifact(request, result.hit.artifact)) {
			this.counters.corrupt += 1;
			this.counters.misses += 1;
			return null;
		}
		try {
			for (const dependency of result.hit.manifest.dependencies) {
				if (!dependencyEqual(dependency, currentDependency(dependency.taskId))) {
					this.counters.stale += 1;
					this.counters.misses += 1;
					return null;
				}
			}
			if (result.hit.manifest.tableDependencies.length > 0) {
				if (!currentTableDependency) throw new Error("TABLE_DEPENDENCY_PROVIDER_REQUIRED");
				for (const dependency of result.hit.manifest.tableDependencies)
					if (
						!tableDependencyEqual(
							dependency,
							currentTableDependency(dependency.physicalTableKey),
						)
					) {
						this.counters.stale += 1;
						this.counters.misses += 1;
						return null;
					}
			}
		} catch {
			this.counters.stale += 1;
			this.counters.misses += 1;
			return null;
		}
		this.counters.hits += 1;
		return result.hit;
	}

	public put(
		request: FieldLineageBuildRequest,
		artifact: FieldLineageArtifact,
		dependencies: readonly FieldLineageBuildDependency[],
		html?: string,
		tableDependencies: readonly FieldLineageBuildTableDependency[] = [],
	): FieldLineageBuildCacheManifest {
		const manifest = this.store.write(
			request,
			dependencies,
			artifact,
			html,
			tableDependencies,
		);
		this.counters.writes += 1;
		return manifest;
	}

	public corruptForTest(request: FieldLineageBuildRequest): void {
		const key = fieldLineageBuildRequestKey(request);
		mkdirSync(dirname(this.store.manifestPath(key)), { recursive: true });
		writeAtomic(this.store.manifestPath(key), Buffer.from("{not-json", "utf8"));
	}
}

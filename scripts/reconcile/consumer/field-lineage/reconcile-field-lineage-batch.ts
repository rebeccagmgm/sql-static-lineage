import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import {
	MACHINE_FACTS_CONTRACT_VERSION,
	canonicalJson,
	sha256,
} from "../../../machine-facts/machine-facts-contract.ts";
import {
	createFieldLineageSharedContext,
	beginFieldLineageDependencyCapture,
	fieldLineageTableDependency,
	reconcileFieldLineage,
	resolveFieldLineageRoot,
	DEFAULT_FIELD_LINEAGE_MAX_PATHS,
	DEFAULT_FIELD_LINEAGE_MAX_STATES,
	type FieldLineageDependencyTimings,
	type FieldLineageRootSelection,
	type FieldLineageSharedContext,
} from "./field-lineage.ts";
import {
	FIELD_LINEAGE_ARTIFACT_TYPE,
	FIELD_LINEAGE_SCHEMA_VERSION,
	type FactsPolicy,
	type FieldLineageArtifact,
} from "./field-lineage-contract.ts";
import {
	FieldLineageArtifactRevisionCache,
	createFieldLineageBuildCacheCounters,
	type FieldLineageBuildCacheHit,
	type FieldLineageBuildDependencyProvider,
} from "./field-lineage-build-cache.ts";
import {
	createFieldLineageBuildRequest,
	fieldLineageBuildRequestKey,
	type FieldLineageBuildDependency,
	type FieldLineageBuildRequest,
	type FieldLineageBuildTableDependency,
} from "./field-lineage-build-contract.ts";
import {
	validateMultiHopReconciliation,
	type MultiHopReconciliationResult,
} from "../multi-hop/reconcile-multi-hop.ts";
import {
	assertMultiHopProducerIndexFreshness,
	type MultiHopProducerIndexFreshnessSnapshot,
} from "./multi-hop-freshness.ts";
import {
	captureFieldLineageInputSnapshot,
	runWithFrozenFieldLineageInputSnapshot,
	type FieldLineageInputSnapshot,
} from "./batch-input-snapshot.ts";
import { formatFieldLineageSummary } from "./format-field-lineage.ts";
import { renderFieldLineageHtml } from "../../../visualize/field-lineage-visualize.ts";

type JsonRecord = Record<string, unknown>;

interface BatchTaskSpec {
	readonly taskId: string;
	readonly targetTable: string;
	readonly multiHopArtifact: string;
	readonly writeObservationIds?: readonly string[];
	readonly fields: readonly string[];
	readonly factsPolicy: FactsPolicy;
	readonly maxDepth: number;
	readonly maxStates: number;
	readonly maxPaths: number;
}

interface BatchManifest {
	readonly dataRoot: string;
	readonly factsRoot: string;
	readonly producerIndexArtifact?: string;
	readonly tasks: readonly BatchTaskSpec[];
}

interface StageTimings {
	multiHopReadMs: number;
	oneHopReadMs: number;
	producerIndexReadMs: number;
	artifactCacheLookupMs: number;
	dependencyValidationMs: number;
	taskPackLoadMs: number;
	factsLoadMs: number;
	fieldReconcileMs: number;
	artifactCacheWriteMs: number;
	artifactSerializeOrCopyMs: number;
	htmlRenderOrCopyMs: number;
}

interface BatchTaskResult {
	readonly taskId: string;
	readonly requestKey: string;
	readonly cacheHit: boolean;
	readonly cacheMissReason: string | null;
	readonly cacheWriteSkippedReason: string | null;
	readonly status: string;
	readonly contentHash: string;
	readonly gaps: number;
	readonly candidates: number;
	readonly nodes: number;
	readonly edges: number;
	readonly artifactPath: string;
	readonly htmlPath: string | null;
	readonly summaryPath: string;
	readonly stageTimings: StageTimings;
	readonly consultedDependencyTaskIds: readonly string[];
	readonly consultedDependencyTableKeys: readonly string[];
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, name: string): string {
	if (typeof value !== "string" || value.trim() === "")
		throw new Error(`${name.toUpperCase()}_REQUIRED`);
	return value.trim();
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function integer(value: unknown, name: string, minimum: number): number {
	if (typeof value !== "number" || !Number.isInteger(value) || value < minimum)
		throw new Error(`${name.toUpperCase()}_INVALID`);
	return value;
}

function stringList(value: unknown, name: string, allowEmpty = true): string[] {
	if (value === undefined && allowEmpty) return [];
	if (!Array.isArray(value)) throw new Error(`${name.toUpperCase()}_INVALID`);
	const result = value
		.map((item) => (typeof item === "string" ? item.trim() : ""))
		.filter(Boolean);
	if (!allowEmpty && result.length === 0)
		throw new Error(`${name.toUpperCase()}_EMPTY`);
	return [...new Set(result)].sort();
}

function taskSpec(value: unknown, index: number): BatchTaskSpec {
	if (!isRecord(value)) throw new Error(`TASKS[${index}]_INVALID`);
	const factsPolicy = (optionalString(value.factsPolicy) ?? "current-only") as FactsPolicy;
	if (factsPolicy !== "current-only" && factsPolicy !== "allow-legacy-partial")
		throw new Error(`TASKS[${index}]_FACTS_POLICY_INVALID`);
	const writeObservationIds = stringList(
		value.writeObservationIds,
		`tasks[${index}].writeObservationIds`,
	);
	return {
		taskId: requiredString(value.taskId, `tasks[${index}].taskId`),
		targetTable: requiredString(value.targetTable, `tasks[${index}].targetTable`),
		multiHopArtifact: resolve(requiredString(value.multiHopArtifact, `tasks[${index}].multiHopArtifact`)),
		...(writeObservationIds.length > 0
			? { writeObservationIds }
			: {}),
		fields: stringList(value.fields, `tasks[${index}].fields`),
		factsPolicy,
		maxDepth: integer(value.maxDepth ?? 8, `tasks[${index}].maxDepth`, 0),
		maxStates: integer(value.maxStates ?? DEFAULT_FIELD_LINEAGE_MAX_STATES, `tasks[${index}].maxStates`, 1),
		maxPaths: integer(value.maxPaths ?? DEFAULT_FIELD_LINEAGE_MAX_PATHS, `tasks[${index}].maxPaths`, 1),
	};
}

export function readFieldLineageBatchManifest(path: string): BatchManifest {
	const parsed: unknown = JSON.parse(readFileSync(resolve(path), "utf8"));
	if (!isRecord(parsed) || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0)
		throw new Error("BATCH_MANIFEST_TASKS_REQUIRED");
	const dataRoot = resolve(requiredString(parsed.dataRoot, "dataRoot"));
	const factsRoot = resolve(requiredString(parsed.factsRoot, "factsRoot"));
	const tasks = parsed.tasks.map((value, index) => taskSpec(value, index));
	const taskIds = new Set<string>();
	for (const task of tasks) {
		if (taskIds.has(task.taskId)) throw new Error(`BATCH_TASK_DUPLICATE:${task.taskId}`);
		taskIds.add(task.taskId);
	}
	return {
		dataRoot,
		factsRoot,
		producerIndexArtifact: optionalString(parsed.producerIndexArtifact),
		tasks,
	};
}

function option(argv: readonly string[], name: string): string | undefined {
	const index = argv.indexOf(name);
	return index < 0 ? undefined : argv[index + 1];
}

function hash(value: string): boolean {
	return /^[a-f0-9]{64}$/.test(value);
}

function comparablePath(path: string): string {
	const resolved = resolve(path);
	try {
		return resolve(realpathSync.native(resolved));
	} catch {
		try {
			return resolve(join(realpathSync.native(dirname(resolved)), basename(resolved)));
		} catch {
			return resolved;
		}
	}
}

function contained(root: string, target: string): boolean {
	const relation = relative(comparablePath(root), comparablePath(target));
	return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
}

function assertOutsideInputRoots(
	rootName: string,
	root: string,
	dataRoot: string,
	factsRoot: string,
): void {
	for (const inputRoot of [dataRoot, factsRoot]) {
		if (contained(inputRoot, root) || contained(root, inputRoot))
			throw new Error(`${rootName.toUpperCase()}_OVERLAPS_INPUT_ROOT`);
	}
}

function readMultiHop(
	path: string,
	freshness: MultiHopProducerIndexFreshnessSnapshot,
): {
	readonly artifact: MultiHopReconciliationResult;
	readonly bytes: Buffer;
	readonly elapsedMs: number;
} {
	const started = performance.now();
	const bytes = readFileSync(path);
	const parsed: unknown = JSON.parse(bytes.toString("utf8"));
	validateMultiHopReconciliation(parsed);
	assertMultiHopProducerIndexFreshness(parsed, freshness);
	return {
		artifact: parsed,
		bytes,
		elapsedMs: performance.now() - started,
	};
}

function readOptionalJson(path: string): number {
	if (!existsSync(path)) return 0;
	const started = performance.now();
	const bytes = readFileSync(path);
	JSON.parse(bytes.toString("utf8"));
	return performance.now() - started;
}

function dependencyFor(
	context: FieldLineageSharedContext,
	taskId: string,
	factsPolicy: FactsPolicy,
): ReturnType<FieldLineageBuildDependencyProvider> {
	const pack = context.taskPacks.get(taskId);
	if (!pack || !hash(String(pack.document.contentHash)))
		throw new Error(`CACHE_DEPENDENCY_TASK_PACK_UNAVAILABLE:${taskId}`);
	const load = context.factsReader.load(taskId);
	const producerTargetIdentity = pack.target
		? sha256(
				canonicalJson({
					platform: pack.target.platform,
					dataSource: pack.target.dataSource,
					qualifiedName: pack.target.qualifiedName,
					stableTableId: pack.target.stableTableId,
					tableContentHash: pack.target.tableContentHash,
					ddlSha256: pack.target.ddlSha256,
				}),
			)
		: null;
	if (load.state === "CURRENT_L1" || load.state === "LEGACY_NOT_L1") {
		if (!load.manifestSha256 || !hash(load.manifestSha256))
			throw new Error(`CACHE_DEPENDENCY_FACTS_MANIFEST_UNAVAILABLE:${taskId}`);
		if (
			load.state === "LEGACY_NOT_L1" &&
			factsPolicy === "current-only" &&
			load.manifest?.schema_version !== MACHINE_FACTS_CONTRACT_VERSION
		)
			throw new Error(`CACHE_DEPENDENCY_FACTS_CONTRACT_INCOMPATIBLE:${taskId}`);
		return {
			taskId,
			taskPackPresent: true,
			taskPackContentHash: String(pack.document.contentHash),
			factsPresent: true,
			factsManifestSha256: load.manifestSha256,
			factsRevisionSha256: sha256(
				canonicalJson({
					taskId,
					state: load.state,
					manifestSha256: load.manifestSha256,
				}),
			),
			factsState: load.state,
			producerTargetIdentity,
		};
	}
	if (load.state !== "STALE" && load.state !== "INVALID")
		throw new Error(`CACHE_DEPENDENCY_FACTS_UNAVAILABLE:${taskId}:${load.state}`);
	return {
		taskId,
		taskPackPresent: true,
		taskPackContentHash: String(pack.document.contentHash),
		factsPresent: false,
		factsManifestSha256: null,
		factsRevisionSha256: sha256(
			canonicalJson({
				taskId,
				state: load.state,
				indexRow: load.indexRow ?? null,
				manifestSha256: load.manifestSha256 ?? null,
				issues: load.issues,
			}),
		),
		factsState: load.state,
		producerTargetIdentity,
	};
}

function tableDependencyFor(
	context: FieldLineageSharedContext,
	physicalTableKey: string,
): FieldLineageBuildTableDependency {
	const entry = context.tableCatalog.byPhysicalKey.get(physicalTableKey);
	if (!entry)
		throw new Error(`CACHE_DEPENDENCY_TABLE_UNAVAILABLE:${physicalTableKey}`);
	return fieldLineageTableDependency(entry);
}

function resolvedFactsState(
	selection: FieldLineageRootSelection,
): "CURRENT_L1" | "LEGACY_NOT_L1" {
	if (selection.rootFacts.state === "CURRENT_L1" || selection.rootFacts.state === "LEGACY_NOT_L1")
		return selection.rootFacts.state;
	throw new Error(`ROOT_FACTS_STATE_UNUSABLE:${selection.rootFacts.state}`);
}

function buildRequest(
	selection: FieldLineageRootSelection,
	spec: BatchTaskSpec,
	multiHop: MultiHopReconciliationResult,
): FieldLineageBuildRequest {
	if (!hash(multiHop.contentHash)) throw new Error("MULTI_HOP_CONTENT_HASH_INVALID");
	if (!hash(String(selection.rootPack.document.contentHash)))
		throw new Error(`ROOT_TASK_PACK_CONTENT_HASH_INVALID:${spec.taskId}`);
	if (!selection.rootFacts.manifestSha256 || !hash(selection.rootFacts.manifestSha256))
		throw new Error(`ROOT_FACTS_MANIFEST_HASH_INVALID:${spec.taskId}`);
	return createFieldLineageBuildRequest({
		multiHopContentHash: multiHop.contentHash,
		consumerTaskPackContentHash: String(selection.rootPack.document.contentHash),
		consumerFactsManifestSha256: selection.rootFacts.manifestSha256,
		consumerFactsState: resolvedFactsState(selection),
		rootTaskId: spec.taskId,
		rootTable: selection.rootTarget.qualifiedName,
		rootFieldSelection: selection.rootFieldSelection,
		rootWriteObservationIds: selection.rootWriteObservationIds,
		rootFields: selection.rootFields,
		factsPolicy: spec.factsPolicy,
		limits: {
			maxDepth: spec.maxDepth,
			maxStates: spec.maxStates,
			maxPaths: spec.maxPaths,
		},
	});
}

function emptyTimings(): StageTimings {
	return {
		multiHopReadMs: 0,
		oneHopReadMs: 0,
		producerIndexReadMs: 0,
		artifactCacheLookupMs: 0,
		dependencyValidationMs: 0,
		taskPackLoadMs: 0,
		factsLoadMs: 0,
		fieldReconcileMs: 0,
		artifactCacheWriteMs: 0,
		artifactSerializeOrCopyMs: 0,
		htmlRenderOrCopyMs: 0,
	};
}

function writeArtifactOutput(
	path: string,
	bytes: Buffer,
): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, bytes);
}

function artifactBytes(artifact: FieldLineageArtifact): Buffer {
	return Buffer.from(`${canonicalJson(artifact)}\n`, "utf8");
}

function renderHtml(
	artifact: FieldLineageArtifact,
	factsRoot: string,
): string {
	return renderFieldLineageHtml(artifact, factsRoot);
}

function cacheHitReason(cacheHit: FieldLineageBuildCacheHit | null): string | null {
	return cacheHit === null ? "MISS_OR_STALE_OR_CORRUPT" : null;
}

function runTask(
	context: FieldLineageSharedContext,
	spec: BatchTaskSpec,
	outputRoot: string,
	cache: FieldLineageArtifactRevisionCache | null,
	producerIndexReadMs: number,
	freshness: MultiHopProducerIndexFreshnessSnapshot,
	withHtml: boolean,
): BatchTaskResult {
	const timings = emptyTimings();
	const oneHopPath = join(dirname(spec.multiHopArtifact), "one-hop.json");
	timings.oneHopReadMs = readOptionalJson(oneHopPath);
	timings.producerIndexReadMs = producerIndexReadMs;
	const multiHopRead = readMultiHop(spec.multiHopArtifact, freshness);
	timings.multiHopReadMs = multiHopRead.elapsedMs;
	const identityCapture = beginFieldLineageDependencyCapture(context);
	const selection = resolveFieldLineageRoot(context, identityCapture, {
		rootTaskId: spec.taskId,
		rootTable: spec.targetTable,
		rootFields: spec.fields,
		rootWriteObservationIds: spec.writeObservationIds,
	});
	const request = buildRequest(selection, spec, multiHopRead.artifact);
	const requestKey = fieldLineageBuildRequestKey(request);
	const outputDirectory = join(outputRoot, "tasks", spec.taskId);
	const artifactPath = join(outputDirectory, "field-lineage.json");
	const htmlPath = withHtml ? join(outputDirectory, "field-lineage.html") : null;
	const summaryPath = join(outputDirectory, "field-lineage.summary.txt");
	let hit: FieldLineageBuildCacheHit | null = null;
	let cacheMissReason: string | null = null;
	let cacheWriteSkippedReason: string | null = null;
	let artifact: FieldLineageArtifact;
	let outputBytes: Buffer;
	let consultedDependencyTaskIds: readonly string[] = [];
	let consultedDependencyTableKeys: readonly string[] = [];
	let html: string | undefined;
	if (cache) {
		const cacheStarted = performance.now();
		const dependencyValidationStarted = performance.now();
		hit = cache.get(
			request,
			(taskId) => dependencyFor(context, taskId, spec.factsPolicy),
			(tableKey) => tableDependencyFor(context, tableKey),
		);
		timings.dependencyValidationMs = performance.now() - dependencyValidationStarted;
		timings.artifactCacheLookupMs = performance.now() - cacheStarted;
		cacheMissReason = cacheHitReason(hit);
	}
	if (hit) {
		artifact = hit.artifact;
		outputBytes = hit.artifactBytes;
		consultedDependencyTaskIds = hit.manifest.dependencies.map((dependency) => dependency.taskId);
		consultedDependencyTableKeys = hit.manifest.tableDependencies.map(
			(dependency) => dependency.physicalTableKey,
		);
	} else {
		const captureTimings: FieldLineageDependencyTimings = {
			taskPackLoadMs: 0,
			factsLoadMs: 0,
		};
		const capture = beginFieldLineageDependencyCapture(context, captureTimings);
		const reconcileStarted = performance.now();
		artifact = reconcileFieldLineage({
			dataRoot: context.dataRoot,
			factsRoot: context.factsRoot,
			sharedContext: context,
			dependencyCapture: capture,
			tableLineage: multiHopRead.artifact,
			rootTaskId: spec.taskId,
			rootTable: spec.targetTable,
			rootWriteObservationIds: spec.writeObservationIds,
			rootFields: spec.fields,
			factsPolicy: spec.factsPolicy,
			maxDepth: spec.maxDepth,
			maxStates: spec.maxStates,
			maxPaths: spec.maxPaths,
		});
		timings.fieldReconcileMs = performance.now() - reconcileStarted;
		timings.taskPackLoadMs = captureTimings.taskPackLoadMs;
		timings.factsLoadMs = captureTimings.factsLoadMs;
		consultedDependencyTaskIds = [...capture.consultedTaskIds].sort();
		consultedDependencyTableKeys = [...capture.tableDependencies.keys()].sort();
		outputBytes = artifactBytes(artifact);
		if (withHtml) {
			const htmlStarted = performance.now();
			html = renderHtml(artifact, context.factsRoot);
			timings.htmlRenderOrCopyMs = performance.now() - htmlStarted;
		}
		if (cache) {
			try {
				const dependencies = consultedDependencyTaskIds.map((taskId) =>
					dependencyFor(context, taskId, spec.factsPolicy),
				);
				const cacheWriteStarted = performance.now();
				cache.put(
					request,
					artifact,
					dependencies,
					html,
					[...capture.tableDependencies.values()],
				);
				timings.artifactCacheWriteMs = performance.now() - cacheWriteStarted;
			} catch (error) {
				cacheWriteSkippedReason =
					error instanceof Error ? error.message : String(error);
			}
		}
	}
	if (hit && withHtml) {
		const htmlStarted = performance.now();
		if (hit.htmlPath && existsSync(hit.htmlPath)) {
			mkdirSync(dirname(htmlPath!), { recursive: true });
			copyFileSync(hit.htmlPath, htmlPath!);
		} else {
			html = renderHtml(artifact, context.factsRoot);
			writeFileSync(htmlPath!, html, "utf8");
			if (cache)
				cache.put(
					request,
					artifact,
					hit.manifest.dependencies,
					html,
					hit.manifest.tableDependencies,
				);
		}
		timings.htmlRenderOrCopyMs = performance.now() - htmlStarted;
	}
	const serializeStarted = performance.now();
	writeArtifactOutput(artifactPath, outputBytes);
	writeFileSync(summaryPath, formatFieldLineageSummary(artifact), "utf8");
	if (!hit && withHtml && html !== undefined) writeFileSync(htmlPath!, html, "utf8");
	timings.artifactSerializeOrCopyMs = performance.now() - serializeStarted;
	return {
		taskId: spec.taskId,
		requestKey,
		cacheHit: hit !== null,
		cacheMissReason,
		cacheWriteSkippedReason,
		status: artifact.overallStatus,
		contentHash: artifact.contentHash,
		gaps: artifact.counts.gaps,
		candidates: artifact.counts.candidates,
		nodes: artifact.counts.nodes,
		edges: artifact.counts.edges,
		artifactPath,
		htmlPath: withHtml ? htmlPath : null,
		summaryPath,
		stageTimings: timings,
		consultedDependencyTaskIds,
		consultedDependencyTableKeys,
	};
}

export interface FieldLineageBatchRunOptions {
	readonly manifest: BatchManifest;
	readonly outputRoot: string;
	readonly cacheRoot?: string | null;
	readonly withHtml?: boolean;
	/** Injectable for deterministic tests of the frozen-input guard. */
	readonly snapshotProvider?: () => FieldLineageInputSnapshot;
}

export function runFieldLineageBatch(options: FieldLineageBatchRunOptions) {
	const manifest = options.manifest;
	if (!manifest.producerIndexArtifact)
		throw new Error("PRODUCER_INDEX_ARTIFACT_REQUIRED_FOR_FRESH_MULTI_HOP");
	const producerIndexPath = resolve(manifest.producerIndexArtifact);
	if (!existsSync(producerIndexPath))
		throw new Error(`PRODUCER_INDEX_NOT_FOUND:${producerIndexPath}`);
	const resolvedOutputRoot = resolve(options.outputRoot);
	assertOutsideInputRoots(
		"output-root",
		resolvedOutputRoot,
		manifest.dataRoot,
		manifest.factsRoot,
	);
	const resolvedCacheRoot = options.cacheRoot ? resolve(options.cacheRoot) : null;
	if (resolvedCacheRoot)
		assertOutsideInputRoots(
			"cache-root",
			resolvedCacheRoot,
			manifest.dataRoot,
			manifest.factsRoot,
		);
	mkdirSync(resolvedOutputRoot, { recursive: true });
	const withHtml = options.withHtml ?? false;
	const snapshotProvider =
		options.snapshotProvider ??
		(() =>
			captureFieldLineageInputSnapshot(
				manifest.dataRoot,
				manifest.factsRoot,
				producerIndexPath,
			));
	const snapshotTimings = { startMs: 0, endMs: 0 };
	let snapshotCalls = 0;
	const measuredSnapshotProvider = (): FieldLineageInputSnapshot => {
		const started = performance.now();
		const snapshot = snapshotProvider();
		const elapsed = performance.now() - started;
		if (snapshotCalls === 0) snapshotTimings.startMs = elapsed;
		else snapshotTimings.endMs = elapsed;
		snapshotCalls += 1;
		return snapshot;
	};
	const started = performance.now();
	const runtime = runWithFrozenFieldLineageInputSnapshot(
		measuredSnapshotProvider,
		(startSnapshot) => {
			const freshness: MultiHopProducerIndexFreshnessSnapshot = {
				dataRootInputFingerprint: startSnapshot.dataRootInputFingerprint,
				producerIndexContentHash: startSnapshot.producerIndexContentHash,
				producerIndexInputFingerprint:
					startSnapshot.producerIndexInputFingerprint,
			};
			const context = createFieldLineageSharedContext(
				manifest.dataRoot,
				manifest.factsRoot,
			);
			const counters = createFieldLineageBuildCacheCounters();
			const cache = resolvedCacheRoot
				? new FieldLineageArtifactRevisionCache(resolvedCacheRoot, counters)
				: null;
			const tasks = manifest.tasks.map((spec) =>
				runTask(
					context,
					spec,
					resolvedOutputRoot,
					cache,
					0,
					freshness,
					withHtml,
				),
			);
			return { context, cache, tasks };
		},
	);
	return {
		schemaVersion: "field-lineage-build-batch-v1",
		mode: "shared-context-artifact-revision",
		dataRoot: manifest.dataRoot,
		factsRoot: manifest.factsRoot,
		outputRoot: resolvedOutputRoot,
		cacheRoot: resolvedCacheRoot,
		noPrepareFacts: true,
		withHtml,
		context: {
			taskPathIndexMs: runtime.context.timings.taskPathIndexMs,
			tableCatalogMs: runtime.context.timings.tableCatalogMs,
			factsReaderMs: runtime.context.timings.factsReaderMs,
			taskPathIndexEntries: runtime.context.taskPathIndex.size,
			tableCatalogEntries: runtime.context.tableCatalog.entries.length,
		},
		inputSnapshotMs: snapshotTimings.startMs + snapshotTimings.endMs,
		inputSnapshotStartMs: snapshotTimings.startMs,
		inputSnapshotEndMs: snapshotTimings.endMs,
		producerIndexReadMs: snapshotTimings.startMs,
		batchWallMs: performance.now() - started,
		cacheCounters: runtime.cache?.counters ?? null,
		executionCounters: {
			reconcileCalls: runtime.tasks.filter((task) => !task.cacheHit).length,
			artifactReuseCalls: runtime.tasks.filter((task) => task.cacheHit).length,
		},
		tasks: runtime.tasks,
	};
}

function main(): void {
	const argv = process.argv.slice(2);
	const manifestPath = option(argv, "--manifest");
	const outputRoot = option(argv, "--output-root");
	const cacheRoot = option(argv, "--cache-root");
	if (!manifestPath || !outputRoot || !argv.includes("--no-prepare-facts"))
		throw new Error(
			"usage: reconcile-field-lineage:batch --manifest <json> --output-root <directory> [--cache-root <directory>] [--with-html] --no-prepare-facts [--report-output <json>]",
		);
	const manifest = readFieldLineageBatchManifest(manifestPath);
	const report = runFieldLineageBatch({
		manifest,
		outputRoot,
		cacheRoot,
		withHtml: argv.includes("--with-html"),
	});
	const reportOutput = option(argv, "--report-output");
	if (reportOutput) {
		const path = resolve(reportOutput);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
	}
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const isMain =
	process.argv[1] !== undefined &&
	fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) main();

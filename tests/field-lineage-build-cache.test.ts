import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
	canonicalizeFieldLineageArtifact,
	type FieldLineageArtifact,
} from "../scripts/reconcile/consumer/field-lineage/field-lineage-contract.ts";
import {
	createFieldLineageBuildRequest,
	fieldLineageBuildRequestKey,
	type FieldLineageBuildDependency,
	type FieldLineageBuildRequest,
} from "../scripts/reconcile/consumer/field-lineage/field-lineage-build-contract.ts";
import {
	FieldLineageArtifactRevisionCache,
	FieldLineageArtifactRevisionStore,
	createFieldLineageBuildCacheCounters,
} from "../scripts/reconcile/consumer/field-lineage/field-lineage-build-cache.ts";
import { readFieldLineageBatchManifest } from "../scripts/reconcile/consumer/field-lineage/reconcile-field-lineage-batch.ts";
import {
	beginFieldLineageDependencyCapture,
	type FieldLineageSharedContext,
} from "../scripts/reconcile/consumer/field-lineage/field-lineage.ts";
import {
	assertMultiHopProducerIndexFreshness,
	type MultiHopProducerIndexFreshnessSnapshot,
} from "../scripts/reconcile/consumer/field-lineage/multi-hop-freshness.ts";
import type { MultiHopReconciliationResult } from "../scripts/reconcile/consumer/multi-hop/reconcile-multi-hop.ts";
import {
	runWithFrozenFieldLineageInputSnapshot,
	type FieldLineageInputSnapshot,
} from "../scripts/reconcile/consumer/field-lineage/batch-input-snapshot.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function artifact(
	rootFields: readonly string[] = ["out_a"],
	rootFieldSelection: "EXPLICIT" | "ALL_TARGET_COLUMNS" = "EXPLICIT",
): FieldLineageArtifact {
	return canonicalizeFieldLineageArtifact({
		schemaVersion: "1.1.0",
		artifactType: "FIELD_MULTI_HOP_RECONCILIATION",
		generatedAt: "2026-08-28T00:00:00.000Z",
		request: {
			rootTaskId: "100",
			rootTable: "demo.root",
			rootWriteObservationIds: ["write-observation:100:1"],
			rootFields,
			rootFieldSelection,
			factsPolicy: "current-only",
		},
		overallStatus: "COMPLETE",
		rootNodeIds: ["root-node"],
		nodes: [{
			nodeId: "root-node",
			taskId: "100",
			taskName: "root",
			depth: 0,
			field: {
				platform: "hive",
				dataSource: "warehouse",
				stableTableId: "demo.root__warehouse",
				qualifiedName: "demo.root",
				column: rootFields[0]!,
				identityStatus: "SCHEMA_BACKED",
			},
			bindingId: "binding-1",
			expressionId: "expression-1",
			expressionText: "1",
			evidenceStatus: "CONFIRMED",
		}],
		edges: [],
		rowsetControls: [],
		candidates: [],
		gaps: [],
		tableEdges: [],
		limits: {
			maxDepth: 8,
			maxStates: 100,
			maxPaths: 100,
			truncated: false,
			reasons: [],
		},
		boundaries: {
			staticSqlOnly: true,
			runtimeExecution: "NOT_EVALUATED",
			dataCorrectness: "NOT_EVALUATED",
			businessAcceptance: "NOT_EVALUATED",
		},
	});
}

function request(
	fields: readonly string[] = ["out_a"],
	options: {
		readonly multiHopContentHash?: string;
		readonly rootWriteObservationIds?: readonly string[];
		readonly maxDepth?: number;
	} = {},
): FieldLineageBuildRequest {
	return createFieldLineageBuildRequest({
		multiHopContentHash: options.multiHopContentHash ?? HASH_A,
		consumerTaskPackContentHash: HASH_A,
		consumerFactsManifestSha256: HASH_B,
		consumerFactsState: "CURRENT_L1",
		rootTaskId: "100",
		rootTable: "demo.root",
		rootFieldSelection: "EXPLICIT",
		rootWriteObservationIds:
			options.rootWriteObservationIds ?? ["write-observation:100:1"],
		rootFields: fields,
		factsPolicy: "current-only",
		limits: {
			maxDepth: options.maxDepth ?? 8,
			maxStates: 100,
			maxPaths: 100,
		},
	});
}

function dependency(taskPackContentHash = HASH_A): FieldLineageBuildDependency {
	return {
		taskId: "100",
		taskPackPresent: true,
		taskPackContentHash,
		factsPresent: true,
		factsManifestSha256: HASH_B,
		factsRevisionSha256: HASH_B,
		factsState: "CURRENT_L1",
		producerTargetIdentity: HASH_A,
	};
}

describe("field lineage artifact revision cache", () => {
	it("fails closed when a multi-hop artifact is stale against the current input/index snapshot", () => {
		const artifact = {
			producerIndex: {
				contentHash: HASH_A,
				inputFingerprint: HASH_B,
			},
		} as MultiHopReconciliationResult;
		const snapshot: MultiHopProducerIndexFreshnessSnapshot = {
			dataRootInputFingerprint: HASH_B,
			producerIndexContentHash: HASH_A,
			producerIndexInputFingerprint: HASH_B,
		};

		expect(() => assertMultiHopProducerIndexFreshness(artifact, snapshot)).not.toThrow();
		expect(() =>
			assertMultiHopProducerIndexFreshness(artifact, {
				...snapshot,
				dataRootInputFingerprint: "c".repeat(64),
			}),
		).toThrow("MULTI_HOP_INPUT_PACK_FINGERPRINT_STALE");
		expect(() =>
			assertMultiHopProducerIndexFreshness(artifact, {
				...snapshot,
				producerIndexContentHash: "d".repeat(64),
			}),
		).toThrow("MULTI_HOP_PRODUCER_INDEX_STALE");
		expect(() =>
			assertMultiHopProducerIndexFreshness(
				{ producerIndex: { ...artifact.producerIndex, inputFingerprint: "e".repeat(64) } } as MultiHopReconciliationResult,
				snapshot,
			),
		).toThrow("MULTI_HOP_ARTIFACT_INDEX_RECORD_STALE");
	});

	it("reuses a validated immutable artifact revision without recomputing", () => {
		const root = mkdtempSync(join(tmpdir(), "field-lineage-build-cache-"));
		const counters = createFieldLineageBuildCacheCounters();
		const cache = new FieldLineageArtifactRevisionCache(root, counters);
		const identity = request();
		const dependencies = [dependency()];

		expect(cache.get(identity, () => dependencies[0]!)).toBeNull();
		cache.put(identity, artifact(), dependencies);
		const hit = cache.get(identity, () => dependencies[0]!);

		expect(hit?.artifact.contentHash).toBe(artifact().contentHash);
		expect(hit?.artifactBytes.length).toBeGreaterThan(0);
		expect(counters).toEqual({ hits: 1, misses: 1, stale: 0, corrupt: 0, writes: 1 });
	});

	it("invalidates on dependency or request identity changes", () => {
		const root = mkdtempSync(join(tmpdir(), "field-lineage-build-cache-"));
		const counters = createFieldLineageBuildCacheCounters();
		const cache = new FieldLineageArtifactRevisionCache(root, counters);
		const identity = request();
		cache.put(identity, artifact(), [dependency()]);

		expect(cache.get(identity, () => dependency(HASH_B))).toBeNull();
		expect(cache.get(request(["out_b"]), () => dependency())).toBeNull();
		expect(
			cache.get(
				request(["out_a"], { multiHopContentHash: HASH_B }),
				() => dependency(),
			),
		).toBeNull();
		expect(
			cache.get(request(["out_a"], { maxDepth: 9 }), () => dependency()),
		).toBeNull();
		expect(counters.stale).toBe(1);
		expect(counters.misses).toBe(4);
	});

	it("preserves every batch target write observation in request identity", () => {
		const targets = [
			["181058", "write-observation:181058:1"],
			["176827", "write-observation:176827:platform-target:0"],
			["209119", "write-observation:209119:platform-target:0"],
		] as const;
		for (const [taskId, writeObservationId] of targets) {
			const batchRequest = createFieldLineageBuildRequest({
				multiHopContentHash: HASH_A,
				consumerTaskPackContentHash: HASH_A,
				consumerFactsManifestSha256: HASH_B,
				consumerFactsState: "CURRENT_L1",
				rootTaskId: taskId,
				rootTable: `demo.${taskId}`,
				rootFieldSelection: "EXPLICIT",
				rootWriteObservationIds: [writeObservationId],
				rootFields: ["out_a"],
				factsPolicy: "current-only",
				limits: { maxDepth: 8, maxStates: 100, maxPaths: 100 },
			});
			const changedObservation = createFieldLineageBuildRequest({
				multiHopContentHash: HASH_A,
				consumerTaskPackContentHash: HASH_A,
				consumerFactsManifestSha256: HASH_B,
				consumerFactsState: "CURRENT_L1",
				rootTaskId: taskId,
				rootTable: `demo.${taskId}`,
				rootFieldSelection: "EXPLICIT",
				rootWriteObservationIds: [`${writeObservationId}:different`],
				rootFields: ["out_a"],
				factsPolicy: "current-only",
				limits: { maxDepth: 8, maxStates: 100, maxPaths: 100 },
			});
			expect(batchRequest.rootWriteObservationIds).toEqual([writeObservationId]);
			expect(batchRequest.rootWriteObservationIds[0]).toBe(writeObservationId);
			expect(fieldLineageBuildRequestKey(batchRequest)).not.toBe(
				fieldLineageBuildRequestKey(changedObservation),
			);
		}
	});

	it("reads the three benchmark write observations explicitly from the batch manifest", () => {
		const root = mkdtempSync(join(tmpdir(), "field-lineage-build-cache-"));
		const manifestPath = join(root, "batch-manifest.json");
		writeFileSync(
			manifestPath,
			JSON.stringify({
				dataRoot: root,
				factsRoot: join(root, "facts"),
				tasks: [
					{
						taskId: "181058",
						targetTable: "demo.181058",
						multiHopArtifact: join(root, "181058.json"),
						writeObservationIds: ["write-observation:181058:1"],
						fields: [],
					},
					{
						taskId: "176827",
						targetTable: "demo.176827",
						multiHopArtifact: join(root, "176827.json"),
						writeObservationIds: ["write-observation:176827:platform-target:0"],
						fields: [],
					},
					{
						taskId: "209119",
						targetTable: "demo.209119",
						multiHopArtifact: join(root, "209119.json"),
						writeObservationIds: ["write-observation:209119:platform-target:0"],
						fields: [],
					},
				],
			}),
			"utf8",
		);
		const manifest = readFieldLineageBatchManifest(manifestPath);
		expect(manifest.tasks.map((task) => task.writeObservationIds)).toEqual([
			["write-observation:181058:1"],
			["write-observation:176827:platform-target:0"],
			["write-observation:209119:platform-target:0"],
		]);
	});

	it("preserves omitted batch write observations as undefined", () => {
		const root = mkdtempSync(join(tmpdir(), "field-lineage-build-cache-"));
		const manifestPath = join(root, "batch-manifest-optional.json");
		writeFileSync(
			manifestPath,
			JSON.stringify({
				dataRoot: root,
				factsRoot: join(root, "facts"),
				tasks: [{
					taskId: "100",
					targetTable: "demo.root",
					multiHopArtifact: join(root, "100.json"),
					fields: [],
				}],
			}),
			"utf8",
		);
		const manifest = readFieldLineageBatchManifest(manifestPath);
		expect(manifest.tasks[0]?.writeObservationIds).toBeUndefined();
	});

	it("separates ALL and EXPLICIT root field selection and rejects artifact request drift", () => {
		const root = mkdtempSync(join(tmpdir(), "field-lineage-build-cache-"));
		const cache = new FieldLineageArtifactRevisionCache(root);
		const allInput = {
			multiHopContentHash: HASH_A,
			consumerTaskPackContentHash: HASH_A,
			consumerFactsManifestSha256: HASH_B,
			consumerFactsState: "CURRENT_L1" as const,
			rootTaskId: "100",
			rootTable: "demo.root",
			rootWriteObservationIds: ["write-observation:100:1"],
			rootFields: ["out_a"],
			rootFieldSelection: "ALL_TARGET_COLUMNS" as const,
			factsPolicy: "current-only" as const,
			limits: { maxDepth: 8, maxStates: 100, maxPaths: 100 },
		};
		const explicitInput = { ...allInput, rootFieldSelection: "EXPLICIT" as const };
		const allRequest = createFieldLineageBuildRequest(allInput);
		const explicitRequest = createFieldLineageBuildRequest(explicitInput);

		expect(allRequest.rootFieldSelection).toBe("ALL_TARGET_COLUMNS");
		expect(explicitRequest.rootFieldSelection).toBe("EXPLICIT");
		expect(fieldLineageBuildRequestKey(allRequest)).not.toBe(
			fieldLineageBuildRequestKey(explicitRequest),
		);

		cache.put(allRequest, artifact(["out_a"], "EXPLICIT"), [dependency()]);
		expect(cache.get(allRequest, () => dependency())).toBeNull();
	});

	it("captures the exact Table Pack and DDL dependencies consulted by reconcile", () => {
		const capture = beginFieldLineageDependencyCapture(
			{} as FieldLineageSharedContext,
		);
		const tableDependency = {
			physicalTableKey: "hive\u0000warehouse\u0000demo.source",
			tableContentHash: HASH_A,
			ddlSha256: HASH_B,
		};
		const captureApi = capture as unknown as {
			noteTableDependency: (value: typeof tableDependency) => void;
			tableDependencies: ReadonlyMap<string, typeof tableDependency>;
		};

		expect(typeof captureApi.noteTableDependency).toBe("function");
		captureApi.noteTableDependency(tableDependency);
		expect([...captureApi.tableDependencies.values()]).toEqual([tableDependency]);
	});

	it("misses when a captured Table Pack or DDL dependency changes", () => {
		const root = mkdtempSync(join(tmpdir(), "field-lineage-build-cache-"));
		const cache = new FieldLineageArtifactRevisionCache(root);
		const tableDependency = {
			physicalTableKey: "hive\u0000warehouse\u0000demo.source",
			tableContentHash: HASH_A,
			ddlSha256: HASH_B,
		};
		cache.put(request(), artifact(), [dependency()], undefined, [tableDependency]);

		expect(
			cache.get(
				request(),
				() => dependency(),
				() => tableDependency,
			),
		).not.toBeNull();
		expect(
			cache.get(
				request(),
				() => dependency(),
				() => ({ ...tableDependency, ddlSha256: "c".repeat(64) }),
			),
		).toBeNull();
	});

	it("fails closed when the input snapshot changes during a batch operation", () => {
		let phase: "start" | "during" = "start";
		const stable: FieldLineageInputSnapshot = {
			dataRootInputFingerprint: HASH_A,
			producerIndexContentHash: HASH_A,
			producerIndexInputFingerprint: HASH_A,
			factsRootFingerprint: HASH_B,
		};
		const changed: FieldLineageInputSnapshot = {
			...stable,
			factsRootFingerprint: "c".repeat(64),
		};

		expect(() =>
			runWithFrozenFieldLineageInputSnapshot(
				() => (phase === "start" ? stable : changed),
				() => {
					phase = "during";
				},
			),
		).toThrow("BATCH_INPUT_SNAPSHOT_CHANGED");
	});

	it("treats a valid-looking but damaged revision as corrupt", () => {
		const root = mkdtempSync(join(tmpdir(), "field-lineage-build-cache-"));
		const cache = new FieldLineageArtifactRevisionCache(root);
		const identity = request();
		cache.put(identity, artifact(), [dependency()]);
		cache.corruptForTest(identity);

		expect(cache.get(identity, () => dependency())).toBeNull();
		expect(cache.counters.corrupt).toBe(1);
	});

	it("publishes a complete revision atomically without temporary files", () => {
		const root = mkdtempSync(join(tmpdir(), "field-lineage-build-cache-"));
		const store = new FieldLineageArtifactRevisionStore(root);
		const identity = request();
		store.write(identity, [dependency()], artifact());
		const key = fieldLineageBuildRequestKey(identity);
		const files: string[] = [];
		const visit = (directory: string): void => {
			for (const entry of readdirSync(directory, { withFileTypes: true })) {
				const path = join(directory, entry.name);
				if (entry.isDirectory()) visit(path);
				else files.push(path);
			}
		};
		visit(store.revisionDirectory(key));
		expect(files.some((path) => path.includes(".tmp-"))).toBe(false);
		expect(store.read(key).status).toBe("VALID");
	});
});

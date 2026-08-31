import {
	readFileSync,
	mkdtempSync,
	mkdirSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";

type JsonRecord = Record<string, unknown>;

type TaskSpec = {
	readonly taskId: string;
	readonly targetTable: string;
	readonly writeObservationId: string;
	readonly expectedFields: number;
};

type IndependentSample = {
	readonly taskId: string;
	readonly mode: string;
	readonly sample: number;
	readonly wallMs: number;
	readonly status: string;
	readonly contentHash: string | null;
	readonly gaps: number;
	readonly candidates: number;
	readonly reconcileMs: number | null;
	readonly outputBytes: number;
	readonly outputFiles: number;
	readonly cacheHits: number;
	readonly cacheMisses: number;
	readonly cacheStale: number;
	readonly cacheCorrupt: number;
	readonly cacheWrites: number;
	readonly outputPath: string;
	readonly timingPath: string;
};

type BatchTaskReport = {
	readonly taskId: string;
	readonly requestKey: string;
	readonly cacheHit: boolean;
	readonly status: string;
	readonly contentHash: string;
	readonly gaps: number;
	readonly candidates: number;
	readonly nodes: number;
	readonly edges: number;
	readonly artifactPath: string;
	readonly stageTimings: JsonRecord;
};

type BatchReport = {
	readonly schemaVersion: string;
	readonly batchWallMs: number;
	readonly context: JsonRecord;
	readonly cacheCounters: JsonRecord | null;
	readonly executionCounters: JsonRecord;
	readonly tasks: readonly BatchTaskReport[];
};

type BatchSample = {
	readonly mode: "batch-cold" | "batch-warm";
	readonly sample: number;
	readonly wallMs: number;
	readonly outputRoot: string;
	readonly reportPath: string;
	readonly outputFiles: number;
	readonly outputBytes: number;
	readonly cacheFiles: number;
	readonly cacheBytes: number;
	readonly report: BatchReport;
};

const DATA_ROOT = "E:\\02_area\\股衍数据-数据cookbook\\sql-static-lineage-data";
const FACTS_ROOT = join(DATA_ROOT, "field-facts");
const PRODUCER_INDEX_ARTIFACT =
	"E:\\02_area\\股衍数据-数据cookbook\\sql-static-lineage-data.producer-index.json";
const TASKS: readonly TaskSpec[] = [
	{
		taskId: "181058",
		targetTable: "dm_rsk_n.otc_opt_inr_comp_pal_sum",
		writeObservationId: "write-observation:181058:1",
		expectedFields: 46,
	},
	{
		taskId: "176827",
		targetTable: "dm_rsk_n.otc_opt_greek_val_det_h",
		writeObservationId: "write-observation:176827:platform-target:0",
		expectedFields: 97,
	},
	{
		taskId: "209119",
		targetTable: "dm_rsk_n.otc_opt_sub_trd_info",
		writeObservationId: "write-observation:209119:platform-target:0",
		expectedFields: 137,
	},
];

function record(value: unknown): JsonRecord {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new Error("BENCHMARK_JSON_OBJECT_REQUIRED");
	return value as JsonRecord;
}

function numberValue(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function percentile(values: readonly number[], p: number): number {
	if (values.length === 0) throw new Error("BENCHMARK_SAMPLES_REQUIRED");
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]!;
}

function taskArtifactPath(taskId: string): string {
	return join(DATA_ROOT, "artifacts", "tasks", taskId, "multi-hop.json");
}

function option(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function integerOption(name: string, fallback: number): number {
	const raw = option(name);
	if (raw === undefined) return fallback;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name}_INVALID`);
	return parsed;
}

function directoryBytes(root: string): { readonly files: number; readonly bytes: number } {
	let files = 0;
	let bytes = 0;
	const visit = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) visit(path);
			else if (entry.isFile()) {
				files += 1;
				bytes += statSync(path).size;
			}
		}
	};
	visit(root);
	return { files, bytes };
}

function runIndependent(
	task: TaskSpec,
	mode: string,
	sample: number,
	outputRoot: string,
	cacheRoot?: string,
): IndependentSample {
	const taskOutputRoot = join(outputRoot, "independent", mode, task.taskId, String(sample));
	const outputPath = join(taskOutputRoot, "field-lineage.json");
	const timingPath = join(taskOutputRoot, "timing.json");
	mkdirSync(taskOutputRoot, { recursive: true });
	const cliPath = resolve(
		"scripts/reconcile/consumer/field-lineage/reconcile-field-lineage.ts",
	);
	const args = [
		"--import",
		"tsx",
		cliPath,
		"--data-root",
		DATA_ROOT,
		"--facts-root",
		FACTS_ROOT,
		"--multi-hop-artifact",
		taskArtifactPath(task.taskId),
		"--task-id",
		task.taskId,
		"--target-table",
		task.targetTable,
		"--write-observation-id",
		task.writeObservationId,
		"--facts-policy",
		"current-only",
		"--no-prepare-facts",
		"--output",
		outputPath,
		"--timing-output",
		timingPath,
		...(cacheRoot ? ["--expansion-cache-root", cacheRoot] : []),
	];
	const started = performance.now();
	const child = spawnSync(process.execPath, args, {
		cwd: process.cwd(),
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
	});
	const wallMs = performance.now() - started;
	if (child.status !== 0) {
		throw new Error(
			`BENCHMARK_CHILD_FAILED:${task.taskId}:${mode}:${child.stderr || child.stdout}`,
		);
	}
	const artifact = record(JSON.parse(readFileSync(outputPath, "utf8")));
	const timing = record(JSON.parse(readFileSync(timingPath, "utf8")));
	const phases = record(timing.phases_ms);
	const counters = record(timing.counters);
	const counts = record(artifact.counts);
	const storage = directoryBytes(taskOutputRoot);
	return {
		taskId: task.taskId,
		mode,
		sample,
		wallMs,
		status: String(artifact.overallStatus ?? "MISSING"),
		contentHash: stringValue(artifact.contentHash),
		gaps: numberValue(counts.gaps) ?? (Array.isArray(artifact.gaps) ? artifact.gaps.length : -1),
		candidates:
			numberValue(counts.candidates) ??
			(Array.isArray(artifact.candidates) ? artifact.candidates.length : -1),
		reconcileMs: numberValue(phases.reconcile_ms),
		outputBytes: storage.bytes,
		outputFiles: storage.files,
		cacheHits: numberValue(counters.expansion_cache_hits) ?? 0,
		cacheMisses: numberValue(counters.expansion_cache_misses) ?? 0,
		cacheStale: numberValue(counters.expansion_cache_stale) ?? 0,
		cacheCorrupt: numberValue(counters.expansion_cache_corrupt) ?? 0,
		cacheWrites: numberValue(counters.expansion_cache_writes) ?? 0,
		outputPath,
		timingPath,
	};
}

function writeBatchManifest(path: string, tasks: readonly TaskSpec[]): void {
	writeFileSync(
		path,
		`${JSON.stringify(
			{
				dataRoot: DATA_ROOT,
				factsRoot: FACTS_ROOT,
				producerIndexArtifact: PRODUCER_INDEX_ARTIFACT,
				tasks: tasks.map((task) => ({
					taskId: task.taskId,
					targetTable: task.targetTable,
					multiHopArtifact: taskArtifactPath(task.taskId),
					writeObservationIds: [task.writeObservationId],
					fields: [],
				})),
			},
			null,
		2,
		)}\n`,
		"utf8",
	);
}

function runBatch(
	manifestPath: string,
	mode: "batch-cold" | "batch-warm",
	sample: number,
	outputRoot: string,
	cacheRoot: string,
): BatchSample {
	const batchOutputRoot = join(outputRoot, mode, String(sample));
	const reportPath = join(batchOutputRoot, "report.json");
	mkdirSync(batchOutputRoot, { recursive: true });
	const cliPath = resolve(
		"scripts/reconcile/consumer/field-lineage/reconcile-field-lineage-batch.ts",
	);
	const args = [
		"--import",
		"tsx",
		cliPath,
		"--manifest",
		manifestPath,
		"--output-root",
		batchOutputRoot,
		"--cache-root",
		cacheRoot,
		"--no-prepare-facts",
		"--report-output",
		reportPath,
	];
	const started = performance.now();
	const child = spawnSync(process.execPath, args, {
		cwd: process.cwd(),
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	const wallMs = performance.now() - started;
	if (child.status !== 0)
		throw new Error(`BATCH_CHILD_FAILED:${mode}:${child.stderr || child.stdout}`);
	const report = JSON.parse(readFileSync(reportPath, "utf8")) as BatchReport;
	const outputStorage = directoryBytes(batchOutputRoot);
	const cacheStorage = directoryBytes(cacheRoot);
	return {
		mode,
		sample,
		wallMs,
		outputRoot: batchOutputRoot,
		reportPath,
		outputFiles: outputStorage.files,
		outputBytes: outputStorage.bytes,
		cacheFiles: cacheStorage.files,
		cacheBytes: cacheStorage.bytes,
		report,
	};
}

function taskSignature(value: {
	readonly status: string;
	readonly contentHash: string | null;
	readonly gaps: number;
	readonly candidates: number;
}): string {
	return JSON.stringify({
		status: value.status,
		contentHash: value.contentHash,
		gaps: value.gaps,
		candidates: value.candidates,
	});
}

function batchTaskSignature(task: BatchTaskReport): string {
	return taskSignature(task);
}

function assertBatchMatchesIndependent(
	independent: readonly IndependentSample[],
	cold: BatchSample,
	warm: readonly BatchSample[],
	tasks: readonly TaskSpec[],
): void {
	for (const task of tasks) {
		const baseline = independent.find((sample) => sample.taskId === task.taskId);
		const coldTask = cold.report.tasks.find((item) => item.taskId === task.taskId);
		const warmTasks = warm.map((sample) =>
			sample.report.tasks.find((item) => item.taskId === task.taskId),
		);
		if (!baseline || !coldTask || warmTasks.some((item) => item === undefined))
			throw new Error(`BATCH_TASK_RESULT_MISSING:${task.taskId}`);
		const expected = taskSignature(baseline);
		if (batchTaskSignature(coldTask) !== expected)
			throw new Error(`BATCH_COLD_OUTPUT_MISMATCH:${task.taskId}`);
		for (const warmTask of warmTasks) {
			if (batchTaskSignature(warmTask!) !== expected)
				throw new Error(`BATCH_WARM_OUTPUT_MISMATCH:${task.taskId}`);
		}
	}
	for (const sample of warm) {
		const counters = sample.report.cacheCounters;
		if (!counters || Number(counters.hits) !== tasks.length || Number(counters.misses) !== 0)
			throw new Error(`BATCH_WARM_CACHE_NOT_FULL_HIT:${sample.sample}`);
		if (Number(sample.report.executionCounters.reconcileCalls) !== 0)
			throw new Error(`BATCH_WARM_RECONCILE_EXECUTED:${sample.sample}`);
		if (Number(sample.report.executionCounters.artifactReuseCalls) !== tasks.length)
			throw new Error(`BATCH_WARM_ARTIFACT_REUSE_COUNT_INVALID:${sample.sample}`);
		for (const task of sample.report.tasks) {
			if (!task.cacheHit || Number(task.stageTimings.fieldReconcileMs) !== 0)
				throw new Error(`BATCH_WARM_TASK_RECONCILE_NONZERO:${sample.sample}:${task.taskId}`);
		}
	}
}

function main(): void {
	const outputRoot = mkdtempSync(join(tmpdir(), "field-lineage-e2e-"));
	const runId = `${new Date().toISOString().replaceAll(/[^0-9]/g, "").slice(0, 14)}-${process.pid}-${randomUUID().slice(0, 8)}`;
	const cacheRoot = join(
		"E:\\02_area\\股衍数据-数据cookbook\\sql-static-lineage-cache",
		`field-lineage-e2e-${runId}`,
	);
	const batchCacheRoot = join(cacheRoot, "artifact-revision");
	mkdirSync(batchCacheRoot, { recursive: true });
	const manifestPath = join(outputRoot, "batch-manifest.json");
	const warmSamples = integerOption("--warm-samples", 3);
	const noCacheSamples = integerOption("--no-cache-samples", 1);
	const modes = option("--mode") ?? "e2e";
	const requestedTaskIds = (option("--task-ids") ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	const selectedTasks = requestedTaskIds.length > 0
		? TASKS.filter((task) => requestedTaskIds.includes(task.taskId))
		: TASKS;
	if (selectedTasks.length === 0) throw new Error("BENCHMARK_TASKS_EMPTY");
	writeBatchManifest(manifestPath, selectedTasks);
	const independent: IndependentSample[] = [];
	const batches: BatchSample[] = [];
	if (modes === "e2e" || modes === "all") {
		for (let sample = 1; sample <= noCacheSamples; sample += 1)
			for (const task of selectedTasks)
				independent.push(runIndependent(task, "no-cache", sample, outputRoot));
		batches.push(runBatch(manifestPath, "batch-cold", 1, outputRoot, batchCacheRoot));
		for (let sample = 1; sample <= warmSamples; sample += 1)
			batches.push(runBatch(manifestPath, "batch-warm", sample, outputRoot, batchCacheRoot));
	}
	if (modes === "baseline" || modes === "all") {
		const oldCacheRoot = join(cacheRoot, "per-field-baseline");
		mkdirSync(oldCacheRoot, { recursive: true });
		for (const task of selectedTasks) {
			independent.push(runIndependent(task, "per-field-cold", 1, outputRoot, oldCacheRoot));
			for (let sample = 1; sample <= warmSamples; sample += 1)
				independent.push(runIndependent(task, "per-field-warm", sample, outputRoot, oldCacheRoot));
		}
	}
	const cold = batches.find((sample) => sample.mode === "batch-cold");
	const warm = batches.filter((sample) => sample.mode === "batch-warm");
	if ((modes === "e2e" || modes === "all") && (!cold || warm.length < warmSamples))
		throw new Error("BATCH_SAMPLES_MISSING");
	if (cold && warm.length > 0)
		assertBatchMatchesIndependent(
			independent.filter((sample) => sample.mode === "no-cache"),
			cold,
			warm,
			selectedTasks,
		);
	const noCache = independent.filter((sample) => sample.mode === "no-cache");
	const comparison = {
		totalIndependentNoCacheWallMs: noCache.reduce((sum, sample) => sum + sample.wallMs, 0) /
			Math.max(1, noCacheSamples),
		batchColdWallMs: cold?.wallMs ?? null,
		batchWarmWallMs: warm.length > 0 ? percentile(warm.map((sample) => sample.wallMs), 0.5) : null,
		batchWarmToIndependentNoCache:
			cold && warm.length > 0 && noCache.length > 0
				? percentile(warm.map((sample) => sample.wallMs), 0.5) /
					(noCache.reduce((sum, sample) => sum + sample.wallMs, 0) / Math.max(1, noCacheSamples))
				: null,
		batchWarmCacheHits: warm.at(-1)?.report.cacheCounters?.hits ?? 0,
		batchWarmCacheMisses: warm.at(-1)?.report.cacheCounters?.misses ?? 0,
		batchWarmReconcileCalls: warm.at(-1)?.report.executionCounters.reconcileCalls ?? null,
	};
	const taskResults = selectedTasks.map((task) => {
		const samples = noCache.filter((sample) => sample.taskId === task.taskId);
		const coldTask = cold?.report.tasks.find((item) => item.taskId === task.taskId);
		const warmTask = warm.at(-1)?.report.tasks.find((item) => item.taskId === task.taskId);
		return {
			taskId: task.taskId,
			writeObservationId: task.writeObservationId,
			expectedFields: task.expectedFields,
			noCacheMedianWallMs: samples.length > 0 ? percentile(samples.map((item) => item.wallMs), 0.5) : null,
			noCacheSignature: samples[0]
				? taskSignature(samples[0])
				: null,
			batchCold: coldTask
				? {
					cacheHit: coldTask.cacheHit,
					signature: batchTaskSignature(coldTask),
					stageTimings: coldTask.stageTimings,
				}
				: null,
			batchWarm: warmTask
				? {
					cacheHit: warmTask.cacheHit,
					signature: batchTaskSignature(warmTask),
					reconcileMs: warmTask.stageTimings.fieldReconcileMs,
					stageTimings: warmTask.stageTimings,
				}
				: null,
		};
	});
	const result = {
		schemaVersion: "field-lineage-e2e-benchmark-v2",
		dataRoot: DATA_ROOT,
		factsRoot: FACTS_ROOT,
		manifestPath,
		outputRoot,
		cacheRoot,
		tasks: selectedTasks,
		independentSamples: independent,
		batchSamples: batches.map((sample) => ({
			mode: sample.mode,
			sample: sample.sample,
			wallMs: sample.wallMs,
			outputRoot: sample.outputRoot,
			reportPath: sample.reportPath,
			outputFiles: sample.outputFiles,
			outputBytes: sample.outputBytes,
			cacheFiles: sample.cacheFiles,
			cacheBytes: sample.cacheBytes,
			context: sample.report.context,
			cacheCounters: sample.report.cacheCounters,
			executionCounters: sample.report.executionCounters,
			tasks: sample.report.tasks,
		})),
		comparison,
		taskResults,
	};
	const resultPath = join(outputRoot, "benchmark.json");
	const rendered = `${JSON.stringify(result, null, 2)}\n`;
	writeFileSync(resultPath, rendered, "utf8");
	process.stdout.write(rendered);
	if (modes === "baseline") {
		const target = independent.find(
			(item) => item.taskId === "209119" && item.mode === "per-field-warm",
		);
		const baseline = independent.find(
			(item) => item.taskId === "209119" && item.mode === "no-cache",
		);
		const ratio = target && baseline ? target.wallMs / baseline.wallMs : Number.POSITIVE_INFINITY;
		if (!target || !baseline || ratio <= 1.1 || target.cacheHits === 0)
			throw new Error(`PER_FIELD_CACHE_REGRESSION:209119:ratio=${ratio}:hits=${target?.cacheHits ?? 0}`);
	}
}

main();

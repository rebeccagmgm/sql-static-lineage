import {
	readFileSync,
	readdirSync,
	type Dirent,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import {
	canonicalJson,
	sha256,
	type JsonValue,
} from "../../../machine-facts/machine-facts-contract.ts";
import {
	captureCurrentMultiHopFreshness,
	type MultiHopFreshnessTimings,
} from "./multi-hop-freshness.ts";

export interface FieldLineageInputSnapshot {
	readonly dataRootInputFingerprint: string;
	readonly producerIndexContentHash: string;
	readonly producerIndexInputFingerprint: string;
	readonly factsRootFingerprint: string;
}

export interface FieldLineageInputSnapshotCapture {
	readonly snapshot: FieldLineageInputSnapshot;
	readonly timings: MultiHopFreshnessTimings & {
		readonly factsRootFingerprintMs: number;
	};
}

type FingerprintedFile = {
	readonly path: string;
	readonly sha256: string;
};

function filesUnder(rootInput: string, currentInput = rootInput): FingerprintedFile[] {
	const root = resolve(rootInput);
	const current = resolve(currentInput);
	const entries: Dirent[] = readdirSync(current, { withFileTypes: true });
	const files: FingerprintedFile[] = [];
	for (const entry of entries.sort((left, right) =>
		left.name.localeCompare(right.name),
	)) {
		const path = join(current, entry.name);
		if (entry.isDirectory()) {
			files.push(...filesUnder(root, path));
			continue;
		}
		if (entry.isSymbolicLink())
			throw new Error(`BATCH_INPUT_SNAPSHOT_SYMLINK:${relative(root, path)}`);
		if (!entry.isFile()) continue;
		files.push({
			path: relative(root, path).replaceAll("\\", "/"),
			sha256: sha256(readFileSync(path)),
		});
	}
	return files;
}

export function fingerprintFactsRoot(factsRootInput: string): string {
	const factsRoot = resolve(factsRootInput);
	const files = filesUnder(factsRoot).sort((left, right) =>
		left.path.localeCompare(right.path),
	);
	return sha256(canonicalJson(files as unknown as JsonValue));
}

export function captureFieldLineageInputSnapshot(
	dataRoot: string,
	factsRoot: string,
	producerIndexPath: string,
): FieldLineageInputSnapshot {
	return captureFieldLineageInputSnapshotWithTimings(
		dataRoot,
		factsRoot,
		producerIndexPath,
	).snapshot;
}

export function captureFieldLineageInputSnapshotWithTimings(
	dataRoot: string,
	factsRoot: string,
	producerIndexPath: string,
): FieldLineageInputSnapshotCapture {
	const timings: MultiHopFreshnessTimings & {
		factsRootFingerprintMs: number;
	} = {
		producerIndexReadMs: 0,
		dataRootFingerprintMs: 0,
		factsRootFingerprintMs: 0,
	};
	const freshness = captureCurrentMultiHopFreshness(
		dataRoot,
		producerIndexPath,
		timings,
	);
	const factsRootFingerprintStarted = performance.now();
	const factsRootFingerprint = fingerprintFactsRoot(factsRoot);
	timings.factsRootFingerprintMs = performance.now() - factsRootFingerprintStarted;
	return {
		snapshot: {
			...freshness.snapshot,
			factsRootFingerprint,
		},
		timings,
	};
}

export function runWithFrozenFieldLineageInputSnapshot<T>(
	snapshotProvider: () => FieldLineageInputSnapshot,
	operation: (startSnapshot: FieldLineageInputSnapshot) => T,
): T {
	const before = snapshotProvider();
	const result = operation(before);
	const after = snapshotProvider();
	if (canonicalJson(before as unknown as JsonValue) !== canonicalJson(after as unknown as JsonValue))
		throw new Error("BATCH_INPUT_SNAPSHOT_CHANGED");
	return result;
}

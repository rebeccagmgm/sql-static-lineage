import { performance } from "node:perf_hooks";

import {
	fingerprintTableProducerInputs,
	loadTableProducerIndex,
	type TableProducerIndex,
} from "../../producer/producer-index.ts";

export type MultiHopProducerIndexRecord = {
	readonly contentHash: string;
	readonly inputFingerprint: string;
};

export interface MultiHopProducerIndexFreshnessSnapshot {
	readonly dataRootInputFingerprint: string;
	readonly producerIndexContentHash: string;
	readonly producerIndexInputFingerprint: string;
}

export interface CurrentMultiHopFreshness {
	readonly snapshot: MultiHopProducerIndexFreshnessSnapshot;
	readonly producerIndex: TableProducerIndex;
}

export interface MultiHopFreshnessTimings {
	producerIndexReadMs: number;
	dataRootFingerprintMs: number;
}

/**
 * Validate the identity recorded by a multi-hop artifact against the same
 * input/index snapshot used by the current build. Self contentHash validation
 * is deliberately not part of this check; the artifact contract validator
 * owns that check, while this function owns cross-artifact freshness.
 */
export function assertMultiHopProducerIndexFreshness(
	artifact: { readonly producerIndex: MultiHopProducerIndexRecord },
	snapshot: MultiHopProducerIndexFreshnessSnapshot,
): void {
	if (
		snapshot.dataRootInputFingerprint !==
		snapshot.producerIndexInputFingerprint
	)
		throw new Error("MULTI_HOP_INPUT_PACK_FINGERPRINT_STALE");
	if (
		artifact.producerIndex.inputFingerprint !==
		snapshot.producerIndexInputFingerprint
	)
		throw new Error("MULTI_HOP_ARTIFACT_INDEX_RECORD_STALE");
	if (
		artifact.producerIndex.contentHash !== snapshot.producerIndexContentHash
	)
		throw new Error("MULTI_HOP_PRODUCER_INDEX_STALE");
}

/**
 * Read and validate the current Producer Index, then fingerprint the current
 * Input Pack tree. Both are captured once per batch and can be reused by all
 * target tasks. Existing producer-index validation remains authoritative.
 */
export function captureCurrentMultiHopFreshness(
	dataRoot: string,
	producerIndexPath: string,
	timings?: MultiHopFreshnessTimings,
): CurrentMultiHopFreshness {
	const producerIndexStarted = performance.now();
	const producerIndex = loadTableProducerIndex(producerIndexPath);
	if (timings) timings.producerIndexReadMs = performance.now() - producerIndexStarted;
	const dataRootFingerprintStarted = performance.now();
	const dataRootInputFingerprint = fingerprintTableProducerInputs(dataRoot);
	if (timings)
		timings.dataRootFingerprintMs = performance.now() - dataRootFingerprintStarted;
	const snapshot: MultiHopProducerIndexFreshnessSnapshot = {
		dataRootInputFingerprint,
		producerIndexContentHash: producerIndex.contentHash,
		producerIndexInputFingerprint: producerIndex.inputFingerprint,
	};
	assertMultiHopProducerIndexFreshness(
		{ producerIndex },
		snapshot,
	);
	return { snapshot, producerIndex };
}
